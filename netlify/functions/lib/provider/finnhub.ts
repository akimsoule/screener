// Small Finnhub service for Netlify functions
import { cache } from "../cache";

interface ChartResult {
  timestamp: number[];
  indicators: {
    quote: Array<{
      open: number[];
      high: number[];
      low: number[];
      close: number[];
      volume: number[];
    }>;
  };
  meta: { symbol: string };
}

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const API_KEY = process.env.FINNHUB_API_KEY || "";

// Cache TTL en secondes
const CACHE_TTL = {
  CHART: 300, // 5 minutes pour les données de chart
  QUOTE: 60, // 1 minute pour les quotes en temps réel
  SUGGESTIONS: 3600, // 1 heure pour les suggestions
  DETAILS: 86400, // 24 heures pour les détails de symboles
};

// Mapping des symboles Yahoo vers Finnhub pour les cryptos et autres cas spéciaux
function mapSymbolToFinnhub(symbol: string): string {
  // Mapping explicite pour cryptos et futures
  const explicitMap: Record<string, string> = {
    "BTC-USD": "BINANCE:BTCUSDT",
    "ETH-USD": "BINANCE:ETHUSDT",
    "XRP-USD": "BINANCE:XRPUSDT",
    "GC=F": "OANDA:XAU_USD", // Gold futures
  };

  if (explicitMap[symbol]) {
    return explicitMap[symbol];
  }

  // Nettoyer les suffixes Yahoo Finance
  // .TO = Toronto Stock Exchange
  // .V = TSX Venture Exchange
  // .NE = NEO Exchange
  // =F = Futures
  let cleaned = symbol
    .replace(/\.TO$/i, "")
    .replace(/\.V$/i, "")
    .replace(/\.NE$/i, "")
    .replace(/=F$/i, "");

  return cleaned;
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Rate limited, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (!res.ok)
        throw new Error(`Finnhub API error: ${res.status} ${res.statusText}`);
      return res;
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 500;
        console.warn(
          `Fetch attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError || new Error("Max retries exceeded");
}

function mapIntervalToResolution(interval: string): string {
  switch (interval) {
    case "1d":
      return "D";
    case "1wk":
      return "W";
    case "1mo":
      return "M";
    default:
      return "D";
  }
}

function rangeToFrom(range: string): { from: number; to: number } {
  const to = Math.floor(Date.now() / 1000);
  let days = 365;
  if (range === "2y") days = 365 * 2;
  else if (range === "5y") days = 365 * 5;
  else if (range === "6mo") days = 180;
  return { from: to - days * 24 * 3600, to };
}

export async function fetchChart(
  symbol: string,
  interval = "1d",
  range = "1y",
): Promise<ChartResult | null> {
  const cacheKey = `chart:${symbol}:${interval}:${range}`;
  const cached = cache.get<ChartResult>(cacheKey);
  if (cached) return cached;

  const finnhubSymbol = mapSymbolToFinnhub(symbol);
  const resolution = mapIntervalToResolution(interval);
  const { from, to } = rangeToFrom(range);
  const url = `${FINNHUB_BASE}/stock/candle?symbol=${encodeURIComponent(finnhubSymbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${encodeURIComponent(API_KEY)}`;
  const res = await fetchWithRetry(url);
  const data = await res.json();
  if (data.s !== "ok") return null;
  // Convert to Yahoo-like shape
  const result = {
    timestamp: data.t || [],
    indicators: {
      quote: [
        {
          open: data.o || [],
          high: data.h || [],
          low: data.l || [],
          close: data.c || [],
          volume: data.v || [],
        },
      ],
    },
    meta: { symbol },
  };
  cache.set(cacheKey, result, CACHE_TTL.CHART);
  return result;
}

export async function fetchCloses(
  symbol: string,
  interval: string,
  range: string,
): Promise<number[]> {
  const result = await fetchChart(symbol, interval, range);
  if (!result) return [];
  const quotes = result.indicators?.quote?.[0] || {};
  const closes = quotes.close || [];
  return closes.filter((v: any): v is number => v !== null && !Number.isNaN(v));
}

export async function fetchQuote(symbol: string) {
  const cacheKey = `quote:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const finnhubSymbol = mapSymbolToFinnhub(symbol);
  const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(finnhubSymbol)}&token=${encodeURIComponent(API_KEY)}`;
  const res = await fetchWithRetry(url);
  const data = await res.json();

  // Vérifier si les données sont valides
  if (!data || data.c === null || data.c === undefined || data.c === 0) {
    console.warn(`Finnhub returned invalid data for ${symbol}:`, data);
    return null;
  }

  const result = {
    symbol,
    name: symbol,
    price: data.c,
    change: data.d || 0,
    changePercent: data.dp || 0,
    volume: data.v || 0,
    high: data.h || data.c,
    low: data.l || data.c,
    open: data.o || data.c,
    previousClose: data.pc || data.c,
  };
  cache.set(cacheKey, result, CACHE_TTL.QUOTE);
  return result;
}

export async function fetchOHLC(
  symbol: string,
  interval: string,
  range: string,
) {
  const result = await fetchChart(symbol, interval, range);
  if (!result) return [];
  const timestamps = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0] || {};
  const opens = quotes.open || [];
  const highs = quotes.high || [];
  const lows = quotes.low || [];
  const closes = quotes.close || [];
  const volumes = quotes.volume || [];

  const ohlc: any[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] !== null && closes[i] !== undefined) {
      ohlc.push({
        date: new Date(timestamps[i] * 1000).toISOString(),
        open: opens[i] || closes[i],
        high: highs[i] || closes[i],
        low: lows[i] || closes[i],
        close: closes[i],
        volume: volumes[i] || 0,
      });
    }
  }
  return ohlc;
}

export async function fetchSuggestions(query: string) {
  const cacheKey = `suggestions:${query.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = `${FINNHUB_BASE}/search?q=${encodeURIComponent(query)}&token=${encodeURIComponent(API_KEY)}`;
  const res = await fetchWithRetry(url);
  const data = await res.json();
  const result = data.result || [];
  const suggestions = result.map((r: any) => ({
    symbol: r.symbol,
    name: r.description || r.symbol,
    exchange: r.exchange || "",
    type: r.type || "",
    industry: r.currency || "",
    sector: r.type || "",
  }));
  cache.set(cacheKey, suggestions, CACHE_TTL.SUGGESTIONS);
  return suggestions;
}

export async function fetchSymbolDetails(symbol: string): Promise<{
  symbol: string;
  name: string;
  exchange: string;
  industry: string;
  sector: string;
  type: string;
} | null> {
  const cacheKey = `details:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached)
    return cached as {
      symbol: string;
      name: string;
      exchange: string;
      industry: string;
      sector: string;
      type: string;
    };

  // Try profile2 for company metadata
  const url = `${FINNHUB_BASE}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(API_KEY)}`;
  const res = await fetchWithRetry(url);
  const data = await res.json();
  if (!data || Object.keys(data).length === 0) return null;
  const result = {
    symbol: data.ticker || symbol,
    name: data.name || symbol,
    exchange: data.exchange || data.exchangeShortName || "",
    industry: data.finnhubIndustry || "",
    sector: data.finnhubIndustry || "",
    type: "EQUITY",
  };
  cache.set(cacheKey, result, CACHE_TTL.DETAILS);
  return result;
}

export default {
  fetchChart,
  fetchCloses,
  fetchQuote,
  fetchOHLC,
  fetchSuggestions,
  fetchSymbolDetails,
};
