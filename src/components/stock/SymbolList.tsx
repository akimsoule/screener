import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { WatchlistItem } from "@/types/stock";
import { cn } from "@/lib/utils";

interface SymbolListProps {
  items: WatchlistItem[];
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  onRefresh: () => void;
  loading?: boolean;
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
}

export function SymbolList({
  items,
  onAdd,
  onRemove,
  onRefresh,
  loading = false,
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  onPageChange,
}: SymbolListProps) {
  const formatPrice = (price: number) => {
    if (price === 0) return "-";
    return `$${price.toFixed(2)}`;
  };

  const formatChange = (change: number, changePercent: number) => {
    if (change === 0) return { text: "-", color: "text-muted-foreground" };
    const sign = change > 0 ? "+" : "";
    const color = change > 0 ? "text-green-600" : "text-red-600";
    return {
      text: `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`,
      color,
    };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Symboles</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Chargement des symboles...
            </span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucun symbole trouvé
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const changeData = formatChange(item.change, item.changePercent);
              return (
                <div
                  key={item.symbol}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">{item.symbol}</span>
                      {item.sector && (
                        <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                          {item.sector}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {item.name}
                    </div>
                    {item.industry && (
                      <div className="text-xs text-muted-foreground">
                        {item.industry}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-mono">{formatPrice(item.price)}</div>
                    <div className={cn("text-sm", changeData.color)}>
                      {changeData.text}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAdd(item.symbol)}
                      className="h-8 w-8 p-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(item.symbol)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Affichage de {(currentPage - 1) * 10 + 1} à{" "}
              {Math.min(currentPage * 10, totalItems)} sur {totalItems} éléments
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </Button>
              <span className="text-sm">
                Page {currentPage} sur {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
