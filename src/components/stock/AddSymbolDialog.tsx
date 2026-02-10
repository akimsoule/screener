import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search } from "lucide-react";

type SymbolType = "CRYPTO" | "US_STOCK" | "CANADIAN_STOCK" | "INTERNATIONAL";

interface Suggestion {
  symbol: string;
  name: string;
  type?: string;
  exchange?: string;
}

interface AddSymbolDialogProps {
  readonly onSymbolAdded: (symbol: string, symbolType: SymbolType) => void;
}

export function AddSymbolDialog({ onSymbolAdded }: AddSymbolDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<SymbolType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  // Réinitialiser quand le dialog s'ouvre/ferme
  useEffect(() => {
    if (!open) {
      setSelectedType(null);
      setSearchQuery("");
      setSuggestions([]);
    }
  }, [open]);

  // Rechercher les suggestions quand la requête change
  useEffect(() => {
    if (!selectedType || !searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/.netlify/functions/suggest?q=${encodeURIComponent(searchQuery)}&type=${selectedType}`,
        );
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, selectedType]);

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    if (selectedType) {
      onSymbolAdded(suggestion.symbol, selectedType);
      setOpen(false);
    }
  };

  const symbolTypes: Array<{
    value: SymbolType;
    label: string;
    description: string;
  }> = [
    {
      value: "CRYPTO",
      label: "Crypto-monnaie",
      description: "Bitcoin, Ethereum, etc.",
    },
    {
      value: "US_STOCK",
      label: "Action US",
      description: "NASDAQ, NYSE",
    },
    {
      value: "CANADIAN_STOCK",
      label: "Action Canadienne",
      description: "TSX, TSX-V",
    },
    {
      value: "INTERNATIONAL",
      label: "Action Internationale",
      description: "Autres bourses",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un symbole
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajouter un nouveau symbole</DialogTitle>
          <DialogDescription>
            Choisissez d'abord le type de symbole, puis recherchez-le.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Étape 1: Sélection du type */}
          {selectedType == null ? (
            <div className="space-y-3">
              <Label>Type de symbole</Label>
              <div className="grid grid-cols-1 gap-2">
                {symbolTypes.map((type) => (
                  <Button
                    key={type.value}
                    variant="outline"
                    className="h-auto py-3 px-4 justify-start"
                    onClick={() => setSelectedType(type.value)}
                  >
                    <div className="text-left">
                      <div className="font-semibold">{type.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {type.description}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Étape 2: Recherche */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Rechercher{" "}
                    <span className="text-xs text-muted-foreground">
                      (
                      {symbolTypes.find((t) => t.value === selectedType)?.label}
                      )
                    </span>
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedType(null)}
                  >
                    Changer de type
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      selectedType === "CRYPTO"
                        ? "Ex: BTC, ETH, SOL..."
                        : "Ex: AAPL, MSFT, GOOGL..."
                    }
                    className="pl-9"
                    autoFocus
                  />
                </div>
              </div>

              {/* Suggestions */}
              <div className="space-y-2">
                {loading && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Recherche...
                  </div>
                )}

                {!loading && suggestions.length > 0 && (
                  <div className="max-h-[300px] overflow-y-auto space-y-1">
                    {suggestions.map((suggestion) => (
                      <Button
                        key={suggestion.symbol}
                        variant="ghost"
                        className="w-full justify-start h-auto py-2 px-3"
                        onClick={() => handleSelectSuggestion(suggestion)}
                      >
                        <div className="text-left flex-1">
                          <div className="font-semibold font-mono">
                            {suggestion.symbol}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {suggestion.name}
                            {suggestion.exchange && ` • ${suggestion.exchange}`}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                )}

                {!loading && suggestions.length === 0 && searchQuery.trim() && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Aucune suggestion trouvée
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
