import type { Config } from "@netlify/functions";
import runAnalysis from "../app/index";
import sendTelegramAlert from "../app/telegram";

export default async function cronScreenerHandler(req: Request) {
  try {
    const payload = await req.json();
    const { next_run } = payload || {};
    console.log("Received cron event. Next invocation at:", next_run);

    // Run the analysis module (returns { date, reports, errors })
    const result = await runAnalysis();
    console.log("Analysis finished:", result.date);

    const { reports = [], errors = [] } = result as any;

    // Aggregate ACHAT / VENTE signals into a single message
    const buys = reports.filter((r: any) => r.action === "ACHAT");
    const sells = reports.filter((r: any) => r.action === "VENTE");

    const sections: string[] = [];
    if (buys.length > 0) {
      sections.push(`=== ACHATS (${buys.length}) ===`);
      for (const r of buys) {
        const parts = [] as string[];
        parts.push(`${r.symbol} — Score: ${r.score}`);
        if (r.details?.price != null)
          parts.push(`Prix: $${Number(r.details.price).toFixed(2)}`);
        if (r.details?.rsi != null)
          parts.push(`RSI: ${Number(r.details.rsi).toFixed(2)}`);
        if (r.details?.trend) parts.push(`Tendance: ${r.details.trend}`);
        sections.push(`- ${parts.join(" | ")}`);
      }
    }

    if (sells.length > 0) {
      sections.push(`=== VENTES (${sells.length}) ===`);
      for (const r of sells) {
        const parts = [] as string[];
        parts.push(`${r.symbol} — Score: ${r.score}`);
        if (r.details?.price != null)
          parts.push(`Prix: $${Number(r.details.price).toFixed(2)}`);
        if (r.details?.rsi != null)
          parts.push(`RSI: ${Number(r.details.rsi).toFixed(2)}`);
        if (r.details?.trend) parts.push(`Tendance: ${r.details.trend}`);
        sections.push(`- ${parts.join(" | ")}`);
      }
    }

    if (sections.length > 0) {
      const header = `Screener Alerts — ${result.date}`;
      const message = [header, ...sections].join("\n");
      await sendTelegramAlert(message);
      console.log("Sent aggregated alert: ", header);
    } else {
      console.log("No buy/sell signals to alert.");
    }

    if (errors.length > 0) {
      console.warn("Analysis errors:", errors);
      // You can choose to send errors as a single Telegram message as well
      // await sendTelegramAlert(`Screener errors:\n${errors.join('\n')}`);
    }

    return new Response(
      JSON.stringify({ ok: true, date: result.date, count: reports.length }),
      { status: 200 },
    );
  } catch (err) {
    console.error("Cron screener failed:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
    });
  }
}

export const config: Config = {
  // Run every 15 minutes
  schedule: "*/15 * * * *",
};
