import type { Context } from "@netlify/functions";
import { prisma } from "../lib/prisma";
import { requireAuth, extractToken, verifyToken } from "../lib/auth";
import { fetchSymbolDetails } from "../lib/yahoo";
import { cache } from "../lib/cache";

export default async function handler(request: Request, context: Context) {
  try {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // GET : Récupérer les symboles (populaires + watchlist si connecté)
    if (method === "GET") {
      const token = extractToken(request);
      const user = token ? verifyToken(token) : null;

      if (user) {
        // Utilisateur connecté : symboles populaires + sa watchlist
        const [popularSymbols, userWatchlist] = await Promise.all([
          prisma.symbol.findMany({
            where: { isPopular: true },
            select: {
              id: true,
              name: true,
              enabled: true,
              isPopular: true,
              sector: true,
              industry: true,
              exchange: true,
              type: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
          prisma.watchlist.findMany({
            where: { userId: user.userId },
            include: {
              symbol: {
                select: {
                  id: true,
                  name: true,
                  enabled: true,
                  isPopular: true,
                  sector: true,
                  industry: true,
                  exchange: true,
                  type: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          }),
        ]);

        // Fusionner et dédupliquer
        const symbolsMap = new Map();

        popularSymbols.forEach((s) => {
          symbolsMap.set(s.id, { ...s, inWatchlist: false });
        });

        userWatchlist.forEach((w) => {
          if (symbolsMap.has(w.symbol.id)) {
            symbolsMap.set(w.symbol.id, { ...w.symbol, inWatchlist: true });
          } else {
            symbolsMap.set(w.symbol.id, { ...w.symbol, inWatchlist: true });
          }
        });

        const symbols = Array.from(symbolsMap.values());

        return new Response(
          JSON.stringify({ symbols, user: { email: user.email } }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      } else {
        // Non connecté : seulement les symboles populaires
        const symbols = await prisma.symbol.findMany({
          where: { isPopular: true },
          select: {
            id: true,
            name: true,
            enabled: true,
            isPopular: true,
            sector: true,
            industry: true,
            exchange: true,
            type: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return new Response(JSON.stringify({ symbols, user: null }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // POST : Ajouter un symbole à la watchlist (AUTH REQUIS)
    if (method === "POST") {
      const user = requireAuth(request);
      const { name } = await request.json();

      if (!name) {
        return new Response(JSON.stringify({ error: "Symbol name required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Vérifier si le symbole existe, sinon le créer avec enrichissement
      let symbol = await prisma.symbol.findUnique({ where: { name } });

      if (!symbol) {
        // Enrichir avec Yahoo
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

        symbol = await prisma.symbol.create({
          data: { name, enabled: true, isPopular: false, ...enrichmentData },
        });
      }

      // Ajouter à la watchlist de l'utilisateur
      const watchlist = await prisma.watchlist.upsert({
        where: {
          userId_symbolId: {
            userId: user.userId,
            symbolId: symbol.id,
          },
        },
        update: {},
        create: {
          userId: user.userId,
          symbolId: symbol.id,
        },
        include: { symbol: true },
      });

      // Invalider le cache
      cache.clear();

      return new Response(JSON.stringify(watchlist), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // DELETE : Retirer un symbole de la watchlist (AUTH REQUIS)
    if (method === "DELETE") {
      const user = requireAuth(request);
      const { symbolId } = await request.json();

      if (!symbolId) {
        return new Response(JSON.stringify({ error: "Symbol ID required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      await prisma.watchlist.delete({
        where: {
          userId_symbolId: {
            userId: user.userId,
            symbolId,
          },
        },
      });

      // Invalider le cache
      cache.clear();

      return new Response(null, {
        status: 204,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

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
