// lib/macroRegime.ts

import { MacroRegime } from "./types";

/**
 * Détecte le régime macro SANS subjectivité
 * Basé sur les signaux cités par Liot mais quantifiés :
 * - Position Fed vs marché (dot plot vs futures)
 * - Momentum ISM PMI (cycle business)
 * - Momentum dollar (DXY)
 * - Momentum liquidité (M2 YoY)
 */
export function detectMacroRegime(marketData: {
  fedDotPlot2025: number; // ex: 3.75%
  marketPricing2025: number; // ex: 3.70%
  ismPmi: number; // >50 = expansion
  dxyMomentum: number; // % change 3m
  m2Growth: number; // YoY %
  nfpSurprise: number; // actuel - prévu
}): MacroRegime {
  const signals = { riskOn: 0, riskOff: 0 };

  // 🔸 Signal 1 : Politique Fed (le cœur de l'analyse de Liot)
  const fedEasing =
    marketData.marketPricing2025 < marketData.fedDotPlot2025 - 0.25;
  if (fedEasing) signals.riskOn += 30; // Marché pricé + cuts que la Fed → liquidity bullish

  // 🔸 Signal 2 : ISM PMI (cycle business)
  if (marketData.ismPmi > 52) signals.riskOn += 25;
  else if (marketData.ismPmi < 48) signals.riskOff += 25;

  // 🔸 Signal 3 : Dollar (asymétrie haussière identifiée par Liot)
  if (marketData.dxyMomentum > 2)
    signals.riskOff += 15; // Dollar strengthening = risk-off pressure
  else if (marketData.dxyMomentum < -5) signals.riskOn += 10; // Weak USD = liquidity boost

  // 🔸 Signal 4 : Liquidité M2
  if (marketData.m2Growth > 5) signals.riskOn += 20;

  // 🔸 Signal 5 : NFP (forward-looking mechanism de Liot)
  if (marketData.nfpSurprise > 50000) signals.riskOff += 15; // Surprise positive → moins de cuts attendus

  const score = signals.riskOn - signals.riskOff;
  const phase =
    score > 15 ? "RISK_ON" : score < -15 ? "RISK_OFF" : "TRANSITION";

  // 🔸 Détection fin de cycle (insight clé de Liot sur Bitcoin)
  const lateCycleSignals = [
    marketData.ismPmi > 60 && marketData.ismPmi < marketData.ismPmi - 3, // pic puis décélération
    marketData.m2Growth > 8, // liquidité excessive
    marketData.dxyMomentum < -8, // dollar très faible = euphorie
  ].filter(Boolean).length;

  const cycleStage =
    lateCycleSignals >= 2
      ? "LATE_CYCLE"
      : marketData.ismPmi > 52
        ? "MID_CYCLE"
        : "EARLY_CYCLE";

  return {
    phase,
    cycleStage,
    fedPolicy: fedEasing ? "CUTTING" : "PAUSING",
    dollarRegime:
      marketData.dxyMomentum > 2
        ? "STRENGTHENING"
        : marketData.dxyMomentum < -5
          ? "WEAK"
          : "NEUTRAL",
    liquidity: marketData.m2Growth > 5 ? "EXPANDING" : "NEUTRAL",
    confidence: Math.abs(score) * 2,
  };
}
