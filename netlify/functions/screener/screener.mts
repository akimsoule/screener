import type { Context } from "@netlify/functions";
import runAnalysis from "../app/index";
import { prisma } from "../lib/prisma";
import { SERVER_PAGE_LIMIT } from "../lib/constants";

export default async function handler(request: Request, context: Context) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const limit = Math.max(
      1,
      Number(url.searchParams.get("limit") || String(SERVER_PAGE_LIMIT)),
    );

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
    const actions = parseList("action");

    // If any filters are present, load symbol metadata from the DB to apply server-side filtering
    // Note: action is filtered from report directly, not from DB
    let metaByName: Record<string, any> = {};
    if (
      sectors.length ||
      industries.length ||
      exchanges.length ||
      types.length
    ) {
      const names = Array.from(
        new Set(allReports.map((r: any) => (r.symbol || "").toUpperCase())),
      ).filter(Boolean) as string[];
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
        !types.length &&
        !actions.length
      )
        return true;
      const name = (r.symbol || "").toUpperCase();
      const meta = metaByName[name] || {};

      const check = (values: string[], field?: string) => {
        if (!values.length) return null; // groupe inactif
        const v = (meta[field || ""] || "") as string;
        if (!v) return false; // pas de valeur dans la BD
        // compare case-insensitive
        return values.some((s) => s.toUpperCase() === v.toUpperCase());
      };

      // Check action directly from report (not from DB)
      const checkAction = (values: string[]) => {
        if (!values.length) return null; // groupe inactif
        const reportAction = (r.action || "") as string;
        if (!reportAction) return false; // pas d'action dans le report
        // compare case-insensitive
        return values.some(
          (s) => s.toUpperCase() === reportAction.toUpperCase(),
        );
      };

      const okSector = check(sectors, "sector");
      const okIndustry = check(industries, "industry");
      const okExchange = check(exchanges, "exchange");
      const okType = check(types, "type");
      const okAction = checkAction(actions);

      // OR across groups: item inclus si au moins un groupe actif match
      const activeChecks = [
        okSector,
        okIndustry,
        okExchange,
        okType,
        okAction,
      ].filter((v) => v !== null);
      if (activeChecks.length === 0) return true; // aucun filtre actif
      return activeChecks.includes(true);
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
