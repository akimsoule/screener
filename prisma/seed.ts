import { prisma } from "../netlify/functions/lib/prisma";
import { fetchSuggestions } from "../netlify/functions/lib/provider/finnhub";

type Suggestion = {
  symbol?: string;
  name?: string;
  exchange?: string;
  type?: string;
  industry?: string;
  sector?: string;
};

// Helper pour traiter les items par batch afin d'éviter le rate limiting
async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  delayMs: number,
  processor: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}...`,
    );

    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    // Délai entre les batches (sauf pour le dernier)
    if (i + batchSize < items.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

async function main() {
  // Symboles populaires visibles par tous
  const popularSymbols = [
    "AAPL", // Apple
    "MSFT", // Microsoft
    "GOOGL", // Google
    "AMZN", // Amazon
    "TSLA", // Tesla
    "NVDA", // Nvidia
    "META", // Meta
    "SPY", // S&P 500 ETF
    "QQQ", // Nasdaq 100 ETF
    "BTC-USD", // Bitcoin
    "ETH-USD", // Ethereum
    "GLD", // Gold ETF
    "TLT", // Treasury Bonds ETF
  ];
  // 1) Backfill existing symbols in DB that have missing enrichment
  const missing = await prisma.symbol.findMany({
    where: {
      OR: [
        { sector: null },
        { industry: null },
        { exchange: null },
        { type: null },
      ],
    },
    select: {
      id: true,
      name: true,
      sector: true,
      industry: true,
      exchange: true,
      type: true,
    },
  });

  console.log(`Found ${missing.length} symbol(s) needing backfill.`);

  const backfillProcessor = async (row: (typeof missing)[0]) => {
    try {
      const suggestions: Suggestion[] = await fetchSuggestions(row.name);
      const match =
        suggestions.find(
          (s) => s.symbol?.toUpperCase() === row.name.toUpperCase(),
        ) || suggestions[0];
      if (!match) return null;

      const data: Record<string, string> = {};
      if (!row.sector && match.sector) data.sector = match.sector;
      if (!row.industry && match.industry) data.industry = match.industry;
      if (!row.exchange && match.exchange) data.exchange = match.exchange;
      if (!row.type && match.type) data.type = match.type;

      if (Object.keys(data).length === 0) return null;
      return prisma.symbol.update({ where: { id: row.id }, data });
    } catch (err) {
      console.error(`Failed to backfill ${row.name}:`, err);
      return null;
    }
  };

  // Traiter 3 symboles par batch avec délai de 2s entre les batches
  const backfilled = await processBatch(missing, 3, 2000, backfillProcessor);
  console.log(
    `Backfilled ${backfilled.filter(Boolean).length} symbol(s) with missing info.`,
  );

  // 2) Upsert popular symbols (ensure they exist and are enriched)
  console.log(`Processing ${popularSymbols.length} popular symbols...`);

  const upsertProcessor = async (name: string) => {
    let details: {
      sector?: string | undefined;
      industry?: string | undefined;
      exchange?: string | undefined;
      type?: string | undefined;
    } = {};

    try {
      const suggestions: Suggestion[] = await fetchSuggestions(name);
      const match =
        suggestions.find(
          (s) => s.symbol?.toUpperCase() === name.toUpperCase(),
        ) || suggestions[0];
      if (match) {
        details = {
          sector: match.sector || undefined,
          industry: match.industry || undefined,
          exchange: match.exchange || undefined,
          type: match.type || undefined,
        };
      }
    } catch (err) {
      console.error(`Failed to fetch suggestions for ${name}:`, err);
    }

    return prisma.symbol.upsert({
      where: { name },
      update: {
        isPopular: true, // Marquer comme populaire
        sector: details.sector || null,
        industry: details.industry || null,
        exchange: details.exchange || null,
        type: details.type || null,
      },
      create: {
        name,
        isPopular: true, // Marquer comme populaire
        sector: details.sector || null,
        industry: details.industry || null,
        exchange: details.exchange || null,
        type: details.type || null,
      },
    });
  };

  // Traiter 3 symboles par batch avec délai de 2s entre les batches
  const results = await processBatch(popularSymbols, 3, 2000, upsertProcessor);
  console.log(
    "Symboles ajoutés ou mis à jour :",
    results.map((r) => r.name),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed completed successfully.");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
