import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  Activity,
  LogIn,
  LogOut,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Watchlist } from "@/components/stock/Watchlist";
import { MacroView } from "@/components/stock/MacroView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WatchlistItem } from "@/types/stock";
import { useToast } from "@/hooks/use-toast";
import { getQuote, getWatchlist, getFilters } from "@/lib/netlifyApi";
import { FRONT_PAGE_LIMIT } from "@/lib/Constant";
import { useAuth } from "@/contexts/AuthContext";
import { AuthDialog } from "@/components/auth/AuthDialog";

export default function Index() {
  const { toast } = useToast();
  const { user, token, logout, isAuthenticated } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Screener reports per page (configurable in UI)
  const [reportsPerPage, setReportsPerPage] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("reports-per-page");
      return saved ? Number(saved) : FRONT_PAGE_LIMIT;
    } catch {
      return FRONT_PAGE_LIMIT;
    }
  });

  // Search
  const [searchTerm, setSearchTerm] = useState("");

  // Sector filters (clickable chips)
  // Filters (clickable chips)
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  // Watchlist (now from API)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  // Load watchlist data from API
  useEffect(() => {
    const loadWatchlist = async () => {
      try {
        const data = await getWatchlist(token);

        // Map API response to WatchlistItem format
        const items: WatchlistItem[] = data.symbols.map((s: any) => ({
          symbol: s.name,
          name: s.sector || s.name,
          price: 0,
          change: 0,
          changePercent: 0,
          sector: s.sector,
          industry: s.industry,
          exchange: s.exchange,
          type: s.type,
          isPopular: s.isPopular,
          inWatchlist: s.inWatchlist,
          symbolId: s.id,
        }));

        setWatchlist(items);

        // Fetch quotes for each symbol
        const updatedItems = await Promise.all(
          items.map(async (item) => {
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
              console.error(`Failed to load quote for ${item.symbol}:`, error);
              return item;
            }
          }),
        );

        setWatchlist(updatedItems);
      } catch (error) {
        console.error("Failed to load watchlist:", error);
        toast({
          title: "Erreur",
          description: "Impossible de charger la watchlist",
          variant: "destructive",
        });
      }
    };

    loadWatchlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
      // Vérifier l'authentification
      if (!isAuthenticated) {
        toast({
          title: "Authentification requise",
          description:
            "Connectez-vous pour ajouter des symboles à votre watchlist",
        });
        setAuthDialogOpen(true);
        return;
      }

      if (watchlist.some((item) => item.symbol === symbol)) {
        toast({
          title: "Déjà dans la watchlist",
          description: `${symbol} est déjà dans votre watchlist`,
        });
        return;
      }

      try {
        toast({
          title: "Ajout en cours...",
          description: `Ajout de ${symbol} à votre watchlist`,
        });

        // Ajouter via l'API avec token
        const { addSymbol } = await import("@/lib/netlifyApi");
        await addSymbol(symbol, token);

        // Recharger la watchlist
        const data = await getWatchlist(token);
        const items: WatchlistItem[] = data.symbols.map((s: any) => ({
          symbol: s.name,
          name: s.sector || s.name,
          price: 0,
          change: 0,
          changePercent: 0,
          sector: s.sector,
          industry: s.industry,
          exchange: s.exchange,
          type: s.type,
          isPopular: s.isPopular,
          inWatchlist: s.inWatchlist,
          symbolId: s.id,
        }));

        setWatchlist(items);
        setCurrentPage(1);

        toast({
          title: "Ajouté",
          description: `${symbol} a été ajouté à votre watchlist`,
        });
      } catch (error) {
        console.error(`Failed to add ${symbol}:`, error);
        toast({
          title: "Erreur",
          description:
            error instanceof Error
              ? error.message
              : `Impossible d'ajouter ${symbol}`,
          variant: "destructive",
        });
      }
    },
    [watchlist, isAuthenticated, token, toast],
  );

  const handleRemoveFromWatchlist = useCallback(
    async (symbol: string) => {
      if (!isAuthenticated) {
        toast({
          title: "Authentification requise",
          description: "Connectez-vous pour gérer votre watchlist",
        });
        return;
      }

      const item = watchlist.find((w) => w.symbol === symbol);
      if (!item?.symbolId) {
        toast({
          title: "Erreur",
          description: "Symbole introuvable",
          variant: "destructive",
        });
        return;
      }

      try {
        const { deleteSymbol } = await import("@/lib/netlifyApi");
        await deleteSymbol(item.symbolId, token);

        setWatchlist((prev) => prev.filter((w) => w.symbol !== symbol));

        toast({
          title: "Retiré",
          description: `${symbol} a été retiré de votre watchlist`,
        });
      } catch (error) {
        console.error(`Failed to remove ${symbol}:`, error);
        toast({
          title: "Erreur",
          description: `Impossible de retirer ${symbol}`,
          variant: "destructive",
        });
      }
    },
    [watchlist, isAuthenticated, token, toast],
  );

  // Available filters (loaded from server)
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([]);
  const [availableExchanges, setAvailableExchanges] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const res = await getFilters(token);
        setAvailableSectors(res.sectors || []);
        setAvailableIndustries(res.industries || []);
        setAvailableExchanges(res.exchanges || []);
        setAvailableTypes(res.types || []);
      } catch (err) {
        console.error("Failed to load filters:", err);
      }
    };

    loadFilters();
  }, [token]);

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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => globalThis.location.reload()}
              className="w-10 h-10 rounded-lg bg-primary/20"
            >
              <TrendingUp className="h-5 w-5 text-primary" />
            </Button>
            <div className="hidden md:block">
              <h1 className="text-2xl font-bold">Stock Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Track and analyze your stocks
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden md:inline">{user?.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user?.name || "Utilisateur"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Déconnexion</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => setAuthDialogOpen(true)}
              >
                <LogIn className="h-4 w-4 mr-2" />
                Connexion
              </Button>
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* Auth Dialog */}
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />

        {/* Main Content */}
        <Tabs defaultValue="watchlist" className="w-full min-h-[75vh]">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="watchlist" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Watchlist
            </TabsTrigger>
            <TabsTrigger value="macro" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Vue Macro
            </TabsTrigger>
          </TabsList>

          <TabsContent value="watchlist" className="space-y-6">
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
                <div className="ml-3 flex items-center gap-2">
                  <label
                    htmlFor="reports-per-page"
                    className="text-sm text-muted-foreground"
                  >
                    Reports:
                  </label>
                  <select
                    id="reports-per-page"
                    value={String(reportsPerPage)}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setReportsPerPage(v);
                      localStorage.setItem("reports-per-page", String(v));
                      setCurrentPage(1);
                    }}
                    className="text-sm bg-secondary border-border rounded-md px-2 py-1"
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
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
              isAuthenticated={isAuthenticated}
              token={token}
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
              reportsPerPage={reportsPerPage}
            />
          </TabsContent>

          <TabsContent value="macro">
            <MacroView />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-border">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2026 Stock Screener. Tous droits réservés.</p>
            <p className="mt-1">
              Données fournies à titre informatif uniquement. Pas de conseil en
              investissement.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
