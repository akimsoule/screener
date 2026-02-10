import type { Context } from "@netlify/functions";
import { pennyService } from "../../app/analysis/services/pennyService";

export default async function handler(request: Request, context: Context) {
  try {
    const url = new URL(request.url);
    const limit = Math.max(
      1,
      Math.min(200, Number.parseInt(url.searchParams.get("limit") || "50", 10)),
    );
    const minMarketCap = url.searchParams.get("minMarketCap")
      ? Number.parseFloat(url.searchParams.get("minMarketCap")!)
      : undefined;
    const maxMarketCap = url.searchParams.get("maxMarketCap")
      ? Number.parseFloat(url.searchParams.get("maxMarketCap")!)
      : undefined;

    // Try in-memory/db cache via service helper
    const cachedResults = await pennyService.getCachedResults();

    // If no cache, return empty with cached=false
    if (!cachedResults) {
      return new Response(
        JSON.stringify({ pennystocks: [], cached: false, cacheTs: null }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Apply optional market cap filters
    let results = cachedResults;

    if (minMarketCap !== undefined) {
      results = results.filter(
        (r) => (r.dailyDollarVolume ?? 0) >= minMarketCap,
      );
    }
    if (maxMarketCap !== undefined) {
      results = results.filter(
        (r) => (r.dailyDollarVolume ?? 0) <= maxMarketCap,
      );
    }

    // Apply limit
    results = results.slice(0, limit);

    return new Response(
      JSON.stringify({ pennystocks: results, cached: false, cacheTs: null }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("pennystocks error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
