import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Info,
  Trash,
  Copy,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  deleteSymbol,
  searchSymbols,
  runScreenerWithPage,
} from "@/lib/netlifyApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AnalysisHierarchy } from "./AnalysisHierarchy";
import type { WatchlistItem, AnalysisReport } from "@/types/stock";
import { cn } from "@/lib/utils";

interface WatchlistProps {
  items: WatchlistItem[];
  searchTerm?: string;
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  onSelect?: (symbol: string) => void;
  onRefresh: () => void;
  loading?: boolean;
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  // Optional filters propagated from parent
  sectors?: string[];
  industries?: string[];
  exchanges?: string[];
  types?: string[];
  actions?: string[];
  reportsPerPage?: number;
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
  loading,
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  onPageChange,
  // Optional filters propagated from parent
  sectors = [],
  industries = [],
  exchanges = [],
  types = [],
  actions = [],
  reportsPerPage = 10,
  isAuthenticated = false,
  token = null,
}: Readonly<WatchlistProps>) {
  const [newSymbol, setNewSymbol] = useState("");
  const [suggestions, setSuggestions] = useState<
    { symbol: string; name?: string }[]
  >([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [loadingReports, setLoadingReports] = useState(true);
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);
  const { toast } = useToast();

  // Stabilize filter dependencies to avoid unnecessary re-renders
  const filterKey = useMemo(
    () => JSON.stringify({ sectors, industries, exchanges, types, actions }),
    [sectors, industries, exchanges, types, actions],
  );

  // reportsPerPage is provided by parent (configurable in UI)
  // `reports` contains either the server page results or all results (when searching)
  const filteredReports = reports.filter((r) =>
    r.symbol.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getActionClass = (action?: string) => {
    if (!action) return "bg-secondary text-muted-foreground";
    if (action.includes("ACHAT")) return "bg-gain/20 text-gain";
    if (action.includes("VENTE")) return "bg-loss/20 text-loss";
    return "bg-secondary text-muted-foreground";
  };

  // If a search is active we compute total pages from the filtered set (client-side pagination).
  // Otherwise rely on server-provided total count.
  const isSearching = searchTerm.trim().length > 0;
  const totalReportPages = isSearching
    ? Math.max(1, Math.ceil(filteredReports.length / reportsPerPage))
    : Math.max(1, Math.ceil((reportsTotal || 0) / reportsPerPage));

  // Paginate client-side when searching, otherwise `reports` already contains current page from server
  const paginatedReports = isSearching
    ? filteredReports.slice(
        (currentPage - 1) * reportsPerPage,
        currentPage * reportsPerPage,
      )
    : filteredReports;

  // Load paginated reports when currentPage changes
  useEffect(() => {
    const loadReports = async () => {
      setLoadingReports(true);
      try {
        const isSearching = searchTerm.trim().length > 0;

        if (!isSearching) {
          // Normal mode: fetch only the current page from server
          const body = await runScreenerWithPage(currentPage, reportsPerPage, {
            sectors,
            industries,
            exchanges,
            types,
            actions,
          });
          setReports(body.reports || []);
          setReportsTotal(body.total || 0);
          return;
        }

        // Search mode: fetch all pages from server then filter client-side
        const first = await runScreenerWithPage(1, reportsPerPage, {
          sectors,
          industries,
          exchanges,
          types,
          actions,
        });
        const total = first.total || 0;
        const totalPages = Math.max(1, Math.ceil(total / reportsPerPage));

        let allReports = first.reports || [];

        const promises = [];
        for (let p = 2; p <= totalPages; p++) {
          promises.push(
            runScreenerWithPage(p, reportsPerPage, {
              sectors,
              industries,
              exchanges,
              types,
              actions,
            }),
          );
        }

        if (promises.length > 0) {
          const rest = await Promise.all(promises);
          for (const res of rest) {
            allReports = allReports.concat(res.reports || []);
          }
        }

        setReports(allReports);
        setReportsTotal(total);
      } catch (err) {
        console.error("Failed to fetch screener:", err);
      } finally {
        setLoadingReports(false);
      }
    };

    loadReports();
  }, [currentPage, searchTerm, filterKey, reportsPerPage]);

  const handleAdd = (e: any) => {
    e.preventDefault();
    if (newSymbol.trim()) {
      onAdd(newSymbol.trim().toUpperCase());
      setNewSymbol("");
    }
  };

  // fetch suggestions from server when typing (debounced)
  useEffect(() => {
    const q = newSymbol.trim();
    if (q.length === 0) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLoadingSuggestions(true);
        const res = await searchSymbols(q);
        if (cancelled) return;
        setSuggestions(res?.suggestions ?? []);
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [newSymbol]);

  const handleRefresh = useCallback(async () => {
    // call existing prop so parent can react
    onRefresh();

    try {
      const body = await runScreenerWithPage(1, reportsPerPage, {
        sectors,
        industries,
        exchanges,
        types,
        actions,
      });
      const fetchedReports = body.reports || [];
      setReports(fetchedReports);
      setReportsTotal(body.total || 0);
    } catch (err) {
      console.error("Failed to fetch screener:", err);
    }
  }, [
    reportsPerPage,
    sectors,
    industries,
    exchanges,
    types,
    actions,
    onRefresh,
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
          const body = await runScreenerWithPage(currentPage, reportsPerPage, {
            sectors,
            industries,
            exchanges,
            types,
            actions,
          });
          const fetchedReports = body.reports || [];
          setReports(fetchedReports);
          setReportsTotal(body.total || 0);

          // If the current page is now empty and we're not on the first page,
          // move back one page
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
      reportsPerPage,
      sectors,
      industries,
      exchanges,
      types,
      onPageChange,
    ],
  );

  const formatRecommendationLong = (r: AnalysisReport) => {
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
  };

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

  if (loading) {
    return (
      <Card className="glass-card h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Watchlist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Chargement des rapports...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg">Watchlist</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={loading}
          className="h-8 w-8"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="relative">
          <div className="flex gap-2">
            <Input
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              placeholder={
                isAuthenticated ? "Add symbol" : "Connectez-vous pour ajouter"
              }
              className="bg-secondary border-border font-mono uppercase"
              aria-autocomplete="list"
              aria-haspopup="listbox"
              disabled={!isAuthenticated}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!isAuthenticated || !newSymbol.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* suggestions dropdown */}
          {((suggestions && suggestions.length > 0) || loadingSuggestions) && (
            <div className="absolute left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-lg">
              {loadingSuggestions ? (
                <div className="p-2 text-sm text-muted-foreground">
                  Recherche...
                </div>
              ) : (
                <ul className="max-h-56 overflow-auto">
                  {suggestions.map((s) => (
                    <li key={s.symbol}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-secondary cursor-pointer flex justify-between items-center"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          // fill input with selected symbol
                          setNewSymbol(s.symbol);
                          // optionally add immediately
                          // onAdd(s.symbol);
                          setSuggestions([]);
                        }}
                      >
                        <div className="font-mono">{s.symbol}</div>
                        <div className="text-xs text-muted-foreground truncate ml-2">
                          {s.name}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </form>
      </CardContent>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 pb-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground text-center sm:text-left">
              <span className="hidden sm:inline">
                Showing {items.length > 0 ? (currentPage - 1) * 10 + 1 : 0} to{" "}
                {Math.min(currentPage * 10, totalItems)} of {totalItems} items
              </span>
              <span className="sm:hidden">
                {items.length > 0 ? (currentPage - 1) * 10 + 1 : 0}-
                {Math.min(currentPage * 10, totalItems)} / {totalItems}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <span className="text-sm whitespace-nowrap">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* filter reports by searchTerm */}
      {reportsTotal > 0 && (
        <div className="p-3">
          <h3 className="text-sm font-medium mb-2">Screener Reports</h3>
          {loadingReports ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Chargement des rapports...
              </span>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-2 py-1">Symbol</th>
                      <th className="px-2 py-1">Action</th>
                      <th className="px-2 py-1">Score</th>
                      <th className="px-2 py-1">Conf.</th>
                      <th className="px-2 py-1">Price</th>
                      <th className="px-2 py-1">Régime</th>
                      <th className="px-2 py-1">Tend (D)</th>
                      <th className="px-2 py-1">Tend (W)</th>
                      <th className="px-2 py-1">Suppr.</th>
                      <th className="px-2 py-1">Info</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedReports.map((r) => (
                      <tr key={r.symbol} className="odd:bg-secondary/10">
                        <td className="px-2 py-1 font-mono">{r.symbol}</td>
                        <td className="px-2 py-1">
                          <span
                            className={cn(
                              "text-xs font-mono px-2 py-0.5 rounded-full",
                              getActionClass(r.action),
                            )}
                          >
                            {r.action}
                          </span>
                        </td>
                        <td className="px-2 py-1 font-mono">{r.score}</td>
                        <td className="px-2 py-1">{r.confidence}%</td>
                        <td className="px-2 py-1">
                          {r.details?.price
                            ? `$${Number(r.details.price).toFixed(2)}`
                            : "-"}
                        </td>
                        <td className="px-2 py-1">
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              r.regime === "TREND"
                                ? "bg-blue-500/20 text-blue-600"
                                : "bg-orange-500/20 text-orange-600",
                            )}
                          >
                            {r.regime}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-xs">
                          {r.details?.trendDaily}
                        </td>
                        <td className="px-2 py-1 text-xs">
                          {r.details?.trendWeekly}
                        </td>
                        <td className="px-2 py-1">
                          {isAuthenticated && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                >
                                  <Trash className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-sm">
                                <DialogHeader>
                                  <DialogTitle>
                                    Confirmer la suppression
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <p>
                                    Supprimer{" "}
                                    <span className="font-mono">
                                      {r.symbol}
                                    </span>{" "}
                                    de la watchlist ?
                                  </p>
                                  <div className="flex justify-end gap-2">
                                    <DialogClose asChild>
                                      <Button variant="ghost">Annuler</Button>
                                    </DialogClose>
                                    <DialogClose asChild>
                                      <Button
                                        variant="destructive"
                                        onClick={() =>
                                          handleDeleteSymbol(r.symbol)
                                        }
                                      >
                                        Supprimer
                                      </Button>
                                    </DialogClose>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                <Info className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <span className="font-mono">{r.symbol}</span>
                                  <span
                                    className={cn(
                                      "text-sm px-2 py-1 rounded-full",
                                      getActionClass(r.action),
                                    )}
                                  >
                                    {r.action}
                                  </span>
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                {/* Hiérarchie d'Analyse : Fondamental → Technique */}
                                {r.macroContext && (
                                  <AnalysisHierarchy
                                    macroPhase={r.macroContext.phase}
                                    macroConfidence={r.macroContext.confidence}
                                    technicalScore={r.score}
                                    technicalAction={r.action}
                                    liotBias={r.liotBias}
                                  />
                                )}
                                <div className="text-sm">
                                  <p className="font-medium mb-2">
                                    Interprétation :
                                  </p>
                                  <p className="text-muted-foreground">
                                    {r.interpretation}
                                  </p>
                                </div>
                                {r.recommendation && (
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="font-medium">
                                        Recommandation :
                                      </p>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleCopyRecommendation(r)
                                        }
                                        className="h-8 gap-2"
                                      >
                                        {copiedSymbol === r.symbol ? (
                                          <>
                                            <Check className="h-4 w-4" />
                                            Copié
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="h-4 w-4" />
                                            Copier
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-2 whitespace-pre-line">
                                      {formatRecommendationLong(r)}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div>
                                        <span className="font-medium">
                                          Side:
                                        </span>{" "}
                                        {r.recommendation.side}
                                      </div>
                                      <div>
                                        <span className="font-medium">RR:</span>{" "}
                                        {r.recommendation.riskReward}
                                      </div>
                                      <div>
                                        <span className="font-medium">
                                          Entry:
                                        </span>{" "}
                                        {r.recommendation.entry ?? "-"}
                                      </div>
                                      <div>
                                        <span className="font-medium">
                                          Stop Loss:
                                        </span>{" "}
                                        {r.recommendation.stopLoss ?? "-"}
                                      </div>
                                      <div>
                                        <span className="font-medium">
                                          Take Profit:
                                        </span>{" "}
                                        {r.recommendation.takeProfit ?? "-"}
                                      </div>
                                      {r.recommendation.holdingPeriod && (
                                        <>
                                          <div className="col-span-2">
                                            <span className="font-medium">
                                              Durée estimée:
                                            </span>{" "}
                                            {r.recommendation.holdingPeriod.target} jours
                                            <span className="text-xs text-muted-foreground ml-1">
                                              ({r.recommendation.holdingPeriod.min}-{r.recommendation.holdingPeriod.max}j)
                                            </span>
                                          </div>
                                          <div className="col-span-2">
                                            <span className="font-medium">
                                              Type:
                                            </span>{" "}
                                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                              {r.recommendation.holdingPeriod.description}
                                            </span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="font-medium">Score :</span>{" "}
                                    {r.score}
                                  </div>
                                  <div>
                                    <span className="font-medium">
                                      Confiance :
                                    </span>{" "}
                                    {r.confidence}%
                                  </div>
                                  <div>
                                    <span className="font-medium">
                                      Régime :
                                    </span>{" "}
                                    <span
                                      className={cn(
                                        "px-2 py-1 rounded-full text-xs",
                                        r.regime === "TREND"
                                          ? "bg-blue-500/20 text-blue-600"
                                          : "bg-orange-500/20 text-orange-600",
                                      )}
                                    >
                                      {r.regime}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-medium">Prix :</span>{" "}
                                    ${r.details?.price?.toFixed(2)}
                                  </div>
                                  <div>
                                    <span className="font-medium">RSI :</span>{" "}
                                    {r.details?.rsi?.toFixed(2)}
                                  </div>
                                  <div>
                                    <span className="font-medium">ATR :</span>{" "}
                                    {r.details?.atr?.toFixed(4)}
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {paginatedReports.map((r) => (
                  <div
                    key={r.symbol}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-mono font-bold text-base">
                          {r.symbol}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {r.details?.price
                            ? `$${Number(r.details.price).toFixed(2)}`
                            : "-"}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-xs font-mono px-2 py-1 rounded-full whitespace-nowrap",
                          getActionClass(r.action),
                        )}
                      >
                        {r.action}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Score:</span>{" "}
                        <span className="font-mono font-medium">{r.score}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Conf:</span>{" "}
                        {r.confidence}%
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Régime:</span>{" "}
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            r.regime === "TREND"
                              ? "bg-blue-500/20 text-blue-600"
                              : "bg-orange-500/20 text-orange-600",
                          )}
                        >
                          {r.regime}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      {isAuthenticated && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8">
                              <Trash className="h-4 w-4 mr-1" />
                              Supprimer
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-sm">
                            <DialogHeader>
                              <DialogTitle>
                                Confirmer la suppression
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <p>
                                Supprimer{" "}
                                <span className="font-mono">{r.symbol}</span> de
                                la watchlist ?
                              </p>
                              <div className="flex justify-end gap-2">
                                <DialogClose asChild>
                                  <Button variant="ghost">Annuler</Button>
                                </DialogClose>
                                <DialogClose asChild>
                                  <Button
                                    variant="destructive"
                                    onClick={() => handleDeleteSymbol(r.symbol)}
                                  >
                                    Supprimer
                                  </Button>
                                </DialogClose>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8">
                            <Info className="h-4 w-4 mr-1" />
                            Info
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <span className="font-mono">{r.symbol}</span>
                              <span
                                className={cn(
                                  "text-sm px-2 py-1 rounded-full",
                                  getActionClass(r.action),
                                )}
                              >
                                {r.action}
                              </span>
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            {r.macroContext && (
                              <AnalysisHierarchy
                                macroPhase={r.macroContext.phase}
                                macroConfidence={r.macroContext.confidence}
                                technicalScore={r.score}
                                technicalAction={r.action}
                                liotBias={r.liotBias}
                              />
                            )}

                            <div className="text-sm">
                              <p className="font-medium mb-2">
                                Interprétation :
                              </p>
                              <p className="text-muted-foreground">
                                {r.interpretation}
                              </p>
                            </div>

                            {r.recommendation && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="font-medium">
                                    Recommandation :
                                  </p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopyRecommendation(r)}
                                    className="h-8 gap-2"
                                  >
                                    {copiedSymbol === r.symbol ? (
                                      <>
                                        <Check className="h-4 w-4" />
                                        Copié
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-4 w-4" />
                                        Copier
                                      </>
                                    )}
                                  </Button>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2 whitespace-pre-line">
                                  {formatRecommendationLong(r)}
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="font-medium">Side:</span>{" "}
                                    {r.recommendation.side}
                                  </div>
                                  <div>
                                    <span className="font-medium">RR:</span>{" "}
                                    {r.recommendation.riskReward}
                                  </div>
                                  <div>
                                    <span className="font-medium">Entry:</span>{" "}
                                    {r.recommendation.entry ?? "-"}
                                  </div>
                                  <div>
                                    <span className="font-medium">
                                      Stop Loss:
                                    </span>{" "}
                                    {r.recommendation.stopLoss ?? "-"}
                                  </div>
                                  <div>
                                    <span className="font-medium">
                                      Take Profit:
                                    </span>{" "}
                                    {r.recommendation.takeProfit ?? "-"}
                                  </div>
                                  {r.recommendation.holdingPeriod && (
                                    <>
                                      <div className="col-span-2">
                                        <span className="font-medium">
                                          Durée estimée:
                                        </span>{" "}
                                        {r.recommendation.holdingPeriod.target} jours
                                        <span className="text-xs text-muted-foreground ml-1">
                                          ({r.recommendation.holdingPeriod.min}-{r.recommendation.holdingPeriod.max}j)
                                        </span>
                                      </div>
                                      <div className="col-span-2">
                                        <span className="font-medium">
                                          Type:
                                        </span>{" "}
                                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                          {r.recommendation.holdingPeriod.description}
                                        </span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Score :</span>{" "}
                                {r.score}
                              </div>
                              <div>
                                <span className="font-medium">Confiance :</span>{" "}
                                {r.confidence}%
                              </div>
                              <div>
                                <span className="font-medium">Régime :</span>{" "}
                                <span
                                  className={cn(
                                    "px-2 py-1 rounded-full text-xs",
                                    r.regime === "TREND"
                                      ? "bg-blue-500/20 text-blue-600"
                                      : "bg-orange-500/20 text-orange-600",
                                  )}
                                >
                                  {r.regime}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium">Prix :</span> $
                                {r.details?.price?.toFixed(2)}
                              </div>
                              <div>
                                <span className="font-medium">
                                  Tendance Daily :
                                </span>{" "}
                                {r.details?.trendDaily}
                              </div>
                              <div>
                                <span className="font-medium">
                                  Tendance Weekly :
                                </span>{" "}
                                {r.details?.trendWeekly}
                              </div>
                              <div>
                                <span className="font-medium">RSI :</span>{" "}
                                {r.details?.rsi?.toFixed(2)}
                              </div>
                              <div>
                                <span className="font-medium">ATR :</span>{" "}
                                {r.details?.atr?.toFixed(4)}
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Reports pagination */}
          {totalReportPages > 1 && !loadingReports && (
            <div className="px-4 pt-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground text-center sm:text-left">
                  <span className="hidden sm:inline">
                    Showing{" "}
                    {reportsTotal > 0
                      ? (currentPage - 1) * reportsPerPage + 1
                      : 0}{" "}
                    to {Math.min(currentPage * reportsPerPage, reportsTotal)} of{" "}
                    {reportsTotal} reports
                  </span>
                  <span className="sm:hidden">
                    {reportsTotal > 0
                      ? (currentPage - 1) * reportsPerPage + 1
                      : 0}
                    -{Math.min(currentPage * reportsPerPage, reportsTotal)} /{" "}
                    {reportsTotal}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange?.(currentPage - 1)}
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
                    onClick={() => onPageChange?.(currentPage + 1)}
                    disabled={currentPage === totalReportPages}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
