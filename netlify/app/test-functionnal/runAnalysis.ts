#!/usr/bin/env tsx
import "dotenv/config";
import { AnalysisReport, analysisService } from "../analysis";
import { logger, getErrorMessage } from "../lib/logger";
import { prisma } from "../lib/prisma";

/**
 * SCRIPT D'ANALYSE - MODE CONSOLE
 * Script pour tester les fonctionnalités d'analyse en ligne de commande
 * Affiche les résultats de manière formatée dans la console
 *
 * Usage:
 *   npm run analysis
 *   tsx src/app/analysis/scripts/runAnalysis.ts
 */

// =============== FORMATTERS ===============

function formatHeader(title: string): string {
  const line = "═".repeat(80);
  return `\n${line}\n${title.toUpperCase().padStart((80 + title.length) / 2)}\n${line}`;
}

function formatSection(title: string): string {
  return `\n${"─".repeat(80)}\n${title}\n${"─".repeat(80)}`;
}

function formatReport(report: AnalysisReport): string {
  let output = "";

  // En-tête
  output += formatSection(`📊 ${report.symbol}`) + "\n";
  output += `Prix actuel : ${report.details.price.toFixed(2)} $\n`;
  output += `Horodatage  : ${report.timestamp.toLocaleString("fr-FR")}\n`;
  output += "\n";

  // Score et action
  output += `${report.action.padEnd(20)} Score: ${report.score}/100 (confiance: ${report.confidence}%)\n`;
  output += `Régime      : ${report.regime}\n`;
  output += "\n";

  // Interprétation
  output += `📝 Interprétation:\n`;
  output +=
    report.interpretation
      .split("\n")
      .map((l) => `   ${l}`)
      .join("\n") + "\n";
  output += "\n";

  // Détails techniques
  output += `🔍 Détails techniques:\n`;
  output += `   RSI             : ${report.details.rsi.toFixed(2)}\n`;
  output += `   ADX             : ${report.details.adx.toFixed(2)}\n`;
  output += `   Tendance Daily  : ${report.details.trendDaily}\n`;
  output += `   Tendance Weekly : ${report.details.trendWeekly}\n`;
  output += `   ATR             : ${report.details.atr.toFixed(2)} (${report.details.atrPercent.toFixed(2)}%)\n`;
  output += `   Volatilité      : ${report.details.volatilityRegime}\n`;
  output += "\n";

  // Recommandation
  output += `💡 Recommandation:\n`;
  output += `   Côté         : ${report.recommendation.side}\n`;
  output += `   Entrée       : ${report.recommendation.entry.toFixed(2)} $\n`;
  output += `   Stop Loss    : ${report.recommendation.stopLoss.toFixed(2)} $\n`;
  output += `   Take Profit  : ${report.recommendation.takeProfit.toFixed(2)} $\n`;
  output += `   Risk/Reward  : ${report.recommendation.riskReward}:1\n`;
  output += `   Durée        : ${report.recommendation.holdingPeriod.description}\n`;
  output += `                  (${report.recommendation.holdingPeriod.min}-${report.recommendation.holdingPeriod.max} jours, cible: ${report.recommendation.holdingPeriod.target})\n`;
  output += "\n";

  // Rationale
  output += `📋 ${report.recommendation.rationale}\n`;
  output += "\n";

  // Risk flags
  if (report.riskFlags.length > 0) {
    output += `⚠️  Alertes risques:\n`;
    report.riskFlags.forEach((flag) => {
      output += `   • ${flag}\n`;
    });
    output += "\n";
  }

  // Métriques
  output += `📈 Métriques estimées:\n`;
  output += `   Win Rate     : ${report.metrics.winRateEstimate.toFixed(2)}%\n`;
  output += `   Expectancy   : ${report.metrics.expectancy.toFixed(4)}\n`;
  output += `   Max Adverse  : ${report.metrics.maxAdverseExcursion.toFixed(2)} $\n`;
  output += "\n";

  // Contexte macro (si disponible)
  if (report.macroContext) {
    output += `🌍 Contexte macro:\n`;
    output += `   Phase        : ${report.macroContext.phase}\n`;
    output += `   Cycle Stage  : ${report.macroContext.cycleStage}\n`;
    output += `   Fed Policy   : ${report.macroContext.fedPolicy}\n`;
    output += `   Dollar       : ${report.macroContext.dollarRegime}\n`;
    output += `   Liquidité    : ${report.macroContext.liquidity}\n`;
    if (report.liotBias !== undefined) {
      output += `   Liot Bias    : ${report.liotBias > 0 ? "+" : ""}${report.liotBias}\n`;
    }
    output += "\n";
  }

  return output;
}

function formatSummary(
  results: Array<{ symbol: string; result?: AnalysisReport; error?: string }>,
): string {
  let output = "";

  output += formatSection("📊 RÉSUMÉ DES ANALYSES") + "\n";
  output += "\n";

  const successful = results.filter((r) => r.result);
  const failed = results.filter((r) => r.error);

  output += `Total         : ${results.length} symboles\n`;
  output += `Réussis       : ${successful.length}\n`;
  output += `Échoués       : ${failed.length}\n`;
  output += "\n";

  // Statistiques par action
  if (successful.length > 0) {
    const actionCounts: Record<string, number> = {};
    successful.forEach(({ result }) => {
      if (result) {
        actionCounts[result.action] = (actionCounts[result.action] || 0) + 1;
      }
    });

    output += `Distribution des recommandations:\n`;
    Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([action, count]) => {
        const pct = ((count / successful.length) * 100).toFixed(1);
        output += `   ${action.padEnd(20)} : ${count.toString().padStart(3)} (${pct}%)\n`;
      });
    output += "\n";
  }

  // Top scores
  if (successful.length > 0) {
    output += `🏆 Top 5 scores:\n`;
    successful
      .filter((r) => r.result)
      .sort((a, b) => Math.abs(b.result!.score) - Math.abs(a.result!.score))
      .slice(0, 5)
      .forEach(({ symbol, result }, idx) => {
        if (result) {
          output += `   ${(idx + 1).toString()}. ${symbol.padEnd(12)} : ${result.score.toString().padStart(4)}/100 - ${result.action}\n`;
        }
      });
    output += "\n";
  }

  // Erreurs
  if (failed.length > 0) {
    output += `❌ Symboles en erreur:\n`;
    failed.forEach(({ symbol, error }) => {
      output += `   • ${symbol.padEnd(12)} : ${error}\n`;
    });
    output += "\n";
  }

  return output;
}

// =============== SCRIPT PRINCIPAL ===============

export async function runAnalysis() {
  try {
    logger.info(formatHeader("Analyse de Symboles - Mode Console"));
    logger.info(`Date: ${new Date().toLocaleString("fr-FR")}`);
    logger.info(``);

    // Récupérer les symboles depuis la base de données
    const symbols = await prisma.symbol.findMany({
      where: { enabled: true },
      select: { name: true },
    });

    if (symbols.length === 0) {
      logger.warn("⚠️  Aucun symbole activé trouvé dans la base de données.");
      logger.info("   Exécutez d'abord: npm run seed");
      return;
    }

    const symbolNames = symbols.map((s) => s.name);
    logger.info(`🎯 Analyse de ${symbolNames.length} symboles:`);
    logger.info(`   ${symbolNames.join(", ")}`);
    logger.info(``);

    // Lancer l'analyse batch
    logger.info("🔄 Analyse en cours...");
    const results = await analysisService.analyzeBatch(symbolNames);

    // Afficher les résultats détaillés
    results.forEach(({ symbol, result, error }) => {
      if (result) {
        logger.info(formatReport(result));
      } else if (error) {
        logger.info(formatSection(`❌ ${symbol}`));
        logger.info(`Erreur: ${error}`);
        logger.info(``);
      }
    });

    // Afficher le résumé
    logger.info(formatSummary(results));

    // Mettre à jour la base de données
    logger.info(formatSection("💾 Mise à jour de la base de données"));
    const updatePromises = results
      .filter((r) => r.result)
      .map(({ symbol, result }) =>
        prisma.symbol
          .update({
            where: { name: symbol },
            data: {
              lastAction: result!.action,
              lastScore: result!.score,
              lastPrice: result!.details.price,
            },
          })
          .catch((err) => {
            logger.warn(`⚠️  Erreur mise à jour ${symbol}: ${err.message}`);
          }),
      );

    await Promise.all(updatePromises);
    logger.info(
      `✅ ${updatePromises.length} symboles mis à jour dans la base de données`,
    );
    logger.info(``);

    logger.info(formatHeader("Analyse terminée"));
  } catch (error) {
    logger.error("❌ Erreur fatale:", getErrorMessage(error));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

// Exécuter le script si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  await runAnalysis();
}
