#!/usr/bin/env tsx
/**
 * Script pour visualiser les erreurs d'analyse
 */

import "dotenv/config";
import { prisma } from "../lib/prisma";

async function viewErrors() {
  console.log("\n" + "=".repeat(80));
  console.log("📋 ERREURS D'ANALYSE");
  console.log("=".repeat(80));

  const errors = await prisma.analysisError.findMany({
    orderBy: { lastOccurredAt: "desc" },
  });

  if (errors.length === 0) {
    console.log("\n✅ Aucune erreur enregistrée\n");
    return;
  }

  console.log(`\n📊 ${errors.length} erreur(s) enregistrée(s)\n`);

  // Grouper par type d'erreur
  const byType = errors.reduce(
    (acc, err) => {
      if (!acc[err.errorType]) acc[err.errorType] = [];
      acc[err.errorType].push(err);
      return acc;
    },
    {} as Record<string, typeof errors>,
  );

  for (const [type, typeErrors] of Object.entries(byType)) {
    console.log(`\n${"─".repeat(80)}`);
    console.log(`❌ ${type} (${typeErrors.length} symbole(s))`);
    console.log(`${"─".repeat(80)}`);

    for (const error of typeErrors) {
      const firstDate = new Date(error.firstOccurredAt).toLocaleDateString(
        "fr-FR",
      );
      const lastDate = new Date(error.lastOccurredAt).toLocaleDateString(
        "fr-FR",
      );

      console.log(
        `\n  ${error.symbolName.padEnd(15)} | Count: ${error.count}x | Première: ${firstDate} | Dernière: ${lastDate}`,
      );
      console.log(`  Message: ${error.errorMessage}`);

      if (
        error.metadata &&
        Object.keys(error.metadata as Record<string, unknown>).length > 0
      ) {
        type ErrorMeta = {
          dailyCandles?: number;
          dailyRequired?: number;
          weeklyCandles?: number;
          weeklyRequired?: number;
          [k: string]: unknown;
        };
        const meta = error.metadata as ErrorMeta;
        if (meta.dailyCandles !== undefined) {
          console.log(
            `  Données: ${meta.dailyCandles}/${meta.dailyRequired} jours, ${meta.weeklyCandles}/${meta.weeklyRequired} semaines`,
          );
        }
      }
    }
  }

  console.log("\n" + "=".repeat(80) + "\n");
}

// Exécution
try {
  await viewErrors();
  await prisma.$disconnect();
  process.exit(0);
} catch (error) {
  console.error("❌ Erreur:", error);
  await prisma.$disconnect();
  process.exit(1);
}
