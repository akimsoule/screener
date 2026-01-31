import { prisma } from "../netlify/functions/lib/prisma";
import { fetchSuggestions } from "../netlify/functions/lib/yahoo";

async function main() {
  const symbols = ["GOLD", "GDXU", "VEQT.TO"];
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

  const backfillOps = missing.map(async (row) => {
    try {
      const suggestions = await fetchSuggestions(row.name);
      const match =
        suggestions.find(
          (s: any) => s.symbol?.toUpperCase() === row.name.toUpperCase(),
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
  });

  const backfilled = await Promise.all(backfillOps);
  console.log(
    `Backfilled ${backfilled.filter(Boolean).length} symbol(s) with missing info.`,
  );

  // 2) Upsert example symbols (ensure they exist and are enriched)
  const ops = await Promise.all(
    symbols.map(async (name) => {
      let details: {
        sector?: string | undefined;
        industry?: string | undefined;
        exchange?: string | undefined;
        type?: string | undefined;
      } = {};

      try {
        const suggestions = await fetchSuggestions(name);
        const match =
          suggestions.find(
            (s: any) => s.symbol?.toUpperCase() === name.toUpperCase(),
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
          sector: details.sector || null,
          industry: details.industry || null,
          exchange: details.exchange || null,
          type: details.type || null,
        },
        create: {
          name,
          sector: details.sector || null,
          industry: details.industry || null,
          exchange: details.exchange || null,
          type: details.type || null,
        },
      });
    }),
  );

  const results = await Promise.all(ops);
  console.log(
    "Symboles ajoutés ou mis à jour :",
    results.map((r) => r.name),
  );
}

await main();
await prisma.$disconnect();
