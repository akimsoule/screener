import type { AnalysisReport } from "@/types/stock";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Info, Trash, Copy, Check } from "lucide-react";
import { AnalysisHierarchy } from "./AnalysisHierarchy";

interface Props {
  readonly reports: AnalysisReport[];
  readonly isAuthenticated: boolean;
  readonly getActionClass: (action?: string) => string;
  readonly handleDeleteSymbol: (symbol: string) => void;
  readonly handleCopyRecommendation: (r: AnalysisReport) => void;
  readonly copiedSymbol: string | null;
  readonly formatRecommendationLong: (r: AnalysisReport) => string;
}

export function ReportsTable({
  reports,
  isAuthenticated,
  getActionClass,
  handleDeleteSymbol,
  handleCopyRecommendation,
  copiedSymbol,
  formatRecommendationLong,
}: Props) {
  return (
    <>
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
            {reports.map((r) => (
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
                <td className="px-2 py-1 text-xs">{r.details?.trendDaily}</td>
                <td className="px-2 py-1 text-xs">{r.details?.trendWeekly}</td>
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
                          <DialogTitle>Confirmer la suppression</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <p>
                            Supprimer{" "}
                            <span className="font-mono">{r.symbol}</span> de la
                            watchlist ?
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
                </td>
                <td className="px-2 py-1">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
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
                      {/* The inner content can rely on parent-provided data and handlers */}
                      <div className="space-y-4">
                        {r.macroContext && (
                          <details className="group">
                            <summary className="cursor-pointer font-medium flex items-center justify-between">
                              Contexte macro{" "}
                              <span className="text-sm text-muted-foreground">
                                Afficher
                              </span>
                            </summary>
                            <div className="mt-2">
                              <AnalysisHierarchy
                                macroPhase={r.macroContext.phase}
                                macroConfidence={r.macroContext.confidence}
                                technicalScore={r.score}
                                technicalAction={r.action}
                                liotBias={r.liotBias}
                              />
                            </div>
                          </details>
                        )}

                        <div className="text-sm">
                          <p className="font-medium mb-2">Interprétation :</p>
                          <p className="text-muted-foreground">
                            {r.interpretation}
                          </p>
                        </div>

                        {r.recommendation && (
                          <details className="group mt-2">
                            <summary className="cursor-pointer flex items-center justify-between">
                              <div>
                                <span className="font-medium">
                                  Recommandation
                                </span>
                                <span className="text-sm text-muted-foreground ml-2">
                                  {r.recommendation.side} • RR:{" "}
                                  {r.recommendation.riskReward ?? "-"}
                                </span>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                Afficher
                              </span>
                            </summary>
                            <div className="mt-2">
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-medium">Recommandation :</p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyRecommendation(r)}
                                  className="h-8 gap-2"
                                >
                                  {copiedSymbol === r.symbol ? (
                                    <>
                                      <Check className="h-4 w-4" /> Copié
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-4 w-4" /> Copier
                                    </>
                                  )}
                                </Button>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2 whitespace-pre-line">
                                {formatRecommendationLong(r)}
                              </p>
                            </div>
                          </details>
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
        {reports.map((r) => (
          <div key={r.symbol} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-mono font-bold text-base">{r.symbol}</div>
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
              {/* Actions similar to desktop but compact */}
              {isAuthenticated && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8">
                      {" "}
                      <Trash className="h-4 w-4 mr-1" /> Supprimer
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Confirmer la suppression</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p>
                        Supprimer <span className="font-mono">{r.symbol}</span>{" "}
                        de la watchlist ?
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
                      <span className="font-mono">{r.symbol}</span>{" "}
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
                      <p className="font-medium mb-2">Interprétation :</p>
                      <p className="text-muted-foreground">
                        {r.interpretation}
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
