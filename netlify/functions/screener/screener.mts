import type { Context } from "@netlify/functions";
import runAnalysis from "../app/index";
import { prisma } from "../lib/prisma";

export default async function handler(request: Request, context: Context) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const limit = Math.max(1, Number(url.searchParams.get("limit") || "20"));

    const result = await runAnalysis();
    const allReports = result.reports || [];
    // Parse filters from query params (comma-separated lists)
    const parseList = (key: string) => {
      const v = url.searchParams.get(key);
      if (!v) return [] as string[];
      return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    };

    const sectors = parseList("sector");
    const industries = parseList("industry");
    const exchanges = parseList("exchange");
    const types = parseList("type");

    // If any filters are present, load symbol metadata from the DB to apply server-side filtering
    let metaByName: Record<string, any> = {};
    if (
      sectors.length ||
      industries.length ||
      exchanges.length ||
      types.length
    ) {
      const names = Array.from(
        new Set(allReports.map((r: any) => (r.symbol || "").toUpperCase())),
      ).filter(Boolean);
      const rows = await prisma.symbol.findMany({
        where: { name: { in: names } },
        select: {
          name: true,
          sector: true,
          industry: true,
          exchange: true,
          type: true,
        },
      });
      rows.forEach((row) => {
        metaByName[row.name.toUpperCase()] = row;
      });
    }
    // Apply server-side filters (OR within group, AND across groups)
    const filtered = allReports.filter((r: any) => {
      if (
        !sectors.length &&
        !industries.length &&
        !exchanges.length &&
        !types.length
      )
        return true;
      const name = (r.symbol || "").toUpperCase();
      const meta = metaByName[name] || {};

      const check = (values: string[], field?: string) => {
        // For OR-across-groups semantics we treat an inactive group as not contributing (false),
        // and only active groups can satisfy the check.
        if (!values.length) return false;
        const v = (meta[field || ""] || "") as string;
        if (!v) return false;
        // compare case-insensitive
        return values.some((s) => s.toUpperCase() === v.toUpperCase());
      };

      const okSector = check(sectors, "sector");
      const okIndustry = check(industries, "industry");
      const okExchange = check(exchanges, "exchange");
      const okType = check(types, "type");

      // OR across groups: an item is included if it matches any active group
      return okSector || okIndustry || okExchange || okType;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const start = (page - 1) * limit;
    const end = page * limit;
    const reports = filtered.slice(start, end);

    return new Response(
      JSON.stringify({
        date: result.date,
        reports,
        total,
        page,
        limit,
        totalPages,
        errors: result.errors,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
