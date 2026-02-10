import type { Config } from "@netlify/functions";
import { pennyService } from "../../app/analysis/services/pennyService";

async function handler(req: Request) {
  try {
    // No header-based protection — application is public (free)

    const start = Date.now();
    const results = await pennyService.scan();

    const stats = {
      total: results.length,
      durationMs: Date.now() - start,
    };

    return new Response(JSON.stringify({ ok: true, stats }), { status: 200 });
  } catch (error) {
    console.error("cron-pennystocks failed:", error);
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
  schedule: "*/15 * * * *",
};

export default handler;
