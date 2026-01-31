import { prisma } from "../lib/prisma";
import analyzeSymbol from "./analysis";

export async function runAnalysis() {
  try {
    console.log(`--- Analyse du ${new Date().toLocaleDateString()} ---`);

    // Récupérer les symboles depuis la base de données
    const symbols = await prisma.symbol.findMany({
      where: { enabled: true },
      select: { name: true },
    });
    const SYMBOLS = symbols.map((s) => s.name);

    const results = await Promise.allSettled(
      SYMBOLS.map((s) => analyzeSymbol(s)),
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

    return {
      date: new Date().toISOString(),
      reports,
      errors,
    };
  } catch (error) {
    return {
      date: new Date().toISOString(),
      reports: [],
      errors: [(error as Error).message],
    };
  }
}

export default runAnalysis;
