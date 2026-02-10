#!/usr/bin/env tsx
import "dotenv/config";
import { runBatch } from "./batch/runBatchSymbol";

async function main() {
  try {
    const stats = await runBatch();
    console.log("Batch runner finished:", stats);
    process.exit(stats.errors === 0 ? 0 : 1);
  } catch (err) {
    console.error(
      "Batch runner failed:",
      err instanceof Error ? err.message : err,
    );
    process.exit(2);
  }
}

main();
