import { useState, useEffect, useCallback } from "react";
import { List, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Watchlist } from "@/components/stock/Watchlist";
import type { WatchlistItem } from "@/types/stock";
import { useToast } from "@/hooks/use-toast";
import { getQuote, addSymbol, getSymbols } from "@/lib/netlifyApi";

const WATCHLIST_KEY = "stock-watchlist";

export default function Index() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("watchlist");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Search
  const [searchTerm, setSearchTerm] = useState("");

  // Watchlist
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => {
    const saved = localStorage.getItem(WATCHLIST_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  // Save watchlist to localStorage
  useEffect(() => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  // Load watchlist data on mount
  useEffect(() => {
    const loadWatchlistData = async () => {
      if (watchlist.length === 0) return;

      try {
        const updatedItems = await Promise.all(
          watchlist.map(async (item) => {
            try {
              const quote = await getQuote(item.symbol);
              return {
                ...item,
                name: quote.name || item.name,
                price: quote.price || item.price,
                change: quote.change || item.change,
                changePercent: quote.changePercent || item.changePercent,
              };
            } catch (error) {
              console.error(`Failed to load data for ${item.symbol}:`, error);
              return item; // Return original item if fetch fails
            }
          }),
        );

        setWatchlist(updatedItems);
      } catch (error) {
        console.error("Failed to load watchlist data:", error);
      }
    };

    loadWatchlistData();
  }, []); // Empty dependency array to run only on mount

  const handleRefreshWatchlist = useCallback(async () => {
    if (watchlist.length === 0) return;

    try {
      toast({
        title: "Refreshing watchlist",
        description: "Fetching latest prices...",
      });

      const updatedItems = await Promise.all(
        watchlist.map(async (item) => {
          try {
            const quote = await getQuote(item.symbol);
            return {
              ...item,
              name: quote.name || item.name,
              price: quote.price || item.price,
              change: quote.change || item.change,
              changePercent: quote.changePercent || item.changePercent,
            };
          } catch (error) {
            console.error(`Failed to refresh data for ${item.symbol}:`, error);
            return item; // Return original item if fetch fails
          }
        }),
      );

      setWatchlist(updatedItems);
      toast({
        title: "Watchlist refreshed",
        description: "Latest prices have been updated",
      });
    } catch (error) {
      console.error("Failed to refresh watchlist:", error);
      toast({
        title: "Refresh failed",
        description: "Could not update prices. Please try again.",
        variant: "destructive",
      });
    }
  }, [watchlist, toast]);

  const handleAddToWatchlist = useCallback(
    async (symbol: string) => {
      if (watchlist.some((item) => item.symbol === symbol)) {
        toast({
          title: "Already in watchlist",
          description: `${symbol} is already in your watchlist`,
        });
        return;
      }

      try {
        // Ajouter le symbole à la base de données via l'API
        await addSymbol(symbol);

        // Vérifier que l'ajout a réussi en récupérant la liste des symboles
        const symbols = await getSymbols();
        const symbolExists = symbols.some((s: any) => s.name === symbol);

        if (!symbolExists) {
          throw new Error("Symbol was not added to database");
        }

        // Récupérer les données du symbole depuis l'API
        const quote = await getQuote(symbol);

        const newItem: WatchlistItem = {
          symbol,
          name: quote.name || symbol,
          price: quote.price || 0,
          change: quote.change || 0,
          changePercent: quote.changePercent || 0,
          addedAt: new Date().toISOString(),
        };

        setWatchlist((prev) => [...prev, newItem]);

        // Revenir à la première page pour voir le nouvel élément
        setCurrentPage(1);

        toast({
          title: "Added to watchlist",
          description: `${symbol} has been added to your watchlist`,
        });
      } catch (error) {
        console.error(`Failed to add ${symbol} to watchlist:`, error);
        toast({
          title: "Error",
          description: `Failed to add ${symbol}. Please check the symbol and try again.`,
          variant: "destructive",
        });
      }
    },
    [watchlist, toast],
  );

  const handleRemoveFromWatchlist = useCallback(
    (symbol: string) => {
      setWatchlist((prev) => prev.filter((item) => item.symbol !== symbol));
      toast({
        title: "Removed from watchlist",
        description: `${symbol} has been removed from your watchlist`,
      });
    },
    [toast],
  );

  // Pagination logic
  const filteredWatchlist = watchlist.filter(
    (item) =>
      item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const totalPages = Math.ceil(filteredWatchlist.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredWatchlist.slice(startIndex, endIndex);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Stock Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Track and analyze your stocks
              </p>
            </div>
          </div>
          <ThemeToggle />
        </header>

        {/* Main Content */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="bg-secondary">
            <TabsTrigger value="watchlist" className="gap-2">
              <List className="h-4 w-4" />
              Watchlist
            </TabsTrigger>
          </TabsList>

          <TabsContent value="watchlist" className="mt-0">
            <div className="space-y-6 w-full">
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page when searching
                }}
                placeholder="Rechercher par symbole ou nom..."
                className="bg-secondary border-border"
              />
              <Watchlist
                items={paginatedItems}
                searchTerm={searchTerm}
                onAdd={handleAddToWatchlist}
                onRemove={handleRemoveFromWatchlist}
                onSelect={() => {}}
                onRefresh={handleRefreshWatchlist}
                loading={false}
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredWatchlist.length}
                onPageChange={handlePageChange}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
