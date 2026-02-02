const API_PREFIX = "/api";
import { SERVER_PAGE_LIMIT } from "../../netlify/functions/lib/constants";

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

export async function getQuote(symbol: string) {
  const res = await fetch(
    `${API_PREFIX}/quote?symbol=${encodeURIComponent(symbol)}`,
  );
  if (!res.ok) throw new Error(`quote fetch failed: ${res.status}`);
  return res.json();
}

export async function getPrices(symbol: string, interval = "1d", range = "1y") {
  const params = new URLSearchParams({ symbol, interval, range });
  const res = await fetch(`${API_PREFIX}/prices?${params.toString()}`);
  if (!res.ok) throw new Error(`prices fetch failed: ${res.status}`);
  return res.json();
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

  const res = await fetch(`${API_PREFIX}/filters`, { headers });
  if (!res.ok) throw new Error(`filters fetch failed: ${res.status}`);
  return res.json();
}

// Watchlist API (remplace getSymbols)
export async function getWatchlist(token?: string | null) {
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_PREFIX}/watchlist`, { headers });
  if (!res.ok) throw new Error(`watchlist fetch failed: ${res.status}`);
  return res.json();
}

// Deprecated: utiliser getWatchlist
export async function getSymbols() {
  console.warn("getSymbols is deprecated, use getWatchlist instead");
  const res = await fetch(`${API_PREFIX}/symbols`);
  if (!res.ok) throw new Error(`symbols fetch failed: ${res.status}`);
  return res.json();
}

export async function addSymbol(name: string, token?: string | null) {
  const res = await fetch(`${API_PREFIX}/watchlist`, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ message: "Add symbol failed" }));
    throw new Error(error.message || `add symbol failed: ${res.status}`);
  }
  return res.json();
}

export async function runScreener() {
  return runScreenerWithPage(1, SERVER_PAGE_LIMIT);
}

export type ScreenerFilters = {
  sectors?: string[];
  industries?: string[];
  exchanges?: string[];
  types?: string[];
};

export async function runScreenerWithPage(
  page = 1,
  limit = SERVER_PAGE_LIMIT,
  filters?: ScreenerFilters,
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (filters) {
    if (filters.sectors && filters.sectors.length > 0)
      params.set("sector", filters.sectors.join(","));
    if (filters.industries && filters.industries.length > 0)
      params.set("industry", filters.industries.join(","));
    if (filters.exchanges && filters.exchanges.length > 0)
      params.set("exchange", filters.exchanges.join(","));
    if (filters.types && filters.types.length > 0)
      params.set("type", filters.types.join(","));
  }

  const res = await fetch(`${API_PREFIX}/screener?${params.toString()}`, {
    method: "GET",
  });
  if (!res.ok) throw new Error(`screener fetch failed: ${res.status}`);
  return res.json();
}

export async function deleteSymbol(symbolId: string, token?: string | null) {
  const res = await fetch(`${API_PREFIX}/watchlist`, {
    method: "DELETE",
    headers: getAuthHeaders(token),
    body: JSON.stringify({ symbolId }),
  });

  if (!res.ok && res.status !== 204) {
    const error = await res.json().catch(() => ({ message: "Delete failed" }));
    throw new Error(error.message || `delete symbol failed: ${res.status}`);
  }
  return true;
}

export async function getMacroData() {
  const res = await fetch(`${API_PREFIX}/macro`);
  if (!res.ok) throw new Error(`macro fetch failed: ${res.status}`);
  return res.json();
}

export default {
  getQuote,
  getPrices,
  getSymbols, // deprecated
  getWatchlist,
  runScreener,
  addSymbol,
  deleteSymbol,
};
