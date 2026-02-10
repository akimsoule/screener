import { FRONT_PAGE_LIMIT } from "./Constant";
import type { MacroRegime, AssetClassBias } from "@/types/stock";

const API_PREFIX = "/api";
const SERVER_PAGE_LIMIT = FRONT_PAGE_LIMIT; // Use front-page default as canonical default

// Helper to get auth headers
function getAuthHeaders(token?: string | null): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

export async function searchSymbols(query: string) {
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`${API_PREFIX}/suggest?${params.toString()}`);
  if (!res.ok) throw new Error(`suggest fetch failed: ${res.status}`);
  return res.json();
}

export async function getFilters(token?: string | null) {
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_PREFIX}/filter`, { headers });
  if (!res.ok) throw new Error(`filters fetch failed: ${res.status}`);
  return res.json();
}

// Watchlist API (remplace getSymbols / screener)
export type ScreenerFilters = {
  sectors?: string[];
  industries?: string[];
  exchanges?: string[];
  types?: string[];
  actions?: string[];
};

function applyScreenerFilters(
  params: URLSearchParams,
  filters?: ScreenerFilters,
) {
  if (!filters) return;
  const setIf = (key: string, arr?: string[]) => {
    if (arr && arr.length > 0) params.set(key, arr.join(","));
  };
  setIf("sector", filters.sectors);
  setIf("industry", filters.industries);
  setIf("exchange", filters.exchanges);
  setIf("type", filters.types);
  setIf("action", filters.actions);
}

export async function getWatchlist(
  page: number | null | undefined = 1,
  limit: number | null | undefined = SERVER_PAGE_LIMIT,
  filters?: ScreenerFilters,
  token?: string | null,
) {
  const normalizedPage =
    Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const normalizedLimit =
    Number.isFinite(Number(limit)) && Number(limit) > 0
      ? Number(limit)
      : SERVER_PAGE_LIMIT;

  const params = new URLSearchParams({
    page: String(normalizedPage),
    limit: String(normalizedLimit),
  });

  applyScreenerFilters(params, filters);

  const headers: HeadersInit = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_PREFIX}/watchlist?${params.toString()}`, {
    method: "GET",
    headers,
  });
  if (!res.ok) throw new Error(`watchlist fetch failed: ${res.status}`);
  return res.json();
}

export async function addSymbol(
  name: string,
  token?: string | null,
  symbolType?: string,
) {
  const body: { symbolName: string; symbolType?: string } = {
    symbolName: name,
  };
  if (symbolType) {
    body.symbolType = symbolType;
  }

  const res = await fetch(`${API_PREFIX}/symbol`, {
    method: "PUT",
    headers: getAuthHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ message: "Add symbol failed" }));
    throw new Error(error.message || `add symbol failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteSymbol(
  symbolIdOrName: string,
  token?: string | null,
) {
  const body = { symbolId: symbolIdOrName };
  const res = await fetch(`${API_PREFIX}/symbol`, {
    method: "DELETE",
    headers: getAuthHeaders(token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Delete failed" }));
    throw new Error(error.message || `delete symbol failed: ${res.status}`);
  }
  return true;
}

export async function refreshCache() {
  const res = await fetch(`${API_PREFIX}/refresh`, { method: "POST" });

  if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
  return res.json();
}

export type MacroApiResponse = {
  timestamp: string | null;
  marketData: {
    fedDotPlot2025: number;
    marketPricing2025: number;
    ismPmi: number;
    dxyMomentum: number;
    m2Growth: number;
    nfpSurprise: number;
  } | null;
  macroRegime: MacroRegime;
  assetBias: AssetClassBias;
  insights?: string[];
  confidence?: number;
  metadata?: Record<string, any> | null;
  cached?: boolean;
  cacheTs?: string | null;
  regimeChanged?: boolean;
  previousRegime?: string;
};

export async function getMacroData(): Promise<MacroApiResponse> {
  const res = await fetch(`${API_PREFIX}/macro`);
  if (!res.ok) throw new Error(`macro fetch failed: ${res.status}`);
  return res.json();
}

export default {
  getWatchlist,
  addSymbol,
  deleteSymbol,
  refreshCache,
  getMacroData,
};
