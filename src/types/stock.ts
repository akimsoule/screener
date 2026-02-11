export interface StockCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  addedAt?: string;
  sector?: string | null;
  industry?: string | null;
  exchange?: string | null;
  type?: string | null;
  action?: string | null;
  isPopular?: boolean;
  inWatchlist?: boolean;
  symbolId?: string;
  symbolType?: string | null;
  // Optional full analysis report from server (when available)
  analysis?: AnalysisReport | null;
}

export interface StockIndicators {
  sma20: number[];
  sma50: number[];
  rsi: number[];
  volume: number[];
}

export type Regime = "TREND" | "RANGE";

export interface MacroRegime {
  phase: "RISK_ON" | "RISK_OFF" | "TRANSITION";
  cycleStage: "EARLY_CYCLE" | "MID_CYCLE" | "LATE_CYCLE" | "RECESSION";
  fedPolicy: "CUTTING" | "PAUSING" | "HAWKISH_PAUSE" | "HIKING";
  dollarRegime: "WEAK" | "NEUTRAL" | "STRENGTHENING";
  liquidity: "EXPANDING" | "NEUTRAL" | "CONTRACTING";
  confidence: number; // 0-100
}

export interface AssetClassBias {
  equities: number; // +20 = très bullish, -20 = très bearish
  bonds: number;
  commodities: number;
  crypto: number;
  forex: number;
}

export interface AnalysisReport {
  symbol: string;
  regime: Regime;
  rawScore: number; // Score brut (non normalisé, peut excéder ±100)
  score: number; // normalisé [-100, +100]
  action: "🟢 STRONG_BUY" | "🔵 BUY" | "⚪ HOLD" | "🟠 SELL" | "🔴 STRONG_SELL";
  confidence: number; // 0–100
  interpretation: string; // lecture humaine du score
  // Contexte macro optionnel
  macroContext?: MacroRegime;
  liotBias?: number;
  liotBiasRaw?: number; // Biais macro brut avant clamping
  // Détails des contributions et métriques techniques
  details: {
    price: number;
    rsi: number;
    adx?: number;
    trendDaily: string;
    trendWeekly: string;
    atr: number;
    atrPercent?: number;
    volatilityRegime?: string;
    breakdown?: {
      rsi: number;
      trend: number;
      macd: number;
      bb: number;
      adx: number;
      atr: number;
    };
  };
  recommendation?: {
    side: "LONG" | "SHORT" | "NONE";
    entry: number | null;
    stopLoss: number | null;
    takeProfit: number | null;
    riskReward: number | null;
    holdingPeriod?: {
      min: number;
      max: number;
      target: number;
      description: string;
    };
  };
}
