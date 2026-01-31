import { fetchQuote } from "../lib/yahoo";

export default async function handler(request: Request) {
  try {
    const url = new URL(request.url);
    const symbol = url.searchParams.get("symbol");

    if (!symbol) {
      return new Response(JSON.stringify({ error: "Symbol is required" }), {
        status: 400,
      });
    }

    // Fetch quote data from Yahoo Finance API via service
    const quote = await fetchQuote(symbol);
    if (!quote) return new Response(JSON.stringify({ error: "No data found" }), { status: 404 });

    return new Response(JSON.stringify(quote), {
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
