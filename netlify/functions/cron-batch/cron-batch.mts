import type { Config } from "@netlify/functions";
import { analysisService } from "../../app/analysis/services/analysisService";
import { fetchRealMacroData } from "../../app/analysis/services/macroDataService";
import { prisma } from "../../app/lib/prisma";

async function handler(req: Request) {
  try {
    // No header-based protection — application is public (free)

    const start = Date.now();

    // 1. Find up to 20 symbols stale or never analyzed
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000);

    const symbols = await prisma.symbol.findMany({
      where: {
        enabled: true,
        OR: [{ analyzedAt: null }, { analyzedAt: { lt: staleThreshold } }],
      },
      orderBy: [{ analyzedAt: "asc" }],
      take: 20,
    });

    if (symbols.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, total: 0, success: 0, errors: 0 }),
        { status: 200 },
      );
    }

    const realMacro = await fetchRealMacroData();
    const { _metadata, ...marketData } = realMacro;
    const vixValue = (_metadata as any)?.vix ?? 0;

    const results = await Promise.allSettled(
      symbols.map(async (symbol: any) => {
        try {
          const analysis = await analysisService.analyzeSymbolWithMacro(
            symbol.name,
            marketData as any,
            { riskConfig: { vixValue } },
          );
          await prisma.symbol.update({
            where: { id: symbol.id },
            data: { analyzedAt: new Date() },
          });
          return { success: true, symbol: symbol.name, analysis };
        } catch (error) {
          console.error(`❌ Error analyzing ${symbol.name}:`, error);
          await prisma.symbol.update({
            where: { id: symbol.id },
            data: { analyzedAt: new Date() },
          });
          return {
            success: false,
            symbol: symbol.name,
            error: (error as Error).message || String(error),
          };
        }
      }),
    );

    const stats = {
      total: symbols.length,
      success: results.filter(
        (r: PromiseSettledResult<any>) =>
          r.status === "fulfilled" &&
          (r as PromiseFulfilledResult<any>).value.success,
      ).length,
      errors: results.filter(
        (r: PromiseSettledResult<any>) =>
          r.status === "rejected" ||
          (r.status === "fulfilled" &&
            !(r as PromiseFulfilledResult<any>).value.success),
      ).length,
      durationMs: Date.now() - start,
    };

    return new Response(JSON.stringify({ ok: true, ...stats }), {
      status: 200,
    });
  } catch (error) {
    console.error("cron-batch failed:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: (error as Error).message || String(error),
      }),
      { status: 500 },
    );
  }
}

export const config: Config = {
  schedule: "*/15 * * * *",
};

export default handler;
