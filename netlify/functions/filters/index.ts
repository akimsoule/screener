import type { Context } from "@netlify/functions";
import { prisma } from "../lib/prisma";

export default async function handler(request: Request, context: Context) {
  try {
    // Get distinct non-null values for each enrichment field
    const sectorsRows = await prisma.symbol.findMany({
      where: { sector: { not: null } },
      distinct: ["sector"],
      select: { sector: true },
    });

    const industriesRows = await prisma.symbol.findMany({
      where: { industry: { not: null } },
      distinct: ["industry"],
      select: { industry: true },
    });

    const exchangesRows = await prisma.symbol.findMany({
      where: { exchange: { not: null } },
      distinct: ["exchange"],
      select: { exchange: true },
    });

    const typesRows = await prisma.symbol.findMany({
      where: { type: { not: null } },
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
