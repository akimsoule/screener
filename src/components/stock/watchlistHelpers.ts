import type { AnalysisReport } from "@/types/stock";

type SourceItem = {
  name?: string;
  lastPrice?: number;
  analysis?: AnalysisReport;
  symbol?: string;
  price?: number;
  metadata?: Record<string, unknown>;
};

export const mapItemsToReports = (items: SourceItem[]): AnalysisReport[] =>
  items.map((s: SourceItem) => {
    if (s.analysis) return s.analysis;
    return {
      symbol: s.name ?? "",
      regime: "RANGE",
      rawScore: 0,
      score: 0,
      action: "⚪ HOLD",
      confidence: 0,
      interpretation: "",
      details: {
        price: s.lastPrice ?? 0,
        rsi: 0,
        trendDaily: "",
        trendWeekly: "",
        atr: 0,
      },
    } as AnalysisReport;
  });
export const getActionClass = (action?: string) => {
  if (!action) return "bg-secondary text-muted-foreground";

  // Simplified normalization: remove non-letter/number/space characters and uppercase
  const normalized = action.replaceAll(/[^\p{L}\p{N}_ ]+/gu, "").toUpperCase();

  if (
    normalized.includes("BUY") ||
    normalized.includes("ACHAT") ||
    normalized.includes("STRONG_BUY") ||
    normalized.includes("STRONGBUY")
  )
    return "bg-gain/20 text-gain";
  if (
    normalized.includes("SELL") ||
    normalized.includes("VENTE") ||
    normalized.includes("STRONG_SELL") ||
    normalized.includes("STRONGSELL")
  )
    return "bg-loss/20 text-loss";

  return "bg-secondary text-muted-foreground";
};

export const toServerItem = (it: SourceItem) => ({
  name: it.symbol,
  lastPrice: it.price,
  analysis: it.analysis ?? undefined,
});
