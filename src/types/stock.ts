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
  addedAt: string;
}

export interface StockIndicators {
  sma20: number[];
  sma50: number[];
  rsi: number[];
  volume: number[];
}

export type Regime = "TREND" | "RANGE";

export interface AnalysisReport {
  symbol: string;
  regime: Regime;
  rawScore: number;
  score: number; // normalisé [-100, +100]
  action: "ACHAT_FORT" | "ACHAT" | "ATTENTE" | "VENTE" | "VENTE_FORTE";
  confidence: number; // 0–100
  interpretation: string; // lecture humaine du score
  details: {
    price: number;
    rsi: number;
    trendDaily: string;
    trendWeekly: string;
    atr: number;
  };
  recommendation?: {
    side: "LONG" | "SHORT" | "NONE";
    entry: number | null;
    stopLoss: number | null;
    takeProfit: number | null;
    riskReward: number | null;
  };
}
