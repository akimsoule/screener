import { fetchChart } from "../lib/provider/dataProvider";

export default async function handler(request: Request) {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;
    const symbol = params.get("symbol");
    const interval = params.get("interval") || "1d";
    const range = params.get("range") || "1y";

    if (!symbol) {
      return new Response(JSON.stringify({ error: "Symbol is required" }), {
        status: 400,
      });
    }

    // Map interval to Yahoo Finance format
    const yahooInterval =
      interval === "1d"
        ? "1d"
        : interval === "1wk"
          ? "1wk"
          : interval === "1mo"
            ? "1mo"
            : "1d";

    // Map range to Yahoo Finance format
    const yahooRange =
      range === "1y"
        ? "1y"
        : range === "2y"
          ? "2y"
          : range === "5y"
            ? "5y"
            : "1y";

    const result = await fetchChart(symbol, yahooInterval, yahooRange);
    if (!result)
      return new Response(JSON.stringify({ error: "No data found" }), {
        status: 404,
      });

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};

    const prices = timestamps
      .map((timestamp: number, index: number) => ({
        date: new Date(timestamp * 1000).toISOString(),
        open: quotes.open?.[index] || 0,
        high: quotes.high?.[index] || 0,
        low: quotes.low?.[index] || 0,
        close: quotes.close?.[index] || 0,
        volume: quotes.volume?.[index] || 0,
      }))
      .filter(
        (candle: any) =>
          candle.open &&
          candle.high &&
          candle.low &&
          candle.close &&
          !Number.isNaN(candle.open) &&
          !Number.isNaN(candle.high) &&
          !Number.isNaN(candle.low) &&
          !Number.isNaN(candle.close),
      );

    return new Response(JSON.stringify(prices), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
    });
  }
}
