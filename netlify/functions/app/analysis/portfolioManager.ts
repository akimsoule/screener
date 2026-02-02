// lib/portfolioManager.ts

import { MacroRegime, PortfolioConfig, PortfolioRecommendation } from "./types";

/**
 * Implémente la philosophie de Liot :
 * "Je ne sais pas où est le top → je gère par % d'exposition"
 */
export function calculatePortfolioAllocation(
  currentHoldings: Record<
    string,
    { valueUSD: number; costBasis: number; pnl90d: number }
  >,
  macroRegime: MacroRegime,
  config: PortfolioConfig = {
    maxCryptoExposure: 15,
    maxEquitiesExposure: 60,
    lateCycleReduction: 0.4, // Réduire de 40% l'exposition en late cycle
    profitTakingThreshold: 80, // Prendre profits si +80% en 90j
  },
): PortfolioRecommendation {
  const totalValue = Object.values(currentHoldings).reduce(
    (sum, h) => sum + h.valueUSD,
    0,
  );
  const actions: PortfolioRecommendation["rebalanceActions"] = [];
  const riskAlerts: string[] = [];
  const targetAllocation: Record<string, number> = {};

  // 🔸 Étape 1 : Ajuster les limites selon le cycle
  let maxCrypto = config.maxCryptoExposure;
  let maxEquities = config.maxEquitiesExposure;

  if (macroRegime.cycleStage === "LATE_CYCLE") {
    maxCrypto *= 1 - config.lateCycleReduction;
    maxEquities *= 1 - config.lateCycleReduction / 2;
    riskAlerts.push(
      `⚠️ LATE_CYCLE détecté → réduction exposition risquée de ${config.lateCycleReduction * 100}%`,
    );
  }

  // 🔸 Étape 2 : Appliquer le profit-taking (comme Liot à 100k BTC)
  Object.entries(currentHoldings).forEach(([asset, holding]) => {
    const currentPct = (holding.valueUSD / totalValue) * 100;
    let targetPct = currentPct;
    let assetClass: "crypto" | "equities" | "other" = "other";

    if (asset.includes("BTC") || asset.includes("ETH")) assetClass = "crypto";
    else if (asset.includes("SPY") || asset.includes("QQQ"))
      assetClass = "equities";

    // Profit-taking si gros gain récent
    if (holding.pnl90d > config.profitTakingThreshold) {
      const reduction = Math.min(holding.pnl90d / 200, 0.5); // Réduire de max 50%
      targetPct = currentPct * (1 - reduction);
      actions.push({
        asset,
        action: "SELL",
        amountUSD: holding.valueUSD * reduction,
        reason: `Profit-taking après +${holding.pnl90d}% en 90j (règle Liot)`,
      });
    }

    // Appliquer limites par classe d'actif
    if (assetClass === "crypto" && currentPct > maxCrypto) {
      targetPct = maxCrypto;
      actions.push({
        asset,
        action: "SELL",
        amountUSD: holding.valueUSD - (totalValue * maxCrypto) / 100,
        reason: `Dépasse limite crypto (${currentPct.toFixed(1)}% > ${maxCrypto}%)`,
      });
    } else if (assetClass === "equities" && currentPct > maxEquities) {
      targetPct = maxEquities;
      actions.push({
        asset,
        action: "SELL",
        amountUSD: holding.valueUSD - (totalValue * maxEquities) / 100,
        reason: `Dépasse limite actions (${currentPct.toFixed(1)}% > ${maxEquities}%)`,
      });
    }

    targetAllocation[asset] = targetPct;
  });

  return { targetAllocation, rebalanceActions: actions, riskAlerts };
}
