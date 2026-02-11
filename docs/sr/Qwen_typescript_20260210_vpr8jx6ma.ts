// Dans analyzeSymbol(), après récupération des OHLC daily
const supportResistance = analyzeSupportResistance(dailyOhlc, price);

// Ajouter aux riskFlags si pertinent
if (supportResistance.isNearResistance && action.includes("BUY")) {
  riskFlags.push("BUY_NEAR_RESISTANCE");
}
if (supportResistance.isNearSupport && action.includes("SELL")) {
  riskFlags.push("SELL_NEAR_SUPPORT");
}

// Bonus/malus au score selon contexte S/R
let srAdjustment = 0;
if (supportResistance.isNearSupport && action.includes("BUY")) {
  srAdjustment += 8; // Rebond sur support = signal renforcé
}
if (supportResistance.isNearResistance && action.includes("SELL")) {
  srAdjustment += 8; // Rejet à résistance = signal renforcé
}
if (supportResistance.gapStrength > 70) {
  srAdjustment += supportResistance.gapDirection === "BULLISH" && action.includes("BUY") ? 10 : 0;
  srAdjustment += supportResistance.gapDirection === "BEARISH" && action.includes("SELL") ? 10 : 0;
}

finalRawScore += srAdjustment;