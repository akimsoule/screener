import type { AnalysisReport } from "@/types/stock";

export const mapItemsToReports = (items: any[]): AnalysisReport[] =>
  items.map((s: any) => {
    if (s.analysis) return s.analysis as AnalysisReport;
    return {
      symbol: s.name,
      regime: "RANGE",
      rawScore: 0,
      score: 0,
      action: "ATTENTE",
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

export const toServerItem = (it: any) => ({
  name: it.symbol,
  lastPrice: it.price,
  analysis: it.analysis ?? undefined,
});
