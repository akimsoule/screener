import { prisma } from "../lib/prisma";
import analyzeSymbol from "./analysis/analysis";
import { cache } from "../lib/cache";

export async function runAnalysis() {
  try {
    // Vérifier le cache (5 minutes de TTL)
    const CACHE_KEY = "analysis_results";
    const cached = cache.get<any>(CACHE_KEY);
    if (cached) {
      console.log("⚡ Returning cached analysis results");
      return cached;
    }

    console.log(`--- Analyse du ${new Date().toLocaleDateString()} ---`);

    // Récupérer les symboles depuis la base de données
    const symbols = await prisma.symbol.findMany({
      where: { enabled: true },
      select: { name: true },
    });
    const SYMBOLS = symbols.map((s) => s.name);

    const results = await Promise.allSettled(
      SYMBOLS.map((symbol) => analyzeSymbol(symbol)),
    );

    const reports: any[] = [];
    const errors: string[] = [];

    results.forEach((res) => {
      if (res.status === "fulfilled") {
        reports.push(res.value);
      } else {
        errors.push(res.reason?.message || String(res.reason));
      }
    });

    // Trier les reports par score absolu décroissant
    reports.sort((a, b) => Math.abs(b.score || 0) - Math.abs(a.score || 0));

    const result = {
      date: new Date().toISOString(),
      reports,
      errors,
    };

    // Mettre en cache pour 5 minutes
    cache.set(CACHE_KEY, result, 5 * 60);

    return result;
  } catch (error) {
    return {
      date: new Date().toISOString(),
      reports: [],
      errors: [(error as Error).message],
    };
  }
}

export default runAnalysis;
