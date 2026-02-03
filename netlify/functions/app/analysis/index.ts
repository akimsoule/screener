// lib/quantScoreEngine.ts (version enrichie)
import { detectMacroRegime } from "./macroRegime";
import { calculateAssetClassBias } from "./assetClassBias";
import { calculatePortfolioAllocation } from "./portfolioManager";
import { AnalysisReport, AssetClassBias } from "./types";
import analyzeSymbol from "./analysis";

export async function analyzeSymbolWithMacro(
  symbol: string,
  accountValue: number,
  marketContext: Parameters<typeof detectMacroRegime>[0], // Données macro live
  currentPortfolio: Record<string, any>,
): Promise<
  AnalysisReport & {
    assetBias: AssetClassBias;
    portfolioRecommendation: ReturnType<typeof calculatePortfolioAllocation>;
  }
> {
  // 🔹 Étape 1 : Détection du régime macro (objectif)
  const macroRegime = detectMacroRegime(marketContext);

  // 🔹 Étape 2 : Biais sectoriel
  const assetBias = calculateAssetClassBias(macroRegime);

  // 🔹 Étape 3 : Analyse technique avec contexte macro intégré
  const baseReport = await analyzeSymbol(symbol, {}, macroRegime, accountValue);

  // 🔹 Étape 4 : Recommandation de portefeuille
  const portfolioRec = calculatePortfolioAllocation(
    currentPortfolio,
    macroRegime,
  );

  return {
    ...baseReport,
    assetBias,
    portfolioRecommendation: portfolioRec,
  };
}

export {
  analyzeSymbol,
  detectMacroRegime,
  calculateAssetClassBias,
  calculatePortfolioAllocation,
};
