import type { Config } from "@netlify/functions";
import { runBatch } from "../../app/scripts/batch/runBatchSymbol";

async function handler(req: Request) {
  try {
    // No header-based protection — application is public (free)
    // Allow overriding batch mode via query param: ?batchNumber=ALL

    const start = Date.now();
    const stats = await runBatch("BATCH");

    // Normalize duration
    const response = { ...stats, durationMs: Date.now() - start };

    return new Response(JSON.stringify({ ok: true, stats: response }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("cron-batch-symbol failed:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: (error as Error).message || String(error),
      }),
      { status: 500 },
    );
  }
}

export const config: Config = {
  // Run every 15 minutes by default (same cadence as other crons)
  schedule: "*/15 * * * *",
};

export default handler;
