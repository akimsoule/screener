import { RSI, SMA, MACD, ATR, BollingerBands } from "technicalindicators";
import { getPrices } from "./prices";

/**
 * Quant Score Engine (v3 – exécutable)
 * - Régime automatique (TREND / RANGE)
 * - Multi-timeframe (Daily + Weekly)
 * - Score normalisé [-100, +100]
 * - Gestion du risque (ATR)
 * - Interprétation explicite
 * - Plan de trade complet (entrée, SL, TP, LONG/SHORT)
 */

export type Regime = "TREND" | "RANGE";
export type TradeSide = "LONG" | "SHORT" | "NONE";

export interface TradeRecommendation {
  side: TradeSide;
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number | null;
}

export interface AnalysisReport {
  symbol: string;
  regime: Regime;
  rawScore: number;
  score: number; // normalisé [-100, +100]
  action: "ACHAT_FORT" | "ACHAT" | "ATTENTE" | "VENTE" | "VENTE_FORTE";
  confidence: number; // 0–100
  interpretation: string;
  details: {
    price: number;
    rsi: number;
    trendDaily: string;
    trendWeekly: string;
    atr: number;
  };
  recommendation: TradeRecommendation;
}

/* =========================
   Utils
   ========================= */

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

function normalizeScore(raw: number, maxAbs = 100) {
  return clamp(Math.round((raw / maxAbs) * 100), -100, 100);
}

function scoreToAction(score: number): AnalysisReport["action"] {
  if (score >= 60) return "ACHAT_FORT";
  if (score >= 25) return "ACHAT";
  if (score <= -60) return "VENTE_FORTE";
  if (score <= -25) return "VENTE";
  return "ATTENTE";
}

function interpretScore(score: number): string {
  if (score >= 60)
    return "Setup premium : tendance et momentum alignés, risque maîtrisé.";
  if (score >= 25)
    return "Setup favorable : biais positif, attendre une bonne exécution.";
  if (score > -25) return "Zone neutre : pas d’edge exploitable.";
  if (score > -60) return "Marché fragile : risque dominant.";
  return "Configuration défavorable : biais négatif fort.";
}

/* =========================
   Régime de marché
   ========================= */

function detectRegime(daily: number[]): Regime {
  const sma50 = SMA.calculate({ values: daily, period: 50 });
  const sma200 = SMA.calculate({ values: daily, period: 200 });
  const slope = sma50.at(-1)! - sma50.at(-10)!;

  if (sma50.at(-1)! > sma200.at(-1)! && slope > 0) return "TREND";
  return "RANGE";
}

/* =========================
   Trade Recommendation
   ========================= */

function buildRecommendation(
  action: AnalysisReport["action"],
  price: number,
  atr: number,
  score: number,
): TradeRecommendation {
  if (action === "ATTENTE") {
    return {
      side: "NONE",
      entry: null,
      stopLoss: null,
      takeProfit: null,
      riskReward: null,
    };
  }

  const isLong = action === "ACHAT" || action === "ACHAT_FORT";

  // RR dynamique selon la qualité du score
  const RR = Math.abs(score) >= 60 ? 3 : 2;
  const STOP_ATR = 1.5;

  const entry = price;
  const stopLoss = isLong ? price - atr * STOP_ATR : price + atr * STOP_ATR;

  const risk = Math.abs(entry - stopLoss);

  const takeProfit = isLong ? entry + risk * RR : entry - risk * RR;

  return {
    side: isLong ? "LONG" : "SHORT",
    entry: Number(entry.toFixed(2)),
    stopLoss: Number(stopLoss.toFixed(2)),
    takeProfit: Number(takeProfit.toFixed(2)),
    riskReward: RR,
  };
}

/* =========================
   Main Engine
   ========================= */

export async function analyzeSymbol(symbol: string): Promise<AnalysisReport> {
  const [daily, weekly] = await Promise.all([
    getPrices(symbol, "1d"),
    getPrices(symbol, "1wk"),
  ]);

  if (daily.length < 250 || weekly.length < 40)
    throw new Error("Données insuffisantes (250d / 40w)");

  const price = daily.at(-1)!;
  const regime = detectRegime(daily);

  let rawScore = 0;

  /* RSI */
  const rsi = RSI.calculate({ values: daily, period: 14 }).at(-1)!;

  if (regime === "RANGE") {
    if (rsi < 30) rawScore += 20;
    else if (rsi < 40) rawScore += 10;
    else if (rsi > 70) rawScore -= 20;
    else if (rsi > 60) rawScore -= 10;
  }

  /* Trend */
  const sma50 = SMA.calculate({ values: daily, period: 50 }).at(-1)!;
  const sma200 = SMA.calculate({ values: daily, period: 200 }).at(-1)!;
  const sma20W = SMA.calculate({ values: weekly, period: 20 }).at(-1)!;

  const trendDaily = sma50 > sma200 ? "BULL" : "BEAR";
  const trendWeekly = weekly.at(-1)! > sma20W ? "BULL" : "BEAR";

  rawScore += trendDaily === "BULL" ? 15 : -15;
  rawScore += trendWeekly === "BULL" ? 15 : -15;
  if (trendDaily === trendWeekly) rawScore += trendDaily === "BULL" ? 10 : -10;

  /* MACD */
  const macd = MACD.calculate({
    values: daily,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  const m0 = macd.at(-1)!;
  const m1 = macd.at(-2)!;

  rawScore += m0.MACD! > m0.signal! ? 10 : -10;
  if (m0.histogram! > m1.histogram!) rawScore += 5;
  if (m0.histogram! < m1.histogram!) rawScore -= 5;

  /* Bollinger */
  const bb = BollingerBands.calculate({
    values: daily,
    period: 20,
    stdDev: 2,
  }).at(-1)!;

  if (regime === "TREND") {
    if (price > bb.upper && trendDaily === "BULL") rawScore += 10;
    if (price < bb.lower && trendDaily === "BEAR") rawScore -= 10;
  } else {
    if (price < bb.lower && rsi < 35) rawScore += 10;
    if (price > bb.upper && rsi > 65) rawScore -= 10;
  }

  /* ATR */
  const atr = ATR.calculate({
    high: daily,
    low: daily,
    close: daily,
    period: 14,
  }).at(-1)!;

  const atrAvg = ATR.calculate({
    high: daily,
    low: daily,
    close: daily,
    period: 50,
  }).at(-1)!;

  if (atr > atrAvg * 1.5) rawScore -= 10;

  /* Final */
  const score = normalizeScore(rawScore, 80);
  const action = scoreToAction(score);
  const confidence = Math.abs(score);
  const interpretation = interpretScore(score);

  const recommendation = buildRecommendation(action, price, atr, score);

  return {
    symbol,
    regime,
    rawScore,
    score,
    action,
    confidence,
    interpretation,
    details: {
      price,
      rsi,
      trendDaily,
      trendWeekly,
      atr,
    },
    recommendation,
  };
}

export default analyzeSymbol;
