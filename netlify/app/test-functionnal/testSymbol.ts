#!/usr/bin/env tsx
import "dotenv/config";
import { analyzeMacroContextWithRealData, analysisService } from "../analysis";
import { prisma } from "../lib/prisma";

/**
 * SCRIPT TEST SYMBOLE - ANALYSE RAPIDE D'UN SYMBOLE SPÉCIFIQUE
 *
 * Permet de tester rapidement l'analyse d'un symbole donné
 * avec affichage détaillé des résultats
 *
 * Usage:
 *   tsx src/app/analysis/scripts/testSymbol.ts AAPL
 *   tsx src/app/analysis/scripts/testSymbol.ts BTC-USD
 *   npm run test:symbol -- NVDA
 */

const SYMBOL = process.argv[2] || "RBNK.NE";

async function checkSymbolInDatabase() {
  console.log("\n📂 Vérification en base de données...");
  const dbSymbol = await prisma.symbol.findFirst({
    where: { name: SYMBOL, enabled: true },
  });

  if (dbSymbol) {
    console.log(
      `✅ Symbole trouvé en DB: ${dbSymbol.name} (${dbSymbol.symbolType})`,
    );
    type MetaShape = {
      data?: { sector?: string; industry?: string; exchange?: string };
    };
    const meta = dbSymbol.metadata as unknown as MetaShape;
    if (meta?.data) {
      console.log(`   Secteur: ${meta.data.sector || "N/A"}`);
      console.log(`   Industrie: ${meta.data.industry || "N/A"}`);
      console.log(`   Exchange: ${meta.data.exchange || "N/A"}`);
    }
  } else {
    console.log(`⚠️ Symbole non trouvé en DB (analyse directe)`);
  }

  return dbSymbol;
}

async function analyzeMacroContext() {
  console.log("\n🌍 Analyse du contexte macro...");
  try {
    const macroContext = await analyzeMacroContextWithRealData();
    console.log(`✅ Contexte macro analysé`);
    console.log(`   Phase: ${macroContext.regime.phase}`);
    console.log(`   Cycle: ${macroContext.regime.cycleStage}`);
    console.log(`   Politique Fed: ${macroContext.regime.fedPolicy}`);
    console.log(`   Régime Dollar: ${macroContext.regime.dollarRegime}`);
    console.log(`   Liquidité: ${macroContext.regime.liquidity}`);
    console.log(`   Confiance: ${macroContext.regime.confidence}%`);
    return macroContext;
  } catch (error) {
    console.log(`❌ Erreur contexte macro: ${error}`);
    return null;
  }
}

async function performTechnicalAnalysis() {
  console.log("\n📊 Analyse technique...");
  try {
    const report = await analysisService.analyzeSymbol(SYMBOL);
    console.log(`✅ Analyse terminée pour ${SYMBOL}`);

    // Affichage des résultats principaux
    console.log(`\n🏷️ RÉSULTATS PRINCIPAUX:`);
    console.log(`   Score brut: ${report.rawScore.toFixed(1)}`);
    console.log(`   Score final: ${report.score}`);
    console.log(`   Action: ${report.action}`);
    console.log(`   Confiance: ${report.confidence}%`);
    console.log(`   Régime: ${report.regime}`);
    console.log(`   RSI: ${report.details.rsi.toFixed(1)}`);
    console.log(
      `   ATR: ${report.details.atr.toFixed(2)} (${report.details.atrPercent.toFixed(1)}%)`,
    );

    return report;
  } catch (error) {
    console.log(`❌ Erreur analyse technique: ${error}`);
    throw error;
  }
}

async function displayDetailedResults(report: any) {
  // Affichage détaillé du breakdown
  console.log(`\n🔍 BREAKDOWN TECHNIQUE:`);
  if (report.breakdown) {
    Object.entries(report.breakdown).forEach(([key, value]) => {
      console.log(`   ${key}: ${(value as number).toFixed(1)}`);
    });
  } else {
    console.log(`   Breakdown non disponible`);
  }

  // Affichage des flags de risque
  if (report.riskFlags.length > 0) {
    console.log(`\n⚠️ FLAGS DE RISQUE:`);
    report.riskFlags.forEach((flag: string) => {
      console.log(`   • ${flag}`);
    });
  }

  // Affichage de la recommandation de trading
  console.log(`\n💼 RECOMMANDATION DE TRADING:`);
  console.log(`   Action: ${report.recommendation.side}`);
  console.log(`   Entrée: ${report.recommendation.entry.toFixed(2)}`);
  console.log(`   Stop Loss: ${report.recommendation.stopLoss.toFixed(2)}`);
  console.log(`   Take Profit: ${report.recommendation.takeProfit.toFixed(2)}`);
  console.log(`   Risk/Reward: ${report.recommendation.riskReward.toFixed(1)}`);
  console.log(
    `   Holding Period: ${report.recommendation.holdingPeriod.min}-${report.recommendation.holdingPeriod.max} jours`,
  );
  console.log(`   Raison: ${report.recommendation.rationale}`);

  // Affichage du timing horaire si disponible
  if (report.recommendation.hourlyTiming) {
    console.log(`\n⏰ TIMING HORAIRE:`);
    console.log(`   Momentum: ${report.recommendation.hourlyTiming.momentum}`);
    console.log(
      `   Recommandation: ${report.recommendation.hourlyTiming.recommendation}`,
    );
  }

  // Affichage des métriques
  console.log(`\n📈 MÉTRIQUES:`);
  console.log(
    `   Win Rate estimé: ${(report.metrics.winRateEstimate * 100).toFixed(1)}%`,
  );
  console.log(`   Expectancy: ${report.metrics.expectancy.toFixed(2)}`);
  console.log(
    `   Max Adverse Excursion: ${report.metrics.maxAdverseExcursion.toFixed(2)}`,
  );

  // Affichage du biais LIOT
  let liotBiasDisplay: string;
  if (report.liotBias) {
    liotBiasDisplay =
      (report.liotBias > 0 ? "+" : "") + report.liotBias.toFixed(1);
  } else {
    liotBiasDisplay = "0";
  }
  console.log(`   Biais LIOT (clamped): ${liotBiasDisplay}`);
}

try {
  console.log("=".repeat(80));
  console.log(`🔬 ANALYSE DU SYMBOLE: ${SYMBOL}`);
  console.log("=".repeat(80));

  // 1. Vérifier le symbole en base
  await checkSymbolInDatabase();

  // 2. Analyser le contexte macro
  await analyzeMacroContext();

  // 3. Effectuer l'analyse technique
  const report = await performTechnicalAnalysis();

  // 4. Afficher les résultats détaillés
  await displayDetailedResults(report);

  console.log("\n✅ Analyse terminée avec succès !");
} catch (error) {
  console.error(`\n❌ Erreur lors de l'analyse:`, error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
  process.exit(0);
}
