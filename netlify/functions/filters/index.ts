import type { Context } from "@netlify/functions";
import { prisma } from "../lib/prisma";
import { verifyToken } from "../lib/auth";

export default async function handler(request: Request, context: Context) {
  try {
    // Vérifier l'authentification
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    let userId: string | null = null;

    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        userId = payload.userId;
      }
    }

    // Construire la clause WHERE selon l'authentification
    let symbolIds: string[] = [];

    if (userId) {
      // Utilisateur connecté : symboles populaires + sa watchlist
      const [popularSymbols, watchlistSymbols] = await Promise.all([
        prisma.symbol.findMany({
          where: { isPopular: true, enabled: true },
          select: { id: true },
        }),
        prisma.watchlist.findMany({
          where: { userId },
          select: { symbolId: true },
        }),
      ]);

      const popularIds = popularSymbols.map((s) => s.id);
      const watchlistIds = watchlistSymbols.map((w) => w.symbolId);
      symbolIds = [...new Set([...popularIds, ...watchlistIds])];
    } else {
      // Non connecté : uniquement symboles populaires
      const popularSymbols = await prisma.symbol.findMany({
        where: { isPopular: true, enabled: true },
        select: { id: true },
      });
      symbolIds = popularSymbols.map((s) => s.id);
    }

    // Get distinct non-null values for each enrichment field
    const sectorsRows = await prisma.symbol.findMany({
      where: {
        id: { in: symbolIds },
        sector: { not: null },
      },
      distinct: ["sector"],
      select: { sector: true },
    });

    const industriesRows = await prisma.symbol.findMany({
      where: {
        id: { in: symbolIds },
        industry: { not: null },
      },
      distinct: ["industry"],
      select: { industry: true },
    });

    const exchangesRows = await prisma.symbol.findMany({
      where: {
        id: { in: symbolIds },
        exchange: { not: null },
      },
      distinct: ["exchange"],
      select: { exchange: true },
    });

    const typesRows = await prisma.symbol.findMany({
      where: {
        id: { in: symbolIds },
        type: { not: null },
      },
      distinct: ["type"],
      select: { type: true },
    });

    const sectors = sectorsRows.map((r) => r.sector!).filter(Boolean);
    const industries = industriesRows.map((r) => r.industry!).filter(Boolean);
    const exchanges = exchangesRows.map((r) => r.exchange!).filter(Boolean);
    const types = typesRows.map((r) => r.type!).filter(Boolean);

    return new Response(
      JSON.stringify({ sectors, industries, exchanges, types }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
