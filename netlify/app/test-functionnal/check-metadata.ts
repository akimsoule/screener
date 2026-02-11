import { prisma } from "../lib/prisma";

try {
  const symbols = await prisma.symbol.findMany({
    where: {
      OR: [
        { name: "AAPL" },
        { name: "MSFT" },
        { name: "GOOGL" },
        { name: "META" },
      ],
    },
    select: {
      name: true,
      symbolType: true,
      metadata: true,
    },
  });

  console.log(
    `\n📊 Vérification métadonnées pour ${symbols.length} symboles:\n`,
  );

  for (const s of symbols) {
    console.log(`\n━━━ ${s.name} (${s.symbolType}) ━━━`);

    if (!s.metadata) {
      console.log("⚠️  Pas de métadonnées");
      continue;
    }

    type MetaShape = {
      data?: {
        dividendYield?: number;
        dividendRate?: number;
        trailingAnnualDividendYield?: number;
        trailingAnnualDividendRate?: number;
        marketCap?: number;
        peRatio?: number;
      };
      [k: string]: unknown;
    };

    const meta = s.metadata as unknown as MetaShape;

    console.log("Metadata complet:", JSON.stringify(meta, null, 2));

    console.log(`Data: ${meta.data ? "✅" : "❌"}`);

    if (meta.data) {
      const d = meta.data;
      console.log(`  - dividendYield: ${d.dividendYield ?? "N/A"}`);
      console.log(`  - dividendRate: ${d.dividendRate ?? "N/A"}`);
      console.log(
        `  - trailingAnnualDividendYield: ${d.trailingAnnualDividendYield ?? "N/A"}`,
      );
      console.log(
        `  - trailingAnnualDividendRate: ${d.trailingAnnualDividendRate ?? "N/A"}`,
      );
      console.log(`  - marketCap: ${d.marketCap ?? "N/A"}`);
      console.log(`  - peRatio: ${d.peRatio ?? "N/A"}`);
    }
  }
} catch (error) {
  console.error("Error checking metadata:", error);
} finally {
  await prisma.$disconnect();
  process.exit(0);
}
