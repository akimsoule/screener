import { prisma } from "../lib/prisma";
import { fetchSymbolDetails } from "../lib/provider/dataProvider";
import { cache } from "../lib/cache";

/**
 * @deprecated Use /watchlist instead
 * This endpoint is kept for backward compatibility
 */
export default async function handler(request: Request) {
  console.warn("⚠️ /symbols endpoint is deprecated. Use /watchlist instead.");

  try {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === "GET") {
      // Retourner TOUS les symboles (pour compatibilité)
      const symbols = await prisma.symbol.findMany({
        select: {
          id: true,
          name: true,
          enabled: true,
          sector: true,
          industry: true,
          exchange: true,
          type: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return new Response(JSON.stringify(symbols), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (method === "POST") {
      const { name, enabled = true } = await request.json();

      // Enrichir avec les détails Yahoo lors de la création
      let enrichmentData = {};
      try {
        const details = await fetchSymbolDetails(name);
        if (details) {
          enrichmentData = {
            sector: details.sector || null,
            industry: details.industry || null,
            exchange: details.exchange || null,
            type: details.type || null,
          };
        }
      } catch (err) {
        console.warn(`Could not fetch details for ${name}:`, err);
      }

      const symbol = await prisma.symbol.create({
        data: { name, enabled, ...enrichmentData },
      });

      // Invalider le cache d'analyse
      cache.clear();

      return new Response(JSON.stringify(symbol), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (method === "PUT") {
      const { id, name, enabled } = await request.json();
      const symbol = await prisma.symbol.update({
        where: { id },
        data: { name, enabled },
      });

      // Invalider le cache d'analyse
      cache.clear();

      return new Response(JSON.stringify(symbol), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (method === "DELETE") {
      const { id } = await request.json();
      await prisma.symbol.delete({ where: { id } });

      // Invalider le cache d'analyse
      cache.clear();

      return new Response(null, {
        status: 204,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response("Method Not Allowed", { status: 405 });
  } catch (error) {
    console.error("Error in symbols function:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
    });
  }
}
