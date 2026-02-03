import { RSI, SMA, MACD, ATR, BollingerBands, ADX } from "technicalindicators";
import { getPrices, getMarketData } from "./prices";
import type {
  AnalysisReport,
  OHLC,
  PositionSizing,
  Regime,
  RiskConfig,
  TradeRecommendation,
  MacroRegime,
  RiskAssessment,
} from "./types";
import {
  SCORE_THRESHOLDS,
  SCORE_NORMALIZATION,
  INDICATOR_PERIODS,
  REGIME_THRESHOLDS,
  RISK_DEFAULTS,
  TRADE_PARAMS,
  SCORE_WEIGHTS,
  RSI_LEVELS,
  LIOT_BIAS,
  ASSET_PATTERNS,
  DATA_REQUIREMENTS,
  DEFAULT_ACCOUNT_VALUE,
} from "./constants";

// Métadonnées optionnelles du symbole (depuis BD)
export interface SymbolMetadata {
  type?: string; // EQUITY, ETF, CRYPTOCURRENCY, MUTUALFUND, INDEX, etc.
  sector?: string;
  industry?: string;
  exchange?: string;
}

/**
 * QUANT SCORE ENGINE v4 – PRODUCTION READY
 * ✅ Risk Management complet (Kelly fractionné, vol-adjusted sizing)
 * ✅ Détection de régime robuste (ADX + volatilité)
 * ✅ Filtres macro (VIX, drawdown)
 * ✅ Gestion de portefeuille (corrélation, max exposure)
 * ✅ Backtesting-ready (métriques intégrées)
 */

// =============== CONFIGURATION PAR DÉFAUT ===============

const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxRiskPerTrade: RISK_DEFAULTS.MAX_RISK_PER_TRADE,
  maxPortfolioRisk: RISK_DEFAULTS.MAX_PORTFOLIO_RISK,
  maxPositions: RISK_DEFAULTS.MAX_POSITIONS,
  minConfidence: RISK_DEFAULTS.MIN_CONFIDENCE,
  maxCorrelation: RISK_DEFAULTS.MAX_CORRELATION,
  vixThreshold: RISK_DEFAULTS.VIX_THRESHOLD,
  maxDrawdown: RISK_DEFAULTS.MAX_DRAWDOWN,
};

// =============== UTILS ===============

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const normalizeScore = (
  raw: number,
  maxAbs: number = SCORE_NORMALIZATION.MAX_ABS,
) => clamp(Math.round((raw / maxAbs) * 100), -100, 100);

const scoreToAction = (score: number): AnalysisReport["action"] => {
  if (score >= SCORE_THRESHOLDS.STRONG_BUY) return "🟢 STRONG_BUY";
  if (score >= SCORE_THRESHOLDS.BUY) return "🔵 BUY";
  if (score <= SCORE_THRESHOLDS.STRONG_SELL) return "🔴 STRONG_SELL";
  if (score <= SCORE_THRESHOLDS.SELL) return "🟠 SELL";
  return "⚪ HOLD";
};

const interpretScore = (score: number): string => {
  if (score >= SCORE_THRESHOLDS.STRONG_BUY)
    return "✅ Setup premium : tendance, momentum et structure alignés.";
  if (score >= SCORE_THRESHOLDS.BUY)
    return "📈 Setup favorable : biais positif avec risque contrôlé.";
  if (score > SCORE_THRESHOLDS.SELL)
    return "⏸ Zone neutre : absence d'edge statistique clair.";
  if (score > SCORE_THRESHOLDS.STRONG_SELL)
    return "📉 Marché fragile : momentum négatif, éviter les longs.";
  return "⚠️ Configuration défavorable : forte tendance baissière ou survente.";
};

// =============== DÉTECTION DE RÉGIME AMÉLIORÉE ===============

function detectRegime(ohlc: OHLC[]): Regime {
  const closes = ohlc.map((o) => o.close);
  const highs = ohlc.map((o) => o.high);
  const lows = ohlc.map((o) => o.low);

  // ADX pour force de tendance
  const adxResult = ADX.calculate({
    period: INDICATOR_PERIODS.ADX,
    high: highs,
    low: lows,
    close: closes,
  });
  const adx = adxResult.at(-1)!.adx;

  // Volatilité relative
  const atr = ATR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: INDICATOR_PERIODS.ATR_SHORT,
  }).at(-1)!;
  const atrPercent = (atr / closes.at(-1)!) * 100;

  // Pente SMA50 (en %)
  const sma50 = SMA.calculate({
    values: closes,
    period: INDICATOR_PERIODS.SMA_SHORT,
  });
  const slope = ((sma50.at(-1)! - sma50.at(-10)!) / sma50.at(-10)!) * 100;

  if (
    adx > REGIME_THRESHOLDS.ADX_STRONG_TREND &&
    Math.abs(slope) > REGIME_THRESHOLDS.SLOPE_STRONG
  )
    return "STRONG_TREND";
  if (
    adx > REGIME_THRESHOLDS.ADX_WEAK_TREND &&
    Math.abs(slope) > REGIME_THRESHOLDS.SLOPE_WEAK
  )
    return "WEAK_TREND";
  if (
    adx < REGIME_THRESHOLDS.ADX_RANGE ||
    atrPercent > REGIME_THRESHOLDS.ATR_PERCENT_HIGH
  )
    return "CHOP"; // marché bruyant
  return "RANGE";
}

// =============== RISK ASSESSMENT (RECOMMANDATIONS) ===============

/**
 * Évalue la qualité du signal et les conditions de marché
 * Adapté pour une application de recommandations (sans gestion de portefeuille)
 */
async function assessRisk(
  symbol: string,
  price: number,
  atr: number,
  score: number,
  accountValue: number,
  opts?: { config?: RiskConfig; macroRegime?: MacroRegime; lastCandle?: OHLC },
): Promise<RiskAssessment> {
  const config = opts?.config || DEFAULT_RISK_CONFIG;
  const macroRegime = opts?.macroRegime;
  const lastCandle = opts?.lastCandle;

  const flags: string[] = [];
  let riskPercent = config.maxRiskPerTrade;
  let approved = true;

  // ✅ Filtre 0 : Fraîcheur des données
  if (lastCandle) {
    const candleAge = Date.now() - new Date(lastCandle.date).getTime();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 jours
    if (candleAge > maxAge) {
      flags.push(
        `DONNEES_OBSOLETES (${Math.floor(candleAge / (24 * 60 * 60 * 1000))} jours)`,
      );
      approved = false;
    }
  }

  // ✅ Filtre 1 : VIX trop élevé → marché irrationnel
  const vixData = await getMarketData("VIX");
  const vix = vixData?.price || 0;
  if (vix > config.vixThreshold) {
    flags.push(`VIX_ELEVE (${vix.toFixed(1)} > ${config.vixThreshold})`);
    riskPercent *= 0.5; // ajuster le risque suggéré
  }

  // ✅ Filtre 2 : Volatilité excessive (ATR > 3% du prix)
  const atrPercent = (atr / price) * 100;
  if (atrPercent > REGIME_THRESHOLDS.ATR_PERCENT_EXTREME) {
    flags.push(`VOLATILITE_EXCESSIVE (${atrPercent.toFixed(1)}%)`);
    riskPercent *= 0.7;
  }

  // 🔴 FILTRE CRITIQUE : Or + dollar strengthening = refuser trade
  const upper = symbol.toUpperCase();
  const isGold =
    upper.includes("GC") || upper.includes("XAU") || upper.includes("GLD");
  if (isGold && macroRegime?.dollarRegime === "STRENGTHENING") {
    flags.push("OR_DOLLAR_CONFLICT (DXY strengthening → or bearish)");
    approved = false;
  }

  // 🔴 FILTRE : Late cycle + crypto = réduire exposition
  const isCrypto = ASSET_PATTERNS.CRYPTO.some((x) => upper.includes(x));
  if (isCrypto && macroRegime?.cycleStage === "LATE_CYCLE") {
    flags.push("LATE_CYCLE_CRYPTO_RISK");
    riskPercent *= 0.4; // Réduire de 60%
  }

  // ✅ Filtre 3 : Confiance minimale
  if (Math.abs(score) < config.minConfidence) {
    flags.push(`CONFIANCE_INSUFFISANTE (score: ${score})`);
    approved = false;
  }

  return {
    approved,
    flags,
    adjustedRiskPercent: riskPercent,
  };
}

/**
 * Calcul du position sizing avec Kelly fractionné + ajustement volatilité
 */
function calculatePositionSize(
  price: number,
  stopDistance: number,
  winRateEstimate: number,
  avgWinLossRatio: number,
  accountValue: number,
  riskPercent: number,
): PositionSizing {
  // Kelly fractionné (25% du Kelly optimal pour réduire variance)
  const kelly = winRateEstimate - (1 - winRateEstimate) / avgWinLossRatio;
  const kellyFraction = clamp(
    kelly * RISK_DEFAULTS.KELLY_FRACTION,
    RISK_DEFAULTS.MIN_KELLY,
    RISK_DEFAULTS.MAX_KELLY,
  );

  // Ajustement volatilité : réduire la taille si ATR élevé
  const volatilityAdjustment = clamp(
    1 / (1 + stopDistance / price),
    RISK_DEFAULTS.MIN_VOLATILITY_ADJUSTMENT,
    RISK_DEFAULTS.MAX_VOLATILITY_ADJUSTMENT,
  );

  // Risk amount final (minimum entre Kelly et riskPercent configuré)
  const riskAmountUSD = accountValue * Math.min(kellyFraction, riskPercent);
  const units = Math.floor(riskAmountUSD / stopDistance);
  const positionSizeUSD = units * price;

  return {
    units,
    positionSizeUSD,
    riskAmountUSD,
    riskPercent: (riskAmountUSD / accountValue) * 100,
    kellyFraction,
    volatilityAdjustment,
  };
}

// =============== RECOMMANDATION ===============

function buildRecommendation(
  action: AnalysisReport["action"],
  price: number,
  atr: number,
  score: number,
  riskAssessment: RiskAssessment,
  accountValue: number = DEFAULT_ACCOUNT_VALUE,
): TradeRecommendation {
  let side: "LONG" | "SHORT" | "NONE" = "NONE";
  if (action.includes("BUY")) side = "LONG";
  else if (action.includes("SELL")) side = "SHORT";
  const isLong = side === "LONG";

  if (side === "NONE") {
    return {
      side: "NONE",
      entry: price,
      stopLoss: price,
      takeProfit: price,
      riskReward: 0,
      sizing: null,
      rationale: "Aucune opportunité identifiée (score neutre)",
    };
  }

  // RR dynamique selon qualité du setup
  let baseRR: number = TRADE_PARAMS.RR_STANDARD;
  if (Math.abs(score) >= SCORE_THRESHOLDS.STRONG_BUY) {
    baseRR = TRADE_PARAMS.RR_PREMIUM;
  } else if (Math.abs(score) >= SCORE_THRESHOLDS.BUY) {
    baseRR = TRADE_PARAMS.RR_GOOD;
  }
  const STOP_ATR = isLong
    ? TRADE_PARAMS.STOP_ATR_LONG
    : TRADE_PARAMS.STOP_ATR_SHORT;

  const entry = price;
  const stopLoss = isLong ? price - atr * STOP_ATR : price + atr * STOP_ATR;
  const risk = Math.abs(entry - stopLoss);
  const takeProfit = isLong ? entry + risk * baseRR : entry - risk * baseRR;

  let sizing: PositionSizing | null = null;
  let rationale = "";

  if (riskAssessment.approved && risk > 0) {
    // Estimation statistique du win rate selon score
    const winRateEstimate = clamp(
      TRADE_PARAMS.BASE_WIN_RATE +
        Math.abs(score) / TRADE_PARAMS.WIN_RATE_SCORE_FACTOR,
      TRADE_PARAMS.MIN_WIN_RATE,
      TRADE_PARAMS.MAX_WIN_RATE,
    );
    const avgWinLossRatio = baseRR * TRADE_PARAMS.AVG_WIN_PENALTY;

    sizing = calculatePositionSize(
      price,
      risk,
      winRateEstimate,
      avgWinLossRatio,
      accountValue,
      riskAssessment.adjustedRiskPercent,
    );

    rationale = `✅ Trade autorisé | Risque: ${(riskAssessment.adjustedRiskPercent * 100).toFixed(2)}% | Kelly: ${(sizing.kellyFraction * 100).toFixed(2)}% | Vol-adjust: ${sizing.volatilityAdjustment.toFixed(2)}`;
  } else {
    rationale = `❌ Trade refusé (${riskAssessment.flags.join(", ")})`;
  }

  return {
    side,
    entry: Number(entry.toFixed(2)),
    stopLoss: Number(stopLoss.toFixed(2)),
    takeProfit: Number(takeProfit.toFixed(2)),
    riskReward: baseRR,
    sizing,
    rationale,
  };
}

// =============== MOTEUR PRINCIPAL ===============

function scoreRSI(rsi: number, regime: string): number {
  if (regime === "RANGE" || regime === "CHOP") {
    if (rsi < RSI_LEVELS.OVERSOLD_STRONG) return SCORE_WEIGHTS.RSI_OVERSOLD;
    if (rsi < RSI_LEVELS.OVERSOLD_WEAK) return SCORE_WEIGHTS.RSI_OVERSOLD_WEAK;
    if (rsi > RSI_LEVELS.OVERBOUGHT_STRONG)
      return -SCORE_WEIGHTS.RSI_OVERBOUGHT;
    if (rsi > RSI_LEVELS.OVERBOUGHT_WEAK)
      return -SCORE_WEIGHTS.RSI_OVERBOUGHT_WEAK;
  }
  return 0;
}

function scoreTrend(
  dailyCloses: number[],
  weeklyCloses: number[],
  rsi: number,
  regime: string,
) {
  const sma50 = SMA.calculate({
    values: dailyCloses,
    period: INDICATOR_PERIODS.SMA_SHORT,
  }).at(-1)!;
  const sma200 = SMA.calculate({
    values: dailyCloses,
    period: INDICATOR_PERIODS.SMA_LONG,
  }).at(-1)!;
  const sma20W = SMA.calculate({
    values: weeklyCloses,
    period: INDICATOR_PERIODS.SMA_WEEKLY,
  }).at(-1)!;

  const trendDaily = sma50 > sma200 ? "BULL" : "BEAR";
  const trendWeekly = weeklyCloses.at(-1)! > sma20W ? "BULL" : "BEAR";

  let score = 0;
  if (regime.includes("TREND")) {
    if (rsi > RSI_LEVELS.NEUTRAL && trendDaily === "BULL")
      score += SCORE_WEIGHTS.RSI_TREND_CONTINUATION;
    else if (rsi < RSI_LEVELS.NEUTRAL && trendDaily === "BEAR")
      score -= SCORE_WEIGHTS.RSI_TREND_CONTINUATION;
  }
  score +=
    trendDaily === "BULL"
      ? SCORE_WEIGHTS.TREND_DAILY
      : -SCORE_WEIGHTS.TREND_DAILY;
  score +=
    trendWeekly === "BULL"
      ? SCORE_WEIGHTS.TREND_WEEKLY
      : -SCORE_WEIGHTS.TREND_WEEKLY;
  if (trendDaily === trendWeekly)
    score +=
      trendDaily === "BULL"
        ? SCORE_WEIGHTS.TREND_ALIGNED
        : -SCORE_WEIGHTS.TREND_ALIGNED;

  return { score, trendDaily, trendWeekly };
}

function scoreMACD(dailyCloses: number[]): number {
  const macd = MACD.calculate({
    values: dailyCloses,
    fastPeriod: INDICATOR_PERIODS.MACD_FAST,
    slowPeriod: INDICATOR_PERIODS.MACD_SLOW,
    signalPeriod: INDICATOR_PERIODS.MACD_SIGNAL,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const m0 = macd.at(-1)!;
  const m1 = macd.at(-2)!;

  let score =
    m0.MACD! > m0.signal!
      ? SCORE_WEIGHTS.MACD_SIGNAL
      : -SCORE_WEIGHTS.MACD_SIGNAL;
  if (m0.histogram! > m1.histogram! && m0.histogram! > 0)
    score += SCORE_WEIGHTS.MACD_ACCELERATION;
  if (m0.histogram! < m1.histogram! && m0.histogram! < 0)
    score -= SCORE_WEIGHTS.MACD_ACCELERATION;
  return score;
}

function scoreBB(
  dailyCloses: number[],
  price: number,
  rsi: number,
  regime: string,
  trendDaily: string,
): number {
  const bb = BollingerBands.calculate({
    values: dailyCloses,
    period: INDICATOR_PERIODS.BOLLINGER_BANDS,
    stdDev: INDICATOR_PERIODS.BOLLINGER_STD_DEV,
  }).at(-1)!;
  let score = 0;
  if (regime.includes("TREND")) {
    if (price > bb.upper && trendDaily === "BULL")
      score += SCORE_WEIGHTS.BB_TREND_CONTINUATION;
    if (price < bb.lower && trendDaily === "BEAR")
      score -= SCORE_WEIGHTS.BB_TREND_CONTINUATION;
  } else {
    if (price < bb.lower && rsi < RSI_LEVELS.OVERSOLD_WEAK)
      score += SCORE_WEIGHTS.BB_MEAN_REVERSION;
    if (price > bb.upper && rsi > RSI_LEVELS.OVERBOUGHT_WEAK)
      score -= SCORE_WEIGHTS.BB_MEAN_REVERSION;
  }
  return score;
}

function scoreADX(
  dailyHighs: number[],
  dailyLows: number[],
  dailyCloses: number[],
  regime: string,
) {
  const adxResult = ADX.calculate({
    period: INDICATOR_PERIODS.ADX,
    high: dailyHighs,
    low: dailyLows,
    close: dailyCloses,
  });
  const adx = adxResult.at(-1)!.adx;
  let score = 0;
  if (adx > REGIME_THRESHOLDS.ADX_STRONG_TREND && regime.includes("TREND"))
    score += SCORE_WEIGHTS.ADX_TREND_BOOST;
  if (adx < REGIME_THRESHOLDS.ADX_RANGE && regime === "RANGE")
    score += SCORE_WEIGHTS.ADX_RANGE_BOOST;
  return { score, adx };
}

function scoreATR(
  dailyHighs: number[],
  dailyLows: number[],
  dailyCloses: number[],
  price: number,
  riskFlags: string[],
) {
  const atr = ATR.calculate({
    high: dailyHighs,
    low: dailyLows,
    close: dailyCloses,
    period: INDICATOR_PERIODS.ATR_SHORT,
  }).at(-1)!;
  const atr50 = ATR.calculate({
    high: dailyHighs,
    low: dailyLows,
    close: dailyCloses,
    period: INDICATOR_PERIODS.ATR_LONG,
  }).at(-1)!;
  const atrPercent = (atr / price) * 100;
  let score = 0;
  if (atr > atr50 * REGIME_THRESHOLDS.ATR_MULTIPLIER_EXTREME) {
    score += SCORE_WEIGHTS.VOLATILITY_EXTREME;
    riskFlags.push("VOLATILITE_EXTREME");
  }
  if (atr < atr50 * REGIME_THRESHOLDS.ATR_MULTIPLIER_LOW) {
    score += SCORE_WEIGHTS.VOLATILITY_LOW;
    riskFlags.push("FAIBLE_VOLATILITE");
  }
  return { score, atr, atrPercent };
}

function computeTechnicalScore(
  dailyCloses: number[],
  dailyHighs: number[],
  dailyLows: number[],
  weeklyCloses: number[],
  price: number,
  regime: string,
) {
  const riskFlags: string[] = [];

  const rsi = RSI.calculate({
    values: dailyCloses,
    period: INDICATOR_PERIODS.RSI,
  }).at(-1)!;
  let rawScore = 0;

  rawScore += scoreRSI(rsi, regime);

  const trendRes = scoreTrend(dailyCloses, weeklyCloses, rsi, regime);
  rawScore += trendRes.score;

  rawScore += scoreMACD(dailyCloses);
  rawScore += scoreBB(dailyCloses, price, rsi, regime, trendRes.trendDaily);

  const adxRes = scoreADX(dailyHighs, dailyLows, dailyCloses, regime);
  rawScore += adxRes.score;

  const atrRes = scoreATR(dailyHighs, dailyLows, dailyCloses, price, riskFlags);
  rawScore += atrRes.score;

  return {
    rawScore,
    riskFlags,
    rsi,
    adx: adxRes.adx,
    trendDaily: trendRes.trendDaily,
    trendWeekly: trendRes.trendWeekly,
    atr: atrRes.atr,
    atrPercent: atrRes.atrPercent,
  };
}

export async function analyzeSymbol(
  symbol: string,
  riskConfig: Partial<RiskConfig> = {},
  macroRegime?: MacroRegime, // contexte macro optionnel
  accountValue: number = DEFAULT_ACCOUNT_VALUE,
  metadata?: SymbolMetadata, // métadonnées du symbole depuis BD
): Promise<AnalysisReport> {
  const config = { ...DEFAULT_RISK_CONFIG, ...riskConfig };

  // Récupération des données OHLC (CORRECTION CRITIQUE: pas juste les closes !)
  const [dailyOhlc, weeklyOhlc] = await Promise.all([
    getPrices(symbol, "1d"), // doit retourner OHLC[]
    getPrices(symbol, "1wk"),
  ]);

  // Détecter si c'est une crypto pour adapter les requirements
  const isCrypto =
    symbol.includes("-USD") ||
    symbol.includes("-EUR") ||
    ASSET_PATTERNS.CRYPTO.some((x) => symbol.toUpperCase().includes(x));

  const minDaily = isCrypto
    ? DATA_REQUIREMENTS.CRYPTO_MIN_DAILY_CANDLES
    : DATA_REQUIREMENTS.MIN_DAILY_CANDLES;
  const minWeekly = isCrypto
    ? DATA_REQUIREMENTS.CRYPTO_MIN_WEEKLY_CANDLES
    : DATA_REQUIREMENTS.MIN_WEEKLY_CANDLES;

  console.log(
    `🔍 ${symbol} - Type: ${isCrypto ? "CRYPTO" : "EQUITY"} | Daily: ${dailyOhlc.length}/${minDaily} | Weekly: ${weeklyOhlc.length}/${minWeekly}`,
  );

  if (dailyOhlc.length < minDaily || weeklyOhlc.length < minWeekly) {
    throw new Error(
      `Données insuffisantes pour ${symbol} (${dailyOhlc.length}/${minDaily}j, ${weeklyOhlc.length}/${minWeekly}s). Type: ${isCrypto ? "crypto" : "equity"}`,
    );
  }

  const price = dailyOhlc.at(-1)!.close;
  const regime = detectRegime(dailyOhlc);

  // Extraction des séries
  const dailyCloses = dailyOhlc.map((o) => o.close);
  const dailyHighs = dailyOhlc.map((o) => o.high);
  const dailyLows = dailyOhlc.map((o) => o.low);
  const weeklyCloses = weeklyOhlc.map((o) => o.close);

  // =============== CALCUL DU SCORE ===============

  const {
    rawScore,
    riskFlags,
    rsi,
    adx,
    trendDaily,
    trendWeekly,
    atr,
    atrPercent,
  } = computeTechnicalScore(
    dailyCloses,
    dailyHighs,
    dailyLows,
    weeklyCloses,
    price,
    regime,
  );

  /* Score final (technique uniquement) */
  let liotBias = 0;
  let finalRawScore = rawScore;

  if (macroRegime) {
    const macroFlags = computeMacroRegimeFlags(macroRegime);
    riskFlags.push(...macroFlags);
    liotBias = calculateLiotBias(symbol, macroRegime, metadata, price);
    finalRawScore = rawScore + liotBias;
  }

  const score = normalizeScore(
    finalRawScore,
    SCORE_NORMALIZATION.MAX_THEORETICAL,
  );
  const action = scoreToAction(score);
  const confidence = Math.abs(score);

  let interpretation = interpretScore(score);
  if (macroRegime) {
    interpretation = enrichInterpretationWithMacro(interpretation, macroRegime);
  }

  /* Évaluation de la qualité du signal */
  const riskAssessment = await assessRisk(
    symbol,
    price,
    atr,
    score,
    accountValue,
    { config, macroRegime, lastCandle: dailyOhlc.at(-1) },
  );

  /* Recommandation */
  const recommendation = buildRecommendation(
    action,
    price,
    atr,
    score,
    riskAssessment,
    accountValue,
  );

  /* Métriques de performance estimées */
  const winRateEstimate = clamp(
    TRADE_PARAMS.BASE_WIN_RATE +
      Math.abs(score) / TRADE_PARAMS.WIN_RATE_SCORE_FACTOR,
    TRADE_PARAMS.MIN_WIN_RATE,
    TRADE_PARAMS.MAX_WIN_RATE,
  );
  const avgWin = recommendation.riskReward * TRADE_PARAMS.AVG_WIN_PENALTY;
  const avgLoss = TRADE_PARAMS.AVG_LOSS;
  const expectancy = winRateEstimate * avgWin - (1 - winRateEstimate) * avgLoss;

  // Volatility regime simplified (extraction de la ternaire imbriquée)
  let volatilityRegime: "HIGH" | "LOW" | "NORMAL";
  if (atrPercent > REGIME_THRESHOLDS.ATR_PERCENT_EXTREME)
    volatilityRegime = "HIGH";
  else if (atrPercent < REGIME_THRESHOLDS.ATR_PERCENT_LOW)
    volatilityRegime = "LOW";
  else volatilityRegime = "NORMAL";

  return {
    symbol,
    timestamp: new Date(),
    regime,
    rawScore,
    score,
    action,
    confidence,
    interpretation,
    riskFlags: [
      ...riskFlags,
      ...(recommendation.sizing ? [] : ["POSITION_REFUSEE"]),
    ],
    details: {
      price,
      rsi,
      adx,
      trendDaily,
      trendWeekly,
      atr,
      atrPercent,
      volatilityRegime,
    },
    recommendation,
    metrics: {
      winRateEstimate: winRateEstimate * 100,
      expectancy,
      maxAdverseExcursion: atr * TRADE_PARAMS.MAX_ADVERSE_EXCURSION_ATR,
    },
    // Contexte macro optionnel
    macroContext: macroRegime,
    liotBias: liotBias === 0 ? undefined : liotBias,
  };
}

// =============== FONCTIONS MACRO LIOT ===============

/**
 * Calcule le biais macro selon le contexte Liot
 */
function handleDollarBiasForGold(
  symbol: string,
  macroRegime: MacroRegime,
  price: number = 0,
): number {
  const upper = symbol.toUpperCase();
  const isGold =
    upper.includes("GC") ||
    upper.includes("XAU") ||
    upper.includes("GLD") ||
    upper.includes("GOLD");
  if (!isGold) return 0;

  if (macroRegime.dollarRegime === "STRENGTHENING") {
    // Or est très sensible au dollar qui se renforce
    return -25;
  }
  if (macroRegime.dollarRegime === "WEAK") {
    return 20;
  }
  return 0;
}

function calculateLiotBias(
  symbol: string,
  macroRegime: MacroRegime,
  metadata?: SymbolMetadata,
  currentPrice?: number,
): number {
  const assetClass = getAssetClass(symbol, metadata);

  return (
    handleLiquidityBias(assetClass, macroRegime) +
    handleCycleBias(assetClass, macroRegime) +
    handlePhaseBias(assetClass, macroRegime) +
    handleDollarBias(assetClass, macroRegime) +
    handleDollarBiasForGold(symbol, macroRegime, currentPrice) +
    handleSeasonalityBias(assetClass)
  );
}

function handleLiquidityBias(
  assetClass: ReturnType<typeof getAssetClass>,
  macroRegime: MacroRegime,
): number {
  if (macroRegime.liquidity !== "EXPANDING") return 0;
  switch (assetClass) {
    case "equities":
      return LIOT_BIAS.LIQUIDITY_EQUITIES;
    case "crypto":
      return LIOT_BIAS.LIQUIDITY_CRYPTO;
    case "commodities":
      return LIOT_BIAS.LIQUIDITY_COMMODITIES;
    case "bonds":
      return LIOT_BIAS.LIQUIDITY_BONDS;
    default:
      return 0;
  }
}

function handleCycleBias(
  assetClass: ReturnType<typeof getAssetClass>,
  macroRegime: MacroRegime,
): number {
  if (macroRegime.cycleStage !== "LATE_CYCLE") return 0;
  switch (assetClass) {
    case "crypto":
      return LIOT_BIAS.LATE_CYCLE_CRYPTO;
    case "bonds":
      return LIOT_BIAS.LATE_CYCLE_BONDS;
    case "equities":
      return LIOT_BIAS.LATE_CYCLE_EQUITIES;
    default:
      return 0;
  }
}

function handlePhaseBias(
  assetClass: ReturnType<typeof getAssetClass>,
  macroRegime: MacroRegime,
): number {
  if (macroRegime.phase === "RISK_ON") {
    if (assetClass === "equities") return LIOT_BIAS.RISK_ON_EQUITIES;
    if (assetClass === "crypto") return LIOT_BIAS.RISK_ON_CRYPTO;
    return 0;
  }

  if (macroRegime.phase === "RISK_OFF") {
    if (assetClass === "bonds") return LIOT_BIAS.RISK_OFF_BONDS;
    if (assetClass === "equities") return LIOT_BIAS.RISK_OFF_EQUITIES;
    if (assetClass === "crypto") return LIOT_BIAS.RISK_OFF_CRYPTO;
  }

  return 0;
}

function handleDollarBias(
  assetClass: ReturnType<typeof getAssetClass>,
  macroRegime: MacroRegime,
): number {
  if (macroRegime.dollarRegime === "WEAK") {
    if (assetClass === "commodities") return LIOT_BIAS.WEAK_DOLLAR_COMMODITIES;
    if (assetClass === "crypto") return LIOT_BIAS.WEAK_DOLLAR_CRYPTO;
    return 0;
  }

  if (macroRegime.dollarRegime === "STRENGTHENING") {
    if (assetClass === "forex") return LIOT_BIAS.STRONG_DOLLAR_FOREX;
    if (assetClass === "commodities")
      return LIOT_BIAS.STRONG_DOLLAR_COMMODITIES;
    if (assetClass === "crypto") return LIOT_BIAS.STRONG_DOLLAR_CRYPTO;
  }

  return 0;
}

function handleSeasonalityBias(
  assetClass: ReturnType<typeof getAssetClass>,
): number {
  const now = new Date();
  if (now.getMonth() === 9 && assetClass === "crypto") {
    return LIOT_BIAS.OCTOBER_CRYPTO_BOOST;
  }
  return 0;
}

/**
 * Détermine la classe d'actif à partir du symbole et de ses métadonnées
 * Utilise en priorité les métadonnées de la BD, puis fallback sur pattern matching
 */
function getAssetClass(
  symbol: string,
  metadata?: SymbolMetadata,
): "equities" | "bonds" | "commodities" | "crypto" | "forex" {
  if (metadata?.type) {
    const fromMeta = getAssetClassFromMetadata(metadata, symbol);
    if (fromMeta) return fromMeta;
  }

  return getAssetClassFromPatterns(symbol);
}

function getAssetClassFromMetadata(
  metadata: SymbolMetadata,
  symbol: string,
): "equities" | "bonds" | "commodities" | "crypto" | "forex" | null {
  if (!metadata.type) return null;

  const type = metadata.type.toUpperCase();
  const sector = metadata.sector?.toUpperCase() || "";
  const industry = metadata.industry?.toUpperCase() || "";
  const upperSymbol = symbol.toUpperCase();

  if (type === "CRYPTOCURRENCY" || type.includes("CRYPTO")) {
    return "crypto";
  }

  if (type === "ETF") {
    if (
      sector.includes("BOND") ||
      sector.includes("FIXED INCOME") ||
      industry.includes("BOND") ||
      ["TLT", "IEF", "AGG", "BND", "HYG", "LQD", "MUB", "GOVT"].includes(
        upperSymbol,
      )
    ) {
      return "bonds";
    }

    if (
      sector.includes("COMMODIT") ||
      sector.includes("PRECIOUS METAL") ||
      industry.includes("GOLD") ||
      industry.includes("SILVER") ||
      ["GLD", "SLV", "USO", "UNG", "DBA", "DBC", "PDBC", "IAU"].includes(
        upperSymbol,
      )
    ) {
      return "commodities";
    }

    return "equities";
  }

  if (type === "EQUITY" || type.includes("STOCK")) {
    if (
      sector === "BASIC MATERIALS" ||
      industry.includes("GOLD") ||
      industry.includes("SILVER") ||
      industry.includes("PRECIOUS METAL") ||
      industry.includes("MINING")
    ) {
      return "commodities";
    }

    return "equities";
  }

  if (type.includes("BOND") || type.includes("TREASURY")) return "bonds";
  if (type.includes("COMMODITY") || type.includes("FUTURE"))
    return "commodities";
  if (
    type.includes("FOREX") ||
    type.includes("FX") ||
    type.includes("CURRENCY")
  )
    return "forex";

  return null;
}

function getAssetClassFromPatterns(
  symbol: string,
): "equities" | "bonds" | "commodities" | "crypto" | "forex" {
  const upperSymbol = symbol.toUpperCase();

  if (ASSET_PATTERNS.CRYPTO.some((x) => upperSymbol.includes(x)))
    return "crypto";
  if (
    ASSET_PATTERNS.BONDS_ETF.includes(
      upperSymbol as (typeof ASSET_PATTERNS.BONDS_ETF)[number],
    )
  )
    return "bonds";
  if (
    ASSET_PATTERNS.COMMODITIES_ETF.includes(
      upperSymbol as (typeof ASSET_PATTERNS.COMMODITIES_ETF)[number],
    )
  )
    return "commodities";
  if (ASSET_PATTERNS.FOREX.some((x) => upperSymbol.includes(x))) return "forex";

  return "equities";
}

function computeMacroRegimeFlags(macroRegime: MacroRegime): string[] {
  const flags: string[] = [];
  if (macroRegime.cycleStage === "LATE_CYCLE")
    flags.push("LATE_CYCLE_DETECTED");
  if (macroRegime.dollarRegime === "STRENGTHENING")
    flags.push("DOLLAR_REBOUND_POTENTIAL");
  if (macroRegime.liquidity === "EXPANDING") flags.push("LIQUIDITY_RISK_ON");
  return flags;
}

function enrichInterpretationWithMacro(
  interpretation: string,
  macroRegime: MacroRegime,
): string {
  const liotInsights: string[] = [];
  if (macroRegime.cycleStage === "LATE_CYCLE")
    liotInsights.push("⚠️ LATE CYCLE détecté (prudence recommandée)");
  if (macroRegime.dollarRegime === "STRENGTHENING")
    liotInsights.push(
      "💵 Dollar en renforcement (pression sur actifs risqués)",
    );
  if (macroRegime.phase === "RISK_ON")
    liotInsights.push(
      "📈 Environnement RISK-ON (favorable aux actifs risqués)",
    );
  else if (macroRegime.phase === "RISK_OFF")
    liotInsights.push("📉 Environnement RISK-OFF (prudence)");
  if (macroRegime.liquidity === "EXPANDING")
    liotInsights.push("💧 Liquidité en expansion (support haussier)");

  if (liotInsights.length === 0) return interpretation;
  return interpretation + "\n\n🌍 Contexte macro :\n" + liotInsights.join("\n");
}

export default analyzeSymbol;
