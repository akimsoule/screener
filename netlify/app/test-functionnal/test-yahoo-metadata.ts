(async () => {
  console.log("📡 Test Yahoo QuoteSummary API pour AAPL...\n");

  try {
    const symbol = "AAPL";
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=summaryDetail,defaultKeyStatistics,financialData`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!res.ok) {
      throw new Error(`Yahoo quoteSummary API error: ${res.status}`);
    }

    const json = (await res.json()) as unknown;

    if (
      typeof json === "object" &&
      json !== null &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (json as any).quoteSummary?.result &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (json as any).quoteSummary.result.length > 0
    ) {
      // Using safe JSON.stringify for fields to avoid implicit 'any' typing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (json as any).quoteSummary.result[0];
      console.log("\n━━━ Summary Detail ━━━");
      const summary = result.summaryDetail;
      console.log(`- dividendYield: ${JSON.stringify(summary?.dividendYield)}`);
      console.log(`- dividendRate: ${JSON.stringify(summary?.dividendRate)}`);
      console.log(
        `- trailingAnnualDividendYield: ${JSON.stringify(
          summary?.trailingAnnualDividendYield,
        )}`,
      );
      console.log(
        `- trailingAnnualDividendRate: ${JSON.stringify(
          summary?.trailingAnnualDividendRate,
        )}`,
      );
      console.log(`- marketCap: ${JSON.stringify(summary?.marketCap)}`);

      console.log("\n━━━ Default Key Stats ━━━");
      const stats = result.defaultKeyStatistics;
      console.log(`- forwardPE: ${JSON.stringify(stats?.forwardPE)}`);
      console.log(`- trailingEps: ${JSON.stringify(stats?.trailingEps)}`);
    } else {
      console.log("Aucun résultat");
    }
  } catch (error) {
    console.error("Erreur:", error);
  } finally {
    process.exit(0);
  }
})();
