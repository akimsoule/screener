import { useState, useEffect, useCallback } from "react";
import { TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Watchlist } from "@/components/stock/Watchlist";
import type { WatchlistItem } from "@/types/stock";
import { useToast } from "@/hooks/use-toast";
import { getQuote, addSymbol, getSymbols, getFilters } from "@/lib/netlifyApi";

const WATCHLIST_KEY = "stock-watchlist";

export default function Index() {
  const { toast } = useToast();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Search
  const [searchTerm, setSearchTerm] = useState("");

  // Sector filters (clickable chips)
  // Filters (clickable chips)
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

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
        // Fetch symbol metadata from server (enriched DB rows)
        const symbols = await getSymbols();
        const metaByName = new Map<string, any>();
        symbols.forEach((s: any) => metaByName.set(s.name.toUpperCase(), s));

        const updatedItems = await Promise.all(
          watchlist.map(async (item) => {
            try {
              const quote = await getQuote(item.symbol);
              const meta = metaByName.get(item.symbol.toUpperCase());
              return {
                ...item,
                name: quote.name || item.name,
                price: quote.price || item.price,
                change: quote.change || item.change,
                changePercent: quote.changePercent || item.changePercent,
                // merge enrichment fields from server if available
                sector: (item as any).sector || meta?.sector || null,
                industry: (item as any).industry || meta?.industry || null,
                exchange: (item as any).exchange || meta?.exchange || null,
                type: (item as any).type || meta?.type || null,
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
        // Récupérer métadonnées du symbole depuis la liste serveur (réutilise `symbols` récupéré plus haut)
        const meta = symbols.find(
          (s: any) => s.name === symbol || s.name === symbol.toUpperCase(),
        );

        const newItem: WatchlistItem = {
          symbol,
          name: quote.name || symbol,
          price: quote.price || 0,
          change: quote.change || 0,
          changePercent: quote.changePercent || 0,
          addedAt: new Date().toISOString(),
          sector: meta?.sector || null,
          industry: meta?.industry || null,
          exchange: meta?.exchange || null,
          type: meta?.type || null,
        } as any;

        setWatchlist((prev) => [...prev, newItem]);

        // Revenir à la première page pour voir le nouvel élément
        setCurrentPage(1);

        toast({
          title: "Added to watchlist",
          description: `${symbol} has been added to your watchlist`,
        });

        // Rafraîchir la page après un délai pour laisser le temps au toast de s'afficher
        setTimeout(() => {
          window.location.reload();
        }, 2000);
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

  // Available filters (loaded from server)
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([]);
  const [availableExchanges, setAvailableExchanges] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const res = await getFilters();
        setAvailableSectors(res.sectors || []);
        setAvailableIndustries(res.industries || []);
        setAvailableExchanges(res.exchanges || []);
        setAvailableTypes(res.types || []);
      } catch (err) {
        console.error("Failed to load filters:", err);
      }
    };

    loadFilters();
  }, []);

  // Pagination logic
  const filteredWatchlist = watchlist.filter((item) => {
    const matchesSearch =
      item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase());

    // OR within each group (multiple chips in same group),
    // OR across groups: if any group has selections, include items matching at least one group.
    const sector = (item as any).sector || "Unknown";
    const industry = (item as any).industry || "Unknown";
    const exchange = (item as any).exchange || "Unknown";
    const type = (item as any).type || "Unknown";

    const anyFilterSelected =
      selectedSectors.length > 0 ||
      selectedIndustries.length > 0 ||
      selectedExchanges.length > 0 ||
      selectedTypes.length > 0;

    const matchesAnyGroup = (() => {
      if (!anyFilterSelected) return true;
      const okSector =
        selectedSectors.length > 0 && selectedSectors.includes(sector);
      const okIndustry =
        selectedIndustries.length > 0 && selectedIndustries.includes(industry);
      const okExchange =
        selectedExchanges.length > 0 && selectedExchanges.includes(exchange);
      const okType = selectedTypes.length > 0 && selectedTypes.includes(type);
      return okSector || okIndustry || okExchange || okType;
    })();

    return matchesSearch && matchesAnyGroup;
  });
  const totalPages = Math.ceil(filteredWatchlist.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredWatchlist.slice(startIndex, endIndex);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Toggle a sector in selectedSectors (OR semantics)
  const toggleSector = (sector: string) => {
    setSelectedSectors((prev) => {
      if (prev.includes(sector)) return prev.filter((s) => s !== sector);
      return [...prev, sector];
    });
    setCurrentPage(1);
  };

  const toggleIndustry = (industry: string) => {
    setSelectedIndustries((prev) => {
      if (prev.includes(industry)) return prev.filter((s) => s !== industry);
      return [...prev, industry];
    });
    setCurrentPage(1);
  };

  const toggleExchange = (exchange: string) => {
    setSelectedExchanges((prev) => {
      if (prev.includes(exchange)) return prev.filter((s) => s !== exchange);
      return [...prev, exchange];
    });
    setCurrentPage(1);
  };

  const toggleType = (t: string) => {
    setSelectedTypes((prev) => {
      if (prev.includes(t)) return prev.filter((s) => s !== t);
      return [...prev, t];
    });
    setCurrentPage(1);
  };

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
        <div className="space-y-6 w-full">
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Rechercher par symbole ou nom..."
            className="bg-secondary border-border"
          />

          {/* Filter collapse */}
          <div className="mt-2 mb-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Filters</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (filtersOpen) {
                    setSelectedSectors([]);
                    setSelectedIndustries([]);
                    setSelectedExchanges([]);
                    setSelectedTypes([]);
                  }
                  setFiltersOpen((v) => !v);
                }}
                aria-expanded={filtersOpen}
                aria-controls="filters-panel"
                className="flex items-center gap-2"
              >
                {filtersOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {filtersOpen ? "Hide filters" : "Show filters"}
              </Button>
            </div>
            {filtersOpen && (
              <div id="filters-panel" className="flex flex-col gap-4">
                {/* Sectors */}
                <div className="flex gap-2 items-center flex-wrap w-full">
                  <div className="text-sm font-medium mr-2">Sector:</div>
                  {availableSectors.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No sectors
                    </div>
                  ) : (
                    availableSectors.map((sector) => {
                      const active = selectedSectors.includes(sector);
                      return (
                        <button
                          key={sector}
                          onClick={() => toggleSector(sector)}
                          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                            active
                              ? "bg-primary text-white border-primary"
                              : "bg-secondary text-muted-foreground border-border"
                          }`}
                        >
                          {sector}
                        </button>
                      );
                    })
                  )}
                  {selectedSectors.length > 0 && (
                    <button
                      onClick={() => setSelectedSectors([])}
                      className="px-3 py-1 rounded-full text-sm border bg-transparent text-muted-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Industries */}
                <div className="flex gap-2 items-center flex-wrap w-full">
                  <div className="text-sm font-medium mr-2">Industry:</div>
                  {availableIndustries.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No industries
                    </div>
                  ) : (
                    availableIndustries.map((industry) => {
                      const active = selectedIndustries.includes(industry);
                      return (
                        <button
                          key={industry}
                          onClick={() => toggleIndustry(industry)}
                          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                            active
                              ? "bg-primary text-white border-primary"
                              : "bg-secondary text-muted-foreground border-border"
                          }`}
                        >
                          {industry}
                        </button>
                      );
                    })
                  )}
                  {selectedIndustries.length > 0 && (
                    <button
                      onClick={() => setSelectedIndustries([])}
                      className="px-3 py-1 rounded-full text-sm border bg-transparent text-muted-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Exchanges */}
                <div className="flex gap-2 items-center flex-wrap w-full">
                  <div className="text-sm font-medium mr-2">Exchange:</div>
                  {availableExchanges.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No exchanges
                    </div>
                  ) : (
                    availableExchanges.map((exchange) => {
                      const active = selectedExchanges.includes(exchange);
                      return (
                        <button
                          key={exchange}
                          onClick={() => toggleExchange(exchange)}
                          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                            active
                              ? "bg-primary text-white border-primary"
                              : "bg-secondary text-muted-foreground border-border"
                          }`}
                        >
                          {exchange}
                        </button>
                      );
                    })
                  )}
                  {selectedExchanges.length > 0 && (
                    <button
                      onClick={() => setSelectedExchanges([])}
                      className="px-3 py-1 rounded-full text-sm border bg-transparent text-muted-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Types */}
                <div className="flex gap-2 items-center flex-wrap w-full">
                  <div className="text-sm font-medium mr-2">Type:</div>
                  {availableTypes.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No types
                    </div>
                  ) : (
                    availableTypes.map((t) => {
                      const active = selectedTypes.includes(t);
                      return (
                        <button
                          key={t}
                          onClick={() => toggleType(t)}
                          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                            active
                              ? "bg-primary text-white border-primary"
                              : "bg-secondary text-muted-foreground border-border"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })
                  )}
                  {selectedTypes.length > 0 && (
                    <button
                      onClick={() => setSelectedTypes([])}
                      className="px-3 py-1 rounded-full text-sm border bg-transparent text-muted-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

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
            sectors={selectedSectors}
            industries={selectedIndustries}
            exchanges={selectedExchanges}
            types={selectedTypes}
          />
        </div>
      </div>
    </div>
  );
}
