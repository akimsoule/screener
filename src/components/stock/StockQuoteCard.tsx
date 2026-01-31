import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { StockQuote } from "@/types/stock";
import { cn } from "@/lib/utils";

interface StockQuoteCardProps {
  quote: StockQuote | null;
  loading?: boolean;
}

export function StockQuoteCard({ quote, loading }: StockQuoteCardProps) {
  if (loading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-12 bg-muted rounded w-1/2" />
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!quote) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6 text-center text-muted-foreground">
          Search for a stock to view quote information
        </CardContent>
      </Card>
    );
  }

  const {
    price = 0,
    change = 0,
    changePercent = 0,
    open = 0,
    high = 0,
    low = 0,
    volume = 0,
  } = quote;

  const isPositive = change >= 0;
  const isNeutral = change === 0;

  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;

  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold font-mono">{quote.symbol}</h2>
            <p className="text-muted-foreground text-sm">{quote.name}</p>
          </div>
          <div
            className={cn(
              "flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium",
              isNeutral
                ? "bg-neutral/20 text-neutral"
                : isPositive
                  ? "bg-gain/20 text-gain"
                  : "bg-loss/20 text-loss",
            )}
          >
            <TrendIcon className="h-4 w-4" />
            {isPositive && "+"}
            {changePercent.toFixed(2)}%
          </div>
        </div>

        <div className="flex items-baseline gap-3 mb-6">
          <span className="text-4xl font-bold font-mono">
            ${price.toFixed(2)}
          </span>
          <span
            className={cn(
              "text-lg font-mono",
              isNeutral
                ? "text-neutral"
                : isPositive
                  ? "text-gain"
                  : "text-loss",
            )}
          >
            {isPositive && "+"}
            {change.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuoteStat label="Open" value={`$${open.toFixed(2)}`} />
          <QuoteStat label="High" value={`$${high.toFixed(2)}`} />
          <QuoteStat label="Low" value={`$${low.toFixed(2)}`} />
          <QuoteStat label="Volume" value={formatVolume(volume)} />
        </div>
      </CardContent>
    </Card>
  );
}

function QuoteStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary/50 rounded-lg p-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="font-mono font-medium">{value}</p>
    </div>
  );
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(2)}B`;
  }
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`;
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`;
  }
  return volume.toString();
}
