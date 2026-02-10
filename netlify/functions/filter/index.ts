import type { Context } from "@netlify/functions";
import { filterService } from "../../app/analysis/services/filterService";

export default async function handler(request: Request, context: Context) {
  try {
    // Only GET
    if (request.method.toUpperCase() !== "GET") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Delegate to service (service manages cache if needed)
    const result = await filterService.getAvailableFilters();
    return new Response(JSON.stringify({ ...result }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Filter endpoint failed:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
