import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import {
  getWatchlist,
  getFilters,
  addSymbol,
  deleteSymbol,
} from "@/lib/netlifyApi";
import { FRONT_PAGE_LIMIT, MUST_BE_AUTHENTICATED } from "@/lib/Constant";
import { useAuth } from "@/contexts/AuthContext";
import { AuthDialog } from "@/components/auth/AuthDialog";

// Helper: map API watchlist item -> local WatchlistItem (extracted to avoid recreation)
const mapServerItemToWatchlistItem = (s: any): WatchlistItem => ({
  symbol: s.name,
  name: s.metadata?.name || s.name,
  price: s.lastPrice ?? 0,
  change: 0,
  changePercent: 0,
  sector: s.metadata?.data?.sector || s.metadata?.sector || s.sector || null,
  industry:
    s.metadata?.data?.industry || s.metadata?.industry || s.industry || null,
  exchange:
    s.metadata?.data?.exchange || s.metadata?.exchange || s.exchange || null,
  type: s.symbolType || s.type || null,
  action: s.lastAction ?? s.action ?? null,
  // preserve full analysis object when provided by server
  analysis: s.analysis ?? null,
  isPopular: s.isPopular ?? false,
  inWatchlist: s.inWatchlist ?? true,
  symbolId: s.id,
  symbolType: s.symbolType,
});

export default function Index() {
  const { toast } = useToast();
  const { user, token, logout, isAuthenticated } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  // Utiliser MUST_BE_AUTHENTICATED pour déterminer si l'auth est requise
  const authRequired = MUST_BE_AUTHENTICATED;
  const effectiveAuth = authRequired ? isAuthenticated : true;

  // Pagination (fixed page size)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = FRONT_PAGE_LIMIT;

  // Search
  const [searchTerm, setSearchTerm] = useState("");

  // Sector filters (clickable chips)
  // Filters (clickable chips)
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);

  // Watchlist (now from API)
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  // Total items on server (used for server-backed pagination)
  const [watchlistTotal, setWatchlistTotal] = useState(0);

  // Memoize filters to avoid recreation on every render
  const filters = useMemo(
    () => ({
      query: searchTerm || undefined,
      sectors: selectedSectors.length ? selectedSectors : undefined,
      industries: selectedIndustries.length ? selectedIndustries : undefined,
      exchanges: selectedExchanges.length ? selectedExchanges : undefined,
      types: selectedTypes.length ? selectedTypes : undefined,
      actions: selectedActions.length ? selectedActions : undefined,
    }),
    [
      searchTerm,
      selectedSectors,
      selectedIndustries,
      selectedExchanges,
      selectedTypes,
      selectedActions,
    ],
  );

  // Load watchlist data from API (supports server pagination & search)
  useEffect(() => {
    let cancelled = false;

    const loadWatchlist = async () => {
      try {
        // Use server-side filtering for both normal and search modes
        const data = await getWatchlist(
          currentPage,
          FRONT_PAGE_LIMIT,
          filters,
          token,
        );
        if (cancelled) return;

        const items: WatchlistItem[] = (data.data || []).map(
          mapServerItemToWatchlistItem,
        );

        setWatchlist(items);
        setWatchlistTotal(data.pagination?.total || items.length);
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

    return () => {
      cancelled = true;
    };
    // include filters + page + token so changing them refetches
  }, [filters, currentPage, token]);
  // Helper function to reload watchlist (avoids code duplication)
  const reloadWatchlist = useCallback(
    async (page: number = 1, filtersToUse?: any) => {
      const data = await getWatchlist(
        page,
        FRONT_PAGE_LIMIT,
        filtersToUse,
        token,
      );
      const items: WatchlistItem[] = (data.data || []).map(
        mapServerItemToWatchlistItem,
      );
      setWatchlist(items);
      setWatchlistTotal(data.pagination?.total || items.length);
      return items;
    },
    [token],
  );
  const handleRefreshWatchlist = useCallback(async () => {
    try {
      toast({
        title: "Refreshing watchlist",
        description: "Refreshing watchlist data (prices disabled)",
      });

      await reloadWatchlist(currentPage);

      toast({
        title: "Watchlist refreshed",
        description: "Watchlist data refreshed (realtime prices disabled)",
      });
    } catch (error) {
      console.error("Failed to refresh watchlist:", error);
      toast({
        title: "Refresh failed",
        description: "Could not refresh watchlist. Please try again.",
        variant: "destructive",
      });
    }
  }, [currentPage, reloadWatchlist, toast]);

  const handleAddToWatchlist = useCallback(
    async (symbol: string, symbolType?: string) => {
      // Vérifier l'authentification uniquement si MUST_BE_AUTHENTICATED est true
      if (authRequired && !isAuthenticated) {
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

        // Ajouter via l'API avec token et symbolType
        await addSymbol(symbol, token, symbolType);

        // Recharger la watchlist (fetch page 1)
        await reloadWatchlist(1);
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
    [authRequired, isAuthenticated, token, toast, reloadWatchlist],
  );

  const handleRemoveFromWatchlist = useCallback(
    async (symbol: string) => {
      if (authRequired && !isAuthenticated) {
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
    [watchlist, authRequired, isAuthenticated, token, toast],
  );

  // Available filters (loaded from server)
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([]);
  const [availableExchanges, setAvailableExchanges] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const filtersLoadedRef = useRef(false);

  useEffect(() => {
    if (filtersLoadedRef.current) return;
    const loadFilters = async () => {
      try {
        const res = await getFilters(token);
        setAvailableSectors((res.sectors || []).sort());
        setAvailableIndustries((res.industries || []).sort());
        setAvailableExchanges((res.exchanges || []).sort());
        setAvailableTypes((res.types || []).sort());
        setAvailableActions((res.actions || []).sort());
        filtersLoadedRef.current = true;
      } catch (err) {
        console.error("Failed to load filters:", err);
        filtersLoadedRef.current = true;
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
    const sector = item.sector || "Unknown";
    const industry = item.industry || "Unknown";
    const exchange = item.exchange || "Unknown";
    const type = item.type || "Unknown";
    const action = item.action || null;

    const anyFilterSelected =
      selectedSectors.length > 0 ||
      selectedIndustries.length > 0 ||
      selectedExchanges.length > 0 ||
      selectedTypes.length > 0 ||
      selectedActions.length > 0;

    const matchesAnyGroup = (() => {
      if (!anyFilterSelected) return true;
      const okSector =
        selectedSectors.length > 0 && selectedSectors.includes(sector);
      const okIndustry =
        selectedIndustries.length > 0 && selectedIndustries.includes(industry);
      const okExchange =
        selectedExchanges.length > 0 && selectedExchanges.includes(exchange);
      const okType = selectedTypes.length > 0 && selectedTypes.includes(type);
      const okAction =
        selectedActions.length > 0 &&
        action !== null &&
        selectedActions.includes(action);
      return okSector || okIndustry || okExchange || okType || okAction;
    })();

    return matchesSearch && matchesAnyGroup;
  });
  const isSearchingTop = searchTerm.trim().length > 0;
  const totalPages = isSearchingTop
    ? Math.max(1, Math.ceil(filteredWatchlist.length / itemsPerPage))
    : Math.max(1, Math.ceil(watchlistTotal / itemsPerPage));

  // When searching, paginate client-side across all loaded items; otherwise server returns the requested page
  const paginatedItems = isSearchingTop
    ? filteredWatchlist.slice(
        (currentPage - 1) * itemsPerPage,
        (currentPage - 1) * itemsPerPage + itemsPerPage,
      )
    : watchlist;

  // If the server total changed and we're beyond the last page, reset to page 1
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages]);

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

  const toggleAction = (a: string) => {
    setSelectedActions((prev) => {
      if (prev.includes(a)) return prev.filter((s) => s !== a);
      return [...prev, a];
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
            {authRequired && (
              <>
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
              </>
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* Auth Dialog - Only render if authentication is required */}
        {authRequired && (
          <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
        )}

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
                      setSelectedActions([]);
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
                  <div className="text-sm text-muted-foreground">
                    Reports: 10
                  </div>
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
                                ? "bg-primary text-primary-foreground border-primary"
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
                                ? "bg-primary text-primary-foreground border-primary"
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
                                ? "bg-primary text-primary-foreground border-primary"
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
                                ? "bg-primary text-primary-foreground border-primary"
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

                  {/* Actions */}
                  <div className="flex gap-2 items-center flex-wrap w-full">
                    <div className="text-sm font-medium mr-2">Action:</div>
                    {availableActions.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No actions
                      </div>
                    ) : (
                      availableActions.map((a) => {
                        const active = selectedActions.includes(a);
                        return (
                          <button
                            key={a}
                            onClick={() => toggleAction(a)}
                            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                              active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-secondary text-muted-foreground border-border"
                            }`}
                          >
                            {a}
                          </button>
                        );
                      })
                    )}
                    {selectedActions.length > 0 && (
                      <button
                        onClick={() => setSelectedActions([])}
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
              isAuthenticated={effectiveAuth}
              token={token}
              onSelect={() => {}}
              onRefresh={handleRefreshWatchlist}
              currentPage={currentPage}
              totalItems={watchlistTotal}
              onPageChange={handlePageChange}
              sectors={selectedSectors}
              industries={selectedIndustries}
              exchanges={selectedExchanges}
              types={selectedTypes}
              actions={selectedActions}
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
