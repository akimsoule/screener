const API_PREFIX = "/api";

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

export async function getSymbols() {
  const res = await fetch(`${API_PREFIX}/symbols`);
  if (!res.ok) throw new Error(`symbols fetch failed: ${res.status}`);
  return res.json();
}

export async function addSymbol(name: string, enabled = true) {
  const res = await fetch(`${API_PREFIX}/symbols`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, enabled }),
  });
  if (!res.ok) throw new Error(`add symbol failed: ${res.status}`);
  return res.json();
}

export async function runScreener() {
  return runScreenerWithPage(1, 10);
}

export async function runScreenerWithPage(page = 1, limit = 10) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const res = await fetch(`${API_PREFIX}/screener?${params.toString()}`, {
    method: "GET",
  });
  if (!res.ok) throw new Error(`screener fetch failed: ${res.status}`);
  return res.json();
}

export async function deleteSymbol(name: string) {
  // find symbol id by name
  const symbols = await getSymbols();
  const s = symbols.find(
    (x: any) => x.name === name || x.name === name.toUpperCase(),
  );
  if (!s) throw new Error("Symbol not found");

  const res = await fetch(`${API_PREFIX}/symbols`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: s.id }),
  });

  if (!res.ok && res.status !== 204)
    throw new Error(`delete symbol failed: ${res.status}`);
  return true;
}

export default {
  getQuote,
  getPrices,
  getSymbols,
  runScreener,
  addSymbol,
  deleteSymbol,
};
