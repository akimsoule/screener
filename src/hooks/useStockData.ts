import { useState, useCallback } from "react";
import { getQuote, getPrices } from "@/lib/netlifyApi";
import type { StockCandle, StockQuote } from "@/types/stock";

export interface StockData {
  candles: StockCandle[];
  quote: StockQuote | null;
  loading: boolean;
}

export function useStockData() {
  const [candles, setCandles] = useState<StockCandle[]>([]);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(false);

  // Helper function to fetch stock quote from Netlify function
  const fetchQuote = async (symbol: string): Promise<StockQuote> => {
    return getQuote(symbol) as Promise<StockQuote>;
  };

  // Helper function to fetch historical data from Netlify function
  const fetchHistoricalData = async (
    symbol: string,
    range: string,
    interval: string,
  ): Promise<StockCandle[]> => {
    return getPrices(
      symbol,
      interval === "daily" ? "1d" : interval === "weekly" ? "1wk" : "1mo",
      range,
    ) as Promise<StockCandle[]>;
  };

  const fetchStockData = useCallback(
    async (symbol: string, interval: string = "daily") => {
      if (!symbol) return;

      setLoading(true);
      try {
        // Fetch quote
        const quoteData = await fetchQuote(symbol);
        // Ensure `change` exists — derive it from `price - previousClose` if missing
        let derivedChange: number | undefined = quoteData.change;
        const prev = quoteData.previousClose;
        if (derivedChange === undefined || derivedChange === null) {
          if (typeof quoteData.price === "number" && typeof prev === "number") {
            derivedChange = quoteData.price - prev;
          }
        }

        // Ensure `changePercent` exists — prefer deriving from `change` and `previousClose`
        let derivedChangePercent: number | undefined = quoteData.changePercent;
        if (
          derivedChangePercent === undefined ||
          derivedChangePercent === null
        ) {
          if (
            typeof derivedChange === "number" &&
            typeof prev === "number" &&
            prev !== 0
          ) {
            derivedChangePercent = (derivedChange / prev) * 100;
          } else if (
            typeof quoteData.price === "number" &&
            typeof prev === "number" &&
            prev !== 0
          ) {
            derivedChangePercent = ((quoteData.price - prev) / prev) * 100;
          }
        }

        setQuote({
          ...quoteData,
          change: typeof derivedChange === "number" ? derivedChange : 0,
          changePercent:
            typeof derivedChangePercent === "number" ? derivedChangePercent : 0,
        });

        // Fetch historical data
        const range =
          interval === "daily" ? "1y" : interval === "weekly" ? "2y" : "5y";
        const yahooInterval =
          interval === "daily" ? "1d" : interval === "weekly" ? "1wk" : "1mo";

        const historicalData = await fetchHistoricalData(
          symbol,
          range,
          yahooInterval,
        );
        setCandles(historicalData);
      } catch (error) {
        console.error("Error fetching stock data:", error);
        setQuote(null);
        setCandles([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    candles,
    quote,
    loading,
    fetchStockData,
  };
}
