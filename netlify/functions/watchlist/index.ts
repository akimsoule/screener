import type { Context } from "@netlify/functions";
import { prisma } from "../lib/prisma";
import { requireAuth, extractToken, verifyToken } from "../lib/auth";
import { fetchSymbolDetails } from "../lib/provider/dataProvider";
import { cache } from "../lib/cache";
import { MUST_BE_AUTHENTICATED } from "../lib/constants";

interface SymbolDetails {
  symbol: string;
  name: string;
  exchange: string;
  industry: string;
  sector: string;
  type: string;
}

const SYMBOL_SELECT = {
  id: true,
  name: true,
  enabled: true,
  isPopular: true,
  sector: true,
  industry: true,
  exchange: true,
  type: true,
  action: true,
  createdAt: true,
  updatedAt: true,
};

async function handleGetSymbols(request: Request) {
  const token = extractToken(request);
  const user = token ? verifyToken(token) : null;

  // En mode sans authentification, charger tous les symboles pour l'utilisateur anonyme
  if (!MUST_BE_AUTHENTICATED) {
    const [popularSymbols, anonymousWatchlist] = await Promise.all([
      prisma.symbol.findMany({
        where: { isPopular: true },
        select: SYMBOL_SELECT,
      }),
      prisma.watchlist.findMany({
        where: { userId: "anonymous" },
        include: {
          symbol: { select: SYMBOL_SELECT },
        },
      }),
    ]);

    const symbolsMap = new Map();
    popularSymbols.forEach((s) => {
      symbolsMap.set(s.id, { ...s, inWatchlist: false });
    });
    anonymousWatchlist.forEach((w) => {
      symbolsMap.set(w.symbol.id, { ...w.symbol, inWatchlist: true });
    });

    const symbols = Array.from(symbolsMap.values());
    return new Response(
      JSON.stringify({ symbols, user: { email: "anonymous@localhost" } }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  if (user) {
    const [popularSymbols, userWatchlist] = await Promise.all([
      prisma.symbol.findMany({
        where: { isPopular: true },
        select: SYMBOL_SELECT,
      }),
      prisma.watchlist.findMany({
        where: { userId: user.userId },
        include: {
          symbol: { select: SYMBOL_SELECT },
        },
      }),
    ]);

    const symbolsMap = new Map();
    popularSymbols.forEach((s) => {
      symbolsMap.set(s.id, { ...s, inWatchlist: false });
    });
    userWatchlist.forEach((w) => {
      symbolsMap.set(w.symbol.id, { ...w.symbol, inWatchlist: true });
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
  }

  const symbols = await prisma.symbol.findMany({
    where: { isPopular: true },
    select: SYMBOL_SELECT,
  });

  return new Response(JSON.stringify({ symbols, user: null }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function handlePostSymbol(request: Request) {
  const user = requireAuth(request);
  const { name } = await request.json();

  if (!name) {
    return new Response(JSON.stringify({ error: "Symbol name required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // En mode sans authentification, s'assurer que l'utilisateur anonymous existe
  if (!MUST_BE_AUTHENTICATED && user.userId === "anonymous") {
    const existingUser = await prisma.user.findUnique({
      where: { id: "anonymous" },
    });

    if (!existingUser) {
      await prisma.user.create({
        data: {
          id: "anonymous",
          email: "anonymous@localhost",
          password: "no-password", // Pas utilisé en mode sans auth
          name: "Anonymous User",
        },
      });
    }
  }

  let symbol = await prisma.symbol.findUnique({ where: { name } });

  if (!symbol) {
    let enrichmentData = {};
    try {
      const details = (await fetchSymbolDetails(name)) as SymbolDetails | null;
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

  cache.clear();

  return new Response(JSON.stringify(watchlist), {
    status: 201,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function handleDeleteSymbol(request: Request) {
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

  cache.clear();

  return new Response(null, {
    status: 204,
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
