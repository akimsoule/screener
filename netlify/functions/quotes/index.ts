import type { Context } from "@netlify/functions";
import { fetchQuote } from "../lib/provider/dataProvider";

export default async function handler(request: Request, context: Context) {
  try {
    const url = new URL(request.url);
    const symbolsParam = url.searchParams.get("symbols");

    if (!symbolsParam) {
      return new Response(
        JSON.stringify({ error: "Symbols parameter is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const symbols = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);

    if (symbols.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one symbol is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Fetch all quotes in parallel
    const results = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const quote = await fetchQuote(symbol);
        return { symbol, quote };
      }),
    );

    // Build response object with symbol as key
    const quotes: Record<string, any> = {};
    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value.quote) {
        quotes[result.value.symbol] = result.value.quote;
      }
    });

    return new Response(JSON.stringify(quotes), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Quotes API error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
