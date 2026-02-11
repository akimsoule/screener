/**
 * Script pour vérifier les correspondances des symboles crypto avec Bitget
 * Vérifie si les symboles normalisés existent sur Bitget
 */

import { existingSymbols } from "../analysis/seeders/existing_symbol";
import { bitget } from "../lib/data/provider/bitget";

try {
  const cryptoSymbols = existingSymbols.filter(
    (s) => s.type === "Cryptocurrency" && /\d/.test(s.name),
  );

  console.log(
    `🔍 Vérification de ${cryptoSymbols.length} symboles crypto avec nombres...\n`,
  );

  for (const symbol of cryptoSymbols) {
    try {
      // Normaliser le symbole comme Bitget le fait
      const normalized = bitget.normalizeSymbol(symbol.name);
      console.log(`📊 ${symbol.name} → ${normalized}`);

      // Essayer de récupérer un quote pour vérifier si le symbole existe
      const quote = await bitget.fetchQuote(symbol.name);

      if (quote) {
        console.log(
          `  ✅ Existe sur Bitget - Dernier prix: ${quote.lastPr || "N/A"}`,
        );
      } else {
        console.log(`  ❌ Pas de données`);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.log(`  ❌ Erreur: ${error.message}`);
      } else {
        console.log(`  ❌ Erreur: ${error}`);
      }
    } finally {
      // Petite pause pour éviter de spammer l'API
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
} catch (error) {
  console.error("Error checking crypto mapping:", error);
} finally {
  process.exit(0);
}
