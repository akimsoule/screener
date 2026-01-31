import { prisma } from "../netlify/functions/lib/prisma";

async function main() {
  const symbols = ["GOLD", "GDXU", "VEQT.TO"];

  const ops = symbols.map((name) =>
    prisma.symbol.upsert({
      where: { name },
      update: {},
      create: { name },
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
