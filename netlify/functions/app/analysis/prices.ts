// prices.ts
// Retrieve price series from Yahoo Finance
import { fetchOHLC, fetchQuote } from "../../lib/provider/yahoo";
import type { OHLC } from "./types";

export async function getPrices(
  symbol: string,
  interval: "1d" | "1wk",
): Promise<OHLC[]> {
  try {
    const range = interval === "1d" ? "1y" : "2y";
    const data = await fetchOHLC(symbol, interval, range);
    console.log(`📊 ${symbol} (${interval}): ${data.length} candles reçues`);
    return data;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error(`❌ getPrices(${symbol}, ${interval}) failed:`, errorMessage);
    // Ne pas supprimer automatiquement - peut être temporaire
    return [];
  }
}

export async function getMarketData(symbol: string) {
  try {
    return await fetchQuote(symbol);
  } catch (e) {
    console.error(`getMarketData(${symbol}) failed:`, e);
    return { price: 0 };
  }
}

export default getPrices;
