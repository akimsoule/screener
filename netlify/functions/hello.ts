import YahooFinance from "yahoo-finance2";
import { RSI, SMA, MACD } from "technicalindicators";

// Initialisation de YahooFinance v3
const yahooFinance = new YahooFinance();

// Liste de vos symboles sur Wealthsimple
const SYMBOLS = ["GOLD", "GDXU"];
const SCORE_THRESHOLD = 2;

interface AnalysisReport {
  symbol: string;
  score: number;
  action: "ACHAT" | "VENTE" | "ATTENTE";
  details: { price: number; rsi: number; trend: string };
}

async function getPrices(symbol: string, interval: "1d" | "1wk") {
  try {
    const data = await yahooFinance.chart(symbol, {
      interval,
      period1: "2023-01-01",
    });
    const quotes = (data as any).quotes || [];
    return quotes
      .map((q: any) => q.close)
      .filter((v: any): v is number => v !== null && !Number.isNaN(v));
  } catch (e) {
    console.error(`getPrices(${symbol}, ${interval}) failed:`, e);
    return [];
  }
}

async function analyzeSymbol(symbol: string): Promise<AnalysisReport> {
  const [dailyPrices, weeklyPrices] = await Promise.all([
    getPrices(symbol, "1d"),
    getPrices(symbol, "1wk"),
  ]);

  if (dailyPrices.length < 50)
    throw new Error(`Données insuffisantes for ${symbol}`);

  let score = 0;
  const lastPrice = dailyPrices[dailyPrices.length - 1];

  // 1. RSI Quotidien (Poids 2)
  const rsi = RSI.calculate({ values: dailyPrices, period: 14 });
  const lastRSI = rsi[rsi.length - 1];
  if (lastRSI < 30) score += 2;
  else if (lastRSI > 70) score -= 2;

  // 2. Tendance Hebdomadaire (Poids 1) - SMA 20
  const sma20W = SMA.calculate({ values: weeklyPrices, period: 20 });
  const trend =
    weeklyPrices[weeklyPrices.length - 1] > sma20W[sma20W.length - 1]
      ? "BULL"
      : "BEAR";
  score += trend === "BULL" ? 1 : -1;

  // 3. MACD Quotidien (Poids 1)
  const macd = MACD.calculate({
    values: dailyPrices,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const lastM = macd[macd.length - 1];
  if (lastM.MACD! > lastM.signal!) score += 1;
  else score -= 1;

  let action: AnalysisReport["action"];
  if (score >= SCORE_THRESHOLD) action = "ACHAT";
  else if (score <= -SCORE_THRESHOLD) action = "VENTE";
  else action = "ATTENTE";

  return {
    symbol,
    score,
    action,
    details: { price: lastPrice, rsi: lastRSI, trend },
  };
}

export async function handler(event: any, context: any) {
  try {
    console.log(`--- Analyse du ${new Date().toLocaleDateString()} ---`);

    const results = await Promise.allSettled(
      SYMBOLS.map((s) => analyzeSymbol(s)),
    );

    const reports: AnalysisReport[] = [];
    const errors: string[] = [];

    results.forEach((res) => {
      if (res.status === "fulfilled") {
        reports.push(res.value);
      } else {
        errors.push(res.reason.message);
      }
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
      body: JSON.stringify({
        date: new Date().toISOString(),
        reports,
        errors,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}
