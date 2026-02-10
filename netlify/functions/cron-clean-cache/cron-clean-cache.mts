import type { Config } from "@netlify/functions";
import { cache } from "../../app/lib/cache";
import { logger } from "../../app/lib/logger";

async function handler(req: Request) {
  try {
    logger.info("🧹 Running daily cache cleanup (cron-clean-cache)");

    await cache.cleanupDb();

    return new Response(JSON.stringify({ ok: true, cleaned: true }), {
      status: 200,
    });
  } catch (error) {
    logger.error(
      "cron-clean-cache failed:",
      error instanceof Error ? error.message : String(error),
    );
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500 },
    );
  }
}

export const config: Config = {
  // Run once a day at 00:00 UTC
  schedule: "0 0 * * *",
};

export default handler;
