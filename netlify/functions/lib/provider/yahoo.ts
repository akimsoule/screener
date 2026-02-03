// Small Yahoo Finance service for Netlify functions

// Retry helper
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; StockScreener/1.0)",
        },
      });

      // Rate limiting (429) - attendre avant de retry
      if (res.status === 429) {
        const delay = Math.pow(2, attempt) * 1000; // backoff exponentiel
        console.warn(`Rate limited, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (!res.ok) {
        throw new Error(
          `Yahoo Finance API error: ${res.status} ${res.statusText}`,
        );
      }

      return res;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 500;
        console.warn(
          `Fetch attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

export async function fetchChart(
  symbol: string,
  interval = "1d",
  range = "1y",
) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await fetchWithRetry(url);
  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) return null;
  return result;
}

export async function fetchCloses(
  symbol: string,
  interval: string,
  range: string,
) {
  const result = await fetchChart(symbol, interval, range);
  if (!result) return [] as number[];
  const quotes = result.indicators?.quote?.[0] || {};
  const closes = quotes.close || [];
  return closes.filter((v: any): v is number => v !== null && !Number.isNaN(v));
}

export async function fetchQuote(symbol: string) {
  const result = await fetchChart(symbol, "1d", "1d");
  if (!result) return null;
  const meta = result.meta || {};
  return {
    symbol: meta.symbol,
    name: meta.symbol,
    price: meta.regularMarketPrice,
    change: meta.regularMarketChange,
    changePercent: meta.regularMarketChangePercent,
    volume: meta.regularMarketVolume,
    high: meta.dayHigh,
    low: meta.dayLow,
    open: meta.regularMarketOpen,
    previousClose: meta.chartPreviousClose,
  };
}

export async function fetchOHLC(
  symbol: string,
  interval: string,
  range: string,
) {
  const result = await fetchChart(symbol, interval, range);
  if (!result) return [];
  const timestamps = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0] || {};
  const opens = quotes.open || [];
  const highs = quotes.high || [];
  const lows = quotes.low || [];
  const closes = quotes.close || [];
  const volumes =
    result.indicators?.adjclose?.[0]?.adjclose || quotes.volume || [];

  const ohlc: any[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] !== null && closes[i] !== undefined) {
      ohlc.push({
        date: new Date(timestamps[i] * 1000).toISOString(),
        open: opens[i] || closes[i],
        high: highs[i] || closes[i],
        low: lows[i] || closes[i],
        close: closes[i],
        volume: volumes[i] || 0,
      });
    }
  }
  return ohlc;
}

export async function fetchSuggestions(query: string) {
  const yahooUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    query,
  )}&quotesCount=10&newsCount=0`;

  const res = await fetch(yahooUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Yahoo Finance API error: ${res.status}`);
  const data = await res.json();
  const quotes = data.quotes || [];
  const suggestions = quotes.map((q: any) => ({
    symbol: q.symbol,
    name: q.shortname || q.longname || q.exchange || "",
    exchange: q.exchange,
    type: q.typeDisp || q.type || "",
    industry: q.industry || "",
    sector: q.sector || "",
  }));
  return suggestions;
}

export async function fetchSymbolDetails(symbol: string) {
  const suggestions = await fetchSuggestions(symbol);
  return (
    suggestions.find(
      (s: { symbol: string }) =>
        s.symbol.toUpperCase() === symbol.toUpperCase(),
    ) || null
  );
}

export default {
  fetchChart,
  fetchCloses,
  fetchQuote,
  fetchSuggestions,
  fetchSymbolDetails,
};
