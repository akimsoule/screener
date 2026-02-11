import { cache } from "../lib/cache";
import { CanadianSymbol } from "../lib/data/provider/types";
import { logger, getErrorMessage } from "../lib/logger";
import { prisma } from "../lib/prisma";

const CANADIAN_EXCHANGES = new Set([
  "TSX",
  "TSXV",
  "CSE",
  "TORONTO",
  "TSX VENTURE",
]);

function isCanadian(symbol: CanadianSymbol) {
  return (
    symbol.assetType === "Stock" &&
    (CANADIAN_EXCHANGES.has(symbol.exchange) ||
      symbol.symbol.endsWith(".TO") ||
      symbol.symbol.endsWith(".V"))
  );
}

const cacheKey = `alphavantage:canadian_symbols`;

try {
  const cached = await cache.getWithFallback<CanadianSymbol[]>(cacheKey);

  // Debugging removed for linting

  if (cached) {
    const filtered = cached.filter(isCanadian);

    logger.debug(
      `📊 Symboles canadiens filtrés: ${filtered.length} / ${cached.length}`,
    );

    console.log("Valeur filtrée en JSON:");
    console.log(JSON.stringify(filtered, null, 2));
  } else {
    logger.debug("Aucune valeur cached trouvée.");
  }
} catch (error) {
  logger.error(
    "❌ Erreur lors de la vérification des symboles canadiens:",
    getErrorMessage(error),
  );
} finally {
  await prisma.$disconnect();
  process.exit(0);
}
