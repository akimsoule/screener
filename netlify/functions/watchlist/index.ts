import type { Context } from "@netlify/functions";
import { watchlistService } from "../../app/analysis/services/watchlistService";
import { filterService } from "../../app/analysis/services/filterService";

async function handleGetSymbols(request: Request) {
  const url = new URL(request.url);

  // Parse and validate filters via FilterService (delegates validation to service)
  const parsed = await filterService.parseFilterParams(url.searchParams);
  const filters = parsed.options;
  const scoreMin = parsed.scoreMin;
  const scoreMax = parsed.scoreMax;
  const page = parsed.page;
  const limit = parsed.limit;

  // Delegate computation to WatchlistService (services own cache). Do not read/write cache here.
  try {
    // If score filters are present, retrieve a large page from the service and apply score filters in REST layer
    if (scoreMin !== undefined || scoreMax !== undefined) {
      const fetchAllLimit = 10000; // reasonable upper bound
      const all = await watchlistService.getWatchlist(
        filters,
        1,
        fetchAllLimit,
      );

      const filteredByScore = (all.data || []).filter((item: any) => {
        let s = 0;
        if (typeof item.lastScore === "number") s = item.lastScore;
        else if (item.lastScore)
          s = Number.parseFloat(String(item.lastScore)) || 0;

        if (scoreMin !== undefined && s < scoreMin) return false;
        if (scoreMax !== undefined && s > scoreMax) return false;
        return true;
      });

      const total = filteredByScore.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const pageItems = filteredByScore.slice((page - 1) * limit, page * limit);

      const result = {
        data: pageItems,
        pagination: { page, limit, total, totalPages },
        appliedFilters: { ...filters, scoreMin, scoreMax },
      } as any;

      return new Response(
        JSON.stringify({
          ...result,
          cached: (all as any).cached ?? false,
          cacheTs: (all as any).cacheTs ?? null,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // No score filters — rely on the service pagination
    const result = await watchlistService.getWatchlist(filters, page, limit);

    return new Response(
      JSON.stringify({
        ...result,
        cached: (result as any).cached ?? false,
        cacheTs: (result as any).cacheTs ?? null,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (err) {
    console.error("Watchlist computation failed:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

async function handlePostSymbol(request: Request) {
  // POST/PUT not allowed on /watchlist — endpoint is read-only and cache-backed
  return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleDeleteSymbol(request: Request) {
  // DELETE not allowed on /watchlist — endpoint is read-only and cache-backed
  return new Response(null, {
    status: 405,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

export default async function handler(request: Request, context: Context) {
  try {
    const method = request.method.toUpperCase();

    if (method === "GET") return handleGetSymbols(request);
    if (method === "POST") return handlePostSymbol(request);
    if (method === "DELETE") return handleDeleteSymbol(request);

    return new Response("Method Not Allowed", { status: 405 });
  } catch (error) {
    console.error("Watchlist error:", error);

    if (
      (error as Error).message.includes("Authentication required") ||
      (error as Error).message.includes("Invalid token")
    ) {
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
