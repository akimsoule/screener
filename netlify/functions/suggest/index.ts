import { fetchSuggestions } from "../../app/lib/data";
import type { SymbolType } from "../../app/lib/data";

export default async function handler(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const rawType = url.searchParams.get("type");
    const symbolType = (rawType as SymbolType) || "US_STOCK";

    if (!q) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const suggestions = await fetchSuggestions(q, symbolType);

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("suggest function error:", err);
    return new Response(JSON.stringify({ suggestions: [] }), { status: 500 });
  }
}
