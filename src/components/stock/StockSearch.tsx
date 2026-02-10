import { useState, useEffect } from "react";
import { getWatchlist } from "@/lib/netlifyApi";
import { Search, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface StockSearchProps {
  readonly onSearch: (symbol: string) => void;
  readonly loading?: boolean;
}

const fallbackPopular = [
  "AAPL",
  "GOOGL",
  "MSFT",
  "AMZN",
  "TSLA",
  "NVDA",
  "META",
];

export function StockSearch({ onSearch, loading }: StockSearchProps) {
  const [symbol, setSymbol] = useState("");
  const [popularStocks, setPopularStocks] = useState<string[]>(fallbackPopular);
  const [loadingSymbols, setLoadingSymbols] = useState(false);

  async function fetchSymbols() {
    setLoadingSymbols(true);
    try {
      const data = await getWatchlist();
      const rows = (data?.data || []).map((s: any) => s.name).filter(Boolean);
      if (rows.length > 0) setPopularStocks(rows.slice(0, 12));
    } catch (e) {
      console.warn("Could not load symbols from backend, using fallback", e);
    } finally {
      setLoadingSymbols(false);
    }
  }

  useEffect(() => {
    fetchSymbols();
  }, []);

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (symbol.trim()) {
      onSearch(symbol.trim().toUpperCase());
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="Enter stock symbol (e.g., AAPL)"
            className="pl-9 bg-secondary border-border font-mono uppercase"
          />
        </div>
        <Button type="submit" disabled={loading || !symbol.trim()}>
          {loading ? "Loading..." : "Search"}
        </Button>
      </form>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {popularStocks.map((stock) => (
            <Button
              key={stock}
              variant="outline"
              size="sm"
              className="font-mono text-xs"
              onClick={() => {
                setSymbol(stock);
                onSearch(stock);
              }}
              disabled={loading || loadingSymbols}
            >
              {stock}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchSymbols}
            disabled={loadingSymbols}
            aria-label="Refresh symbols"
          >
            {loadingSymbols ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4l3-3-3-3v4a12 12 0 100 24v-2a10 10 0 110-20z"
                />
              </svg>
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
