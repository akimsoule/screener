import { useState, useEffect, useCallback } from "react";
import { FRONT_PAGE_LIMIT } from "@/lib/Constant";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { deleteSymbol, getWatchlist, refreshCache } from "@/lib/netlifyApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddSymbolDialog } from "./AddSymbolDialog";
import type { WatchlistItem, AnalysisReport } from "@/types/stock";
import { cn } from "@/lib/utils";
import { mapItemsToReports, getActionClass } from "./watchlistHelpers";
import { ReportsTable } from "./ReportsTable";
import { ReportsPagination } from "./ReportsPagination";

interface WatchlistProps {
  items: WatchlistItem[];
  searchTerm?: string;
  onAdd: (symbol: string, symbolType?: string) => void;
  onRemove: (symbol: string) => void;
  onSelect?: (symbol: string) => void;
  onRefresh: () => void;
  currentPage?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  // Optional filters propagated from parent
  sectors?: string[];
  industries?: string[];
  exchanges?: string[];
  types?: string[];
  actions?: string[];
  // Page size fixed to FRONT_PAGE_LIMIT (not configurable)
  // (reportsPerPage and itemsPerPage removed to enforce a single fixed page size)
  isAuthenticated?: boolean;
  token?: string | null;
}

export function Watchlist({
  items,
  searchTerm = "",
  onAdd,
  onRemove,
  // onSelect,
  onRefresh,
  currentPage = 1,
  totalItems = 0,
  onPageChange,
  // Optional filters propagated from parent
  sectors = [],
  industries = [],
  exchanges = [],
  types = [],
  actions = [],
  isAuthenticated = false,
  token = null,
}: Readonly<WatchlistProps>) {
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [loadingReports, setLoadingReports] = useState(true);
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);
  const { toast } = useToast();

  // Page size is fixed to FRONT_PAGE_LIMIT
  const pageSizeForReports = FRONT_PAGE_LIMIT;
  const totalReportPages = Math.max(
    1,
    Math.ceil((reportsTotal || 0) / FRONT_PAGE_LIMIT),
  );

  // Reports come pre-paginated from server
  const paginatedReports = reports;

  // Load paginated reports when items change
  useEffect(() => {
    let cancelled = false;

    const loadReports = async () => {
      setLoadingReports(true);

      try {
        // Use server-side filtering for both normal and search modes
        const filters = {
          query: searchTerm || undefined,
          sectors: sectors.length ? sectors : undefined,
          industries: industries.length ? industries : undefined,
          exchanges: exchanges.length ? exchanges : undefined,
          types: types.length ? types : undefined,
          actions: actions.length ? actions : undefined,
        };

        const body = await getWatchlist(
          currentPage,
          FRONT_PAGE_LIMIT,
          filters,
          token,
        );

        if (cancelled) return;

        const fetchedReports = body.data || [];
        setReports(mapItemsToReports(fetchedReports));
        setReportsTotal(body.pagination?.total || fetchedReports.length);
      } catch (err) {
        console.error("Failed to fetch screener:", err);
      } finally {
        if (!cancelled) setLoadingReports(false);
      }
    };

    loadReports();
    return () => {
      cancelled = true;
    };
  }, [
    searchTerm,
    sectors,
    industries,
    exchanges,
    types,
    actions,
    token,
    currentPage,
  ]);

  const handleRefresh = useCallback(async () => {
    // Attempt to refresh server memory cache first (optional token header)
    try {
      await refreshCache();
      toast({
        title: "Cache refreshed",
        description: "Backend memory cache cleared.",
      });
    } catch (err) {
      // If refresh fails, continue to fetch watchlist anyway
      console.warn("Cache refresh failed:", err);
      toast({
        title: "Refresh failed",
        description: "Cache refresh request failed",
        variant: "destructive",
      });
    }

    // call existing prop so parent can react
    onRefresh();

    try {
      const body = await getWatchlist(
        currentPage,
        FRONT_PAGE_LIMIT,
        { sectors, industries, exchanges, types, actions },
        token,
      );
      const fetchedReports = body.data || [];
      setReports(mapItemsToReports(fetchedReports));
      setReportsTotal(body.pagination?.total || 0);
    } catch (err) {
      console.error("Failed to fetch screener:", err);
    }
  }, [
    sectors,
    industries,
    exchanges,
    types,
    actions,
    onRefresh,
    token,
    toast,
    currentPage,
  ]);

  const handleDeleteSymbol = useCallback(
    async (symbol: string) => {
      try {
        await deleteSymbol(symbol, token);
        onRemove(symbol);
        toast({
          title: "Supprimé",
          description: `${symbol} supprimé.`,
        });

        try {
          const body = await getWatchlist(
            currentPage,
            FRONT_PAGE_LIMIT,
            { sectors, industries, exchanges, types, actions },
            token,
          );
          const fetchedReports = body.data || [];
          setReports(mapItemsToReports(fetchedReports));
          setReportsTotal(body.pagination?.total || 0);

          // If the current page is now empty and we're not on the first page,
          // move back one page (parent will fetch previous page)
          if (fetchedReports.length === 0 && currentPage > 1) {
            onPageChange?.(currentPage - 1);
          }
        } catch (e) {
          console.error("Failed to refresh reports after delete:", e);
        }
      } catch {
        toast({
          title: "Erreur",
          description: "Impossible de supprimer le symbole.",
          variant: "destructive",
        });
      }
    },
    [
      onRemove,
      toast,
      token,
      currentPage,
      sectors,
      industries,
      exchanges,
      types,
      actions,
      onPageChange,
    ],
  );

  const formatRecommendationLong = useCallback((r: AnalysisReport) => {
    const rec = r.recommendation;
    if (!rec) return "";

    const prefix = ["Qu'en penses-tu ?", ""];

    const header = [
      `📊 Analyse ${r.symbol}`,
      `Signal : ${rec.side} | Score : ${r.score} | Confiance modèle : ${r.confidence}/100`,
      "",
    ];

    const regimeDesc =
      r.regime === "TREND"
        ? "Marché directionnel (tendance claire)"
        : "Marché instable / volatil";

    const market = [
      "🧭 Contexte de marché",
      `• Régime : ${regimeDesc}`,
      `• Tendance daily : ${r.details.trendDaily}`,
      `• Tendance weekly : ${r.details.trendWeekly}`,
      "",
    ];

    const indicators = [
      "📈 Indicateurs",
      `• Prix actuel : $${r.details.price.toFixed(2)}`,
      `• RSI : ${r.details.rsi.toFixed(2)} (momentum neutre → sain)`,
      `• ATR : ${r.details.atr.toFixed(4)} (volatilité)`,
      "",
    ];

    const riskStr = rec.riskReward ? `${rec.riskReward}:1` : "N/A";
    const tradeBase = [
      "🎯 Plan de trade",
      `• Direction : ${rec.side}`,
      `• Zone d’entrée : ~$${rec.entry}`,
      `• Stop loss : $${rec.stopLoss}`,
      `• Take profit : $${rec.takeProfit}`,
      `• Risk / Reward : ${riskStr}`,
    ];

    const tradeExtras =
      rec.entry && rec.stopLoss && rec.takeProfit && rec.riskReward
        ? [
            `• Vous risquez ~$${Math.abs(rec.entry - rec.stopLoss).toFixed(2)} pour tenter de gagner ~$${Math.abs(rec.takeProfit - rec.entry).toFixed(2)}`,
            `• Cela signifie que le trade peut rester rentable même avec ~${Math.round(100 / (rec.riskReward + 1))}% de trades gagnants`,
          ]
        : [];

    const tradePlan = [...tradeBase, ...tradeExtras];

    const interpretation = ["", "🧠 Lecture du modèle", r.interpretation, ""];

    const macroLines = r.macroContext?.phase
      ? [
          "🌍 Contexte macro",
          `• Phase : ${r.macroContext.phase} (${r.macroContext.cycleStage})`,
          `• Confiance macro : ${r.macroContext.confidence}/100`,
          "",
        ]
      : [];

    const disclaimer = [
      "⚠️ Ceci est un scénario probabiliste, pas une certitude. Risquez uniquement un capital que vous pouvez perdre.",
    ];

    const lines = [
      ...prefix,
      ...header,
      ...market,
      ...indicators,
      ...tradePlan,
      ...interpretation,
      ...macroLines,
      ...disclaimer,
    ];

    return lines.join("\n");
  }, []);

  const handleCopyRecommendation = useCallback(
    async (r: AnalysisReport) => {
      try {
        const text = formatRecommendationLong(r);
        await navigator.clipboard.writeText(text);
        setCopiedSymbol(r.symbol);
        toast({
          title: "Copié !",
          description: `Analyse de ${r.symbol} copiée dans le presse-papier`,
        });
        setTimeout(() => setCopiedSymbol(null), 2000);
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
        toast({
          title: "Erreur",
          description: "Impossible de copier dans le presse-papier",
          variant: "destructive",
        });
      }
    },
    [formatRecommendationLong, toast],
  );

  const handleChangePage = useCallback(
    (page: number) => {
      // Show loading immediately when user requests a page change
      setLoadingReports(true);
      onPageChange?.(page);
      // Scroll to top of watchlist on page change
      const container = document.getElementById("watchlist-container");
      if (container) {
        container.scrollIntoView({ behavior: "smooth" });
      }
    },
    [onPageChange],
  );

  return (
    <Card id="watchlist-container" className="glass-card h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg">Watchlist</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={loadingReports}
          className="h-8 w-8"
        >
          <RefreshCw
            className={cn("h-4 w-4", loadingReports && "animate-spin")}
          />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <AddSymbolDialog
            onSymbolAdded={(symbol, symbolType) => {
              // Appeler onAdd avec le symbole et son type
              onAdd(symbol, symbolType);
            }}
          />
        </div>
      </CardContent>

      {/* Pagination */}
      {totalReportPages > 1 && (
        <div className="px-4 pb-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground text-center sm:text-left">
              <span className="hidden sm:inline">
                Showing{" "}
                {items.length > 0
                  ? (currentPage - 1) * FRONT_PAGE_LIMIT + 1
                  : 0}{" "}
                to {Math.min(currentPage * FRONT_PAGE_LIMIT, totalItems)} of{" "}
                {totalItems} items
              </span>
              <span className="sm:hidden">
                {items.length > 0
                  ? (currentPage - 1) * FRONT_PAGE_LIMIT + 1
                  : 0}
                -{Math.min(currentPage * FRONT_PAGE_LIMIT, totalItems)} /{" "}
                {totalItems}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleChangePage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <span className="text-sm whitespace-nowrap">
                Page {currentPage} of {totalReportPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleChangePage(currentPage + 1)}
                disabled={currentPage === totalReportPages}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* filter reports by searchTerm */}
      {(reportsTotal >= 0 || loadingReports) && (
        <div className="p-3">
          <h3 className="text-sm font-medium mb-2">Screener Reports</h3>
          {(() => {
            if (loadingReports) {
              return (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Chargement en cours ...
                  </span>
                </div>
              );
            } else if (reportsTotal === 0) {
              return (
                <div className="flex items-center justify-center py-8">
                  <span className="text-sm text-muted-foreground">
                    Aucun résultat
                  </span>
                </div>
              );
            } else {
              return (
                <ReportsTable
                  reports={paginatedReports}
                  isAuthenticated={isAuthenticated}
                  getActionClass={getActionClass}
                  handleDeleteSymbol={handleDeleteSymbol}
                  handleCopyRecommendation={handleCopyRecommendation}
                  copiedSymbol={copiedSymbol}
                  formatRecommendationLong={formatRecommendationLong}
                />
              );
            }
          })()}

          <ReportsPagination
            currentPage={currentPage}
            totalReportPages={totalReportPages}
            pageSizeForReports={pageSizeForReports}
            reportsTotal={reportsTotal}
            onPageChange={(p) => onPageChange?.(p)}
            loadingReports={loadingReports}
          />
        </div>
      )}
    </Card>
  );
}
