#!/usr/bin/env tsx

import { logger } from "../../lib/logger.js";
import { pennyService } from "../../analysis/services/pennyService.js";

async function runBatchPennyStocks() {
  try {
    logger.info("🚀 Running pennyService.scan()...");
    const results = await pennyService.scan();
    console.log("\n📊 RÉSULTATS DU SCANNING:");
    console.log("=".repeat(50));
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    logger.error("❌ Error running pennyService.scan():", err);
  }
}

export { runBatchPennyStocks };
