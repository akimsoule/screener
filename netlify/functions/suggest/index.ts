export default async function handler(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    if (!q) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const yahooUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      q,
    )}&quotesCount=10&newsCount=0`;

    const res = await fetch(yahooUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) {
      return new Response(JSON.stringify({ suggestions: [] }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    const data = await res.json();
    const quotes = data.quotes || [];
    const suggestions = quotes.map((q: any) => ({ symbol: q.symbol, name: q.shortname || q.longname || q.exchange || "", exchange: q.exchange }));

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("suggest function error:", err);
    return new Response(JSON.stringify({ suggestions: [] }), { status: 500 });
  }
}
