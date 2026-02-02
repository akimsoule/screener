import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Info,
  Trash,
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
  onSelect: (symbol: string) => void;
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
  reportsPerPage = 10,
  isAuthenticated = false,
  token = null,
}: WatchlistProps) {
  const [newSymbol, setNewSymbol] = useState("");
  const [suggestions, setSuggestions] = useState<
    { symbol: string; name?: string }[]
  >([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [loadingReports, setLoadingReports] = useState(true);
  const { toast } = useToast();

  // reportsPerPage is provided by parent (configurable in UI)
  // `reports` contains either the server page results or all results (when searching)
  const filteredReports = reports.filter((r) =>
    r.symbol.toLowerCase().includes(searchTerm.toLowerCase()),
  );

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
  }, [
    currentPage,
    searchTerm,
    sectors,
    industries,
    exchanges,
    types,
    reportsPerPage,
  ]);

  const handleAdd = (e: React.FormEvent) => {
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
        setSuggestions((res && res.suggestions) || []);
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
    try {
      // call existing prop so parent can react
      onRefresh();
    } catch (e) {
      // ignore
    }

    try {
      const body = await runScreenerWithPage(1, reportsPerPage, {
        sectors,
        industries,
        exchanges,
        types,
      });
      const fetchedReports = body.reports || [];
      setReports(fetchedReports);
      setReportsTotal(body.total || 0);
    } catch (err) {
      console.error("Failed to fetch screener:", err);
    }
  }, [reportsPerPage, sectors, industries, exchanges, types, onRefresh]);

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

    const lines: string[] = [];

    // ===== HEADER =====
    lines.push(`📊 Analyse ${r.symbol}`);
    lines.push(
      `Signal : ${rec.side} | Score : ${r.score} | Confiance modèle : ${r.confidence}/100`,
    );
    lines.push("");

    // ===== MARKET CONTEXT =====
    const regimeDesc =
      r.regime === "TREND"
        ? "Marché directionnel (tendance claire)"
        : "Marché instable / volatil";

    lines.push(`🧭 Contexte de marché`);
    lines.push(`• Régime : ${regimeDesc}`);
    lines.push(`• Tendance daily : ${r.details.trendDaily}`);
    lines.push(`• Tendance weekly : ${r.details.trendWeekly}`);
    lines.push("");

    // ===== INDICATORS =====
    lines.push(`📈 Indicateurs`);
    lines.push(`• Prix actuel : $${r.details.price.toFixed(2)}`);
    lines.push(`• RSI : ${r.details.rsi.toFixed(2)} (momentum neutre → sain)`);
    lines.push(`• ATR : ${r.details.atr.toFixed(4)} (volatilité)`);
    lines.push("");

    // ===== TRADE PLAN =====
    lines.push(`🎯 Plan de trade`);
    lines.push(`• Direction : ${rec.side}`);
    lines.push(`• Zone d’entrée : ~$${rec.entry}`);
    lines.push(`• Stop loss : $${rec.stopLoss}`);
    lines.push(`• Take profit : $${rec.takeProfit}`);
    lines.push(
      `• Risk / Reward : ${rec.riskReward ? `${rec.riskReward}:1` : "N/A"}`,
    );

    if (rec.entry && rec.stopLoss && rec.takeProfit && rec.riskReward) {
      const risk = Math.abs(rec.entry - rec.stopLoss);
      const reward = Math.abs(rec.takeProfit - rec.entry);

      lines.push(
        `• Vous risquez ~$${risk.toFixed(2)} pour tenter de gagner ~$${reward.toFixed(2)}`,
      );

      lines.push(
        `• Cela signifie que le trade peut rester rentable même avec ~${Math.round(
          100 / (rec.riskReward + 1),
        )}% de trades gagnants`,
      );
    }

    lines.push("");

    // ===== INTERPRETATION =====
    lines.push(`🧠 Lecture du modèle`);
    lines.push(r.interpretation);
    lines.push("");

    // ===== MACRO =====
    if (r.macroContext?.phase) {
      lines.push(`🌍 Contexte macro`);
      lines.push(
        `• Phase : ${r.macroContext.phase} (${r.macroContext.cycleStage})`,
      );
      lines.push(`• Confiance macro : ${r.macroContext.confidence}/100`);
      lines.push("");
    }

    // ===== DISCLAIMER =====
    lines.push(
      "⚠️ Ceci est un scénario probabiliste, pas une certitude. Risquez uniquement un capital que vous pouvez perdre.",
    );

    return lines.join("\n");
  };

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
                <ul role="listbox" className="max-h-56 overflow-auto">
                  {suggestions.map((s) => (
                    <li
                      key={s.symbol}
                      role="option"
                      className="px-3 py-2 hover:bg-secondary cursor-pointer flex justify-between items-center"
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
                              r.action.includes("ACHAT")
                                ? "bg-gain/20 text-gain"
                                : r.action.includes("VENTE")
                                  ? "bg-loss/20 text-loss"
                                  : "bg-secondary text-muted-foreground",
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
                                      r.action.includes("ACHAT")
                                        ? "bg-gain/20 text-gain"
                                        : r.action.includes("VENTE")
                                          ? "bg-loss/20 text-loss"
                                          : "bg-secondary text-muted-foreground",
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
                                    <p className="font-medium mb-2">
                                      Recommandation :
                                    </p>
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
                          r.action.includes("ACHAT")
                            ? "bg-gain/20 text-gain"
                            : r.action.includes("VENTE")
                              ? "bg-loss/20 text-loss"
                              : "bg-secondary text-muted-foreground",
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
                                  r.action.includes("ACHAT")
                                    ? "bg-gain/20 text-gain"
                                    : r.action.includes("VENTE")
                                      ? "bg-loss/20 text-loss"
                                      : "bg-secondary text-muted-foreground",
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
                                <p className="font-medium mb-2">
                                  Recommandation :
                                </p>
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
