// Hybrid data provider: Yahoo Finance (primary) with Finnhub fallback
import { cache } from "../cache";
import * as yahoo from "./yahoo";
import * as finnhub from "./finnhub";

interface QuoteResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  dayHigh: number;
  dayLow: number;
  yearHigh?: number;
  yearLow?: number;
  marketCap?: number;
}

const CACHE_TTL = {
  CHART: 300, // 5 minutes
  QUOTE: 60, // 1 minute
  SUGGESTION: 3600, // 1 hour
  SYMBOL_DETAILS: 86400, // 24 hours
};

export async function fetchChart(
  symbol: string,
  interval = "1d",
  range = "1y",
) {
  const cacheKey = `chart:${symbol}:${interval}:${range}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // Try Yahoo first
  try {
    const result = await yahoo.fetchChart(symbol, interval, range);
    if (result) {
      cache.set(cacheKey, result, CACHE_TTL.CHART);
      return result;
    }
  } catch (error) {
    console.warn(`Yahoo chart failed for ${symbol}, trying Finnhub...`, error);
  }

  // Fallback to Finnhub
  try {
    const result = await finnhub.fetchChart(symbol, interval, range);
    if (result) {
      cache.set(cacheKey, result, CACHE_TTL.CHART);
      return result;
    }
  } catch (error) {
    console.error(`Both providers failed for chart ${symbol}:`, error);
  }

  return null;
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

  // Try Yahoo first
  try {
    const result = (await yahoo.fetchQuote(symbol)) as QuoteResult | null;
    if (result && result.price > 0) {
      cache.set(cacheKey, result, CACHE_TTL.QUOTE);
      return result;
    }
  } catch (error) {
    console.warn(`Yahoo quote failed for ${symbol}, trying Finnhub...`, error);
  }

  // Fallback to Finnhub
  try {
    const result = (await finnhub.fetchQuote(symbol)) as QuoteResult | null;
    if (result && result.price > 0) {
      cache.set(cacheKey, result, CACHE_TTL.QUOTE);
      return result;
    }
  } catch (error) {
    console.error(`Both providers failed for quote ${symbol}:`, error);
  }

  return null;
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
  // Try Yahoo first
  try {
    const result = await yahoo.fetchSuggestions(query);
    if (result && result.length > 0) return result;
  } catch (error) {
    console.warn(
      `Yahoo suggestions failed for ${query}, trying Finnhub...`,
      error,
    );
  }

  // Fallback to Finnhub
  try {
    return await finnhub.fetchSuggestions(query);
  } catch (error) {
    console.error(`Both providers failed for suggestions ${query}:`, error);
    return [];
  }
}

export async function fetchSymbolDetails(symbol: string) {
  // Try Yahoo first
  try {
    const result = await yahoo.fetchSymbolDetails(symbol);
    if (result) return result;
  } catch (error) {
    console.warn(
      `Yahoo details failed for ${symbol}, trying Finnhub...`,
      error,
    );
  }

  // Fallback to Finnhub
  try {
    return await finnhub.fetchSymbolDetails(symbol);
  } catch (error) {
    console.error(`Both providers failed for details ${symbol}:`, error);
    return null;
  }
}

export default {
  fetchChart,
  fetchCloses,
  fetchQuote,
  fetchOHLC,
  fetchSuggestions,
  fetchSymbolDetails,
};
