import type { Context } from "@netlify/functions";
import { cache } from "../../app/lib/cache";
import { logger } from "../../app/lib/logger";

export default async function handler(request: Request, context: Context) {
  try {
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // No header-based protection — application is public (free)

    // Clear only in-memory cache (do not delete DB cache)
    cache.clear();
    logger.info("🧹 Memory cache cleared via /refresh endpoint");

    return new Response(JSON.stringify({ ok: true, cleared: "memory" }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    logger.error(
      "/refresh failed:",
      err instanceof Error ? err.message : String(err),
    );
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
