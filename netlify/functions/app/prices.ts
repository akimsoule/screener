// prices.ts
// Retrieve price series from Yahoo Finance
import { fetchCloses } from "../lib/yahoo";
import { prisma } from "../lib/prisma";

export async function getPrices(symbol: string, interval: "1d" | "1wk") {
  try {
    const range = interval === "1d" ? "1y" : "2y";
    return await fetchCloses(symbol, interval, range);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error(`getPrices(${symbol}, ${interval}) failed:`, errorMessage);
    // Supprimer le symbole qui provoque l'erreur de fetch
    try {
      await prisma.symbol.deleteMany({
        where: { name: symbol },
      });
      console.log(
        `Supprimé le symbole ${symbol} à cause d'une erreur de fetch`,
      );
    } catch (dbError) {
      console.error(
        `Erreur lors de la suppression du symbole ${symbol}:`,
        dbError,
      );
    }
    return [] as number[];
  }
}

export default getPrices;
