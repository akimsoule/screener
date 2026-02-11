(async () => {
  try {
    console.log("📡 Test Yahoo Chart API pour AAPL...\n");

    const symbol = "AAPL";
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Yahoo API error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as unknown;
    // Guard and cast conservatively to avoid 'any'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (json as any).chart?.result?.[0];

    if (result) {
      console.log("\n━━━ Result Meta ━━━");
      const meta = result.meta;
      console.log(`- symbol: ${meta?.symbol}`);
      console.log(`- currency: ${meta?.currency}`);
      console.log(`- regularMarketPrice: ${meta?.regularMarketPrice}`);
      console.log(`- previousClose: ${meta?.previousClose}`);
      console.log(`- chartPreviousClose: ${meta?.chartPreviousClose}`);

      console.log("\n━━━ Meta complet ━━━");
      console.log(JSON.stringify(meta, null, 2));
    } else {
      console.log("Aucun résultat");
    }
  } catch (error) {
    console.error("Erreur:", error);
  } finally {
    process.exit(0);
  }
})();
