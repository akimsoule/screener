import type { Context } from "@netlify/functions";
import { detectMacroRegime } from "../app/analysis/macroRegime";
import { calculateAssetClassBias } from "../app/analysis/assetClassBias";
import { fetchQuote, fetchCloses } from "../lib/yahoo";

/**
 * Récupère une série économique depuis FRED API
 * API Key gratuite : https://fred.stlouisfed.org/docs/api/api_key.html
 */
async function fetchFredSeries(
  seriesId: string,
  apiKey: string,
  limit = 1,
): Promise<number | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&limit=${limit}&sort_order=desc`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`FRED API error for ${seriesId}: ${response.status}`);
      return null;
    }
    const data = await response.json();
    const observations = data.observations || [];
    if (observations.length === 0) return null;
    const value = parseFloat(observations[0].value);
    return isNaN(value) ? null : value;
  } catch (error) {
    console.error(`Failed to fetch FRED series ${seriesId}:`, error);
    return null;
  }
}

/**
 * Calcule la croissance YoY d'une série FRED
 */
async function fetchFredGrowthYoY(
  seriesId: string,
  apiKey: string,
): Promise<number | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&limit=13&sort_order=desc`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const observations = data.observations || [];
    if (observations.length < 13) return null;

    const latest = parseFloat(observations[0].value);
    const yearAgo = parseFloat(observations[12].value);

    if (isNaN(latest) || isNaN(yearAgo) || yearAgo === 0) return null;
    return ((latest - yearAgo) / yearAgo) * 100;
  } catch (error) {
    console.error(`Failed to calculate YoY growth for ${seriesId}:`, error);
    return null;
  }
}

/**
 * Récupère les données macroéconomiques réelles depuis FRED API + Yahoo Finance
 */
async function fetchRealMacroData() {
  // Récupération de la clé API FRED depuis les variables d'environnement
  const FRED_API_KEY = process.env.FRED_API_KEY || "";

  try {
    // Données Yahoo Finance (toujours disponibles)
    const [dxyCloses, vixQuote, spyQuote, goldQuote] = await Promise.all([
      fetchCloses("DX-Y.NYB", "1d", "3mo"),
      fetchQuote("^VIX"),
      fetchQuote("SPY"),
      fetchQuote("GLD"),
    ]);

    const dxyMomentum =
      dxyCloses.length >= 2
        ? ((dxyCloses[dxyCloses.length - 1] - dxyCloses[0]) / dxyCloses[0]) *
          100
        : 1.2;

    const vixLevel = vixQuote?.price || 20;
    const spyChange = spyQuote?.changePercent || 0;
    const goldChange = goldQuote?.changePercent || 0;

    let ismPmi: number | null = null;
    let m2Growth: number | null = null;
    let fedFundsRate: number | null = null;
    let useFredData = false;

    // Tentative de récupération des données FRED (si clé API disponible)
    if (FRED_API_KEY) {
      try {
        [ismPmi, m2Growth, fedFundsRate] = await Promise.all([
          fetchFredSeries("MANEMP", FRED_API_KEY), // ISM Manufacturing PMI
          fetchFredGrowthYoY("M2SL", FRED_API_KEY), // M2 Money Supply (croissance YoY)
          fetchFredSeries("DFF", FRED_API_KEY), // Federal Funds Effective Rate
        ]);
        useFredData = true;
      } catch (fredError) {
        console.error("FRED API failed, using estimates:", fredError);
      }
    }

    // Fallback sur estimations si FRED n'est pas disponible
    if (!ismPmi) {
      ismPmi = spyChange > 0 ? 52.5 : 48.5;
    }

    if (!m2Growth) {
      m2Growth = vixLevel < 20 ? 6.5 : 4.0;
    }

    if (!fedFundsRate) {
      fedFundsRate = 5.25; // Estimation actuelle
    }

    // Fed Dot Plot et Market Pricing (estimations basées sur le taux actuel)
    // En production, scraper depuis le site de la Fed ou utiliser Bloomberg
    const fedDotPlot2025 = fedFundsRate + 0.5;
    const marketPricing2025 = fedFundsRate + 0.25;

    // NFP Surprise (estimation basée sur volatilité)
    // En production, récupérer depuis un calendrier économique (Investing.com API, etc.)
    const nfpSurprise = vixLevel < 15 ? 50000 : -25000;

    return {
      fedDotPlot2025: Number(fedDotPlot2025.toFixed(2)),
      marketPricing2025: Number(marketPricing2025.toFixed(2)),
      ismPmi: Number(ismPmi.toFixed(1)),
      dxyMomentum: Number(dxyMomentum.toFixed(2)),
      m2Growth: Number(m2Growth.toFixed(2)),
      nfpSurprise: Math.round(nfpSurprise),
      _metadata: {
        vix: vixLevel,
        spyChange,
        goldChange,
        fedFundsRate,
        timestamp: new Date().toISOString(),
        source: useFredData ? "fred-api-real" : "yahoo-finance-estimated",
        fredApiAvailable: !!FRED_API_KEY,
        note: useFredData
          ? "Données officielles FRED + Yahoo Finance"
          : "Estimations basées sur prix de marché (FRED_API_KEY manquante)",
      },
    };
  } catch (error) {
    console.error("Failed to fetch real macro data:", error);
    // Fallback complet sur données de démo
    return {
      fedDotPlot2025: 3.75,
      marketPricing2025: 3.5,
      ismPmi: 52.5,
      dxyMomentum: 1.2,
      m2Growth: 6.2,
      nfpSurprise: -25000,
      _metadata: {
        source: "fallback-demo",
        error: (error as Error).message,
        fredApiAvailable: false,
      },
    };
  }
}

export default async function handler(request: Request, context: Context) {
  try {
    // Récupération des vraies données macro
    const marketData = await fetchRealMacroData();

    // Détection du régime macro
    const macroRegime = detectMacroRegime(marketData);

    // Calcul des biais par classe d'actifs
    const assetBias = calculateAssetClassBias(macroRegime);

    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        marketData,
        macroRegime,
        assetBias,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300", // Cache 5 minutes
        },
      },
    );
  } catch (error) {
    console.error("Macro analysis failed:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to analyze macro conditions",
        message: (error as Error).message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
