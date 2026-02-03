import { fetchQuote } from "../lib/provider/dataProvider";

export default async function handler(request: Request) {
  let symbol: string | null = null;

  try {
    const url = new URL(request.url);
    symbol = url.searchParams.get("symbol");

    console.log(`Quote request for symbol: ${symbol}`);

    if (!symbol) {
      return new Response(JSON.stringify({ error: "Symbol is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch quote data from Yahoo Finance API via service
    const quote = await fetchQuote(symbol);
    console.log(`Quote result for ${symbol}:`, quote);
    if (!quote) {
      console.error(`No quote data found for symbol: ${symbol}`);
      return new Response(
        JSON.stringify({ error: `No quote data available for ${symbol}` }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify(quote), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error(`Quote API error${symbol ? ` for ${symbol}` : ""}:`, error);
    return new Response(
      JSON.stringify({
        error: (error as Error).message || "Failed to fetch quote",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
