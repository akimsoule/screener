// Helper pour traiter les items par batch afin d'éviter le rate limiting

import {
  fillMetadata,
  fillFromExistingBd,
} from "../netlify/app/analysis/seeders";
import { prisma } from "../netlify/app/lib/prisma";
import { runMacroBatch } from "../netlify/app/scripts/batch/runBatchMacro";
import { runBatch as runSymbolBatch } from "../netlify/app/scripts/batch/runBatchSymbol";
import { runBatchPennyStocks } from "../netlify/app/scripts/batch/runBatchPennyStocks";

async function main() {
  // ⚠️  Supprimer tous les symboles pour forcer un refresh complet des métadonnées
  console.log("🗑️  Suppression de tous les symboles existants...");
  const deleted = await prisma.symbol.deleteMany({});
  console.log(`   Supprimé ${deleted.count} symboles\n`);

  // Nettoyer TOUT le cache pour forcer les appels API frais
  console.log("🧹 Nettoyage complet du cache...");
  const deletedCache = await prisma.cache.deleteMany({
    where: { category: "metadata" },
  });
  console.log(`   Supprimé ${deletedCache.count} entrées de cache\n`);

  // Nettoyer le cache de métadonnées vides pour forcer les appels API
  await fillMetadata();

  // 2) Importer tous les symboles depuis existing_symbol.json
  await fillFromExistingBd();

  // 3) Lancer les batchs (macro, pennystocks, symbol) une fois
  console.log("\n🚀 Lancement du batch macro...");
  await runMacroBatch();

  console.log("\n🚀 Lancement du scan pennystocks...");
  await runBatchPennyStocks();

  console.log("\n🚀 Lancement du batch symboles (analyse)...");
  await runSymbolBatch("ALL");
}
try {
  await main();
  console.log("Seed completed successfully.");
  process.exit(0);
} catch (error) {
  console.error("Seed failed:", error);
  process.exit(1);
}
