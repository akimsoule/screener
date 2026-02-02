import type { Config } from "@netlify/functions";
import runAnalysis from "../app/index";
import sendTelegramAlert from "../app/telegram";
import { prisma } from "../lib/prisma";

/**
 * Formate une alerte pour un symbole
 */
function formatAlert(report: any): string {
  let emoji = "⚪";
  if (report.action.includes("ACHAT")) {
    emoji = "🟢";
  } else if (report.action.includes("VENTE")) {
    emoji = "🔴";
  }

  const parts = [
    `${emoji} *${report.symbol}* — ${report.action}`,
    `Score: ${report.score} | Confiance: ${report.confidence}%`,
  ];

  // Ajouter les détails techniques
  addTechnicalDetails(parts, report.details);

  // Ajouter la recommandation
  addRecommendation(parts, report.recommendation);

  // Ajouter l'interprétation
  addInterpretation(parts, report.interpretation);

  return parts.join("\n");
}

function addTechnicalDetails(parts: string[], details: any) {
  if (details?.price != null) {
    parts.push(`Prix: $${Number(details.price).toFixed(2)}`);
  }
  if (details?.rsi != null) {
    parts.push(`RSI: ${Number(details.rsi).toFixed(0)}`);
  }
  if (details?.trendDaily) {
    parts.push(`Tendance: ${details.trendDaily}`);
  }
}

function addRecommendation(parts: string[], recommendation: any) {
  if (recommendation?.side && recommendation.side !== "NONE") {
    parts.push(`➡️ ${recommendation.side}`);
    if (recommendation.entry) parts.push(`Entry: $${recommendation.entry}`);
    if (recommendation.stopLoss) parts.push(`SL: $${recommendation.stopLoss}`);
    if (recommendation.takeProfit)
      parts.push(`TP: $${recommendation.takeProfit}`);
    if (recommendation.riskReward)
      parts.push(`RR: ${recommendation.riskReward}x`);
  }
}

function addInterpretation(parts: string[], interpretation: string) {
  if (interpretation) {
    const shortInterpretation = interpretation.substring(0, 120);
    parts.push(
      `💡 ${shortInterpretation}${interpretation.length > 120 ? "..." : ""}`,
    );
  }
}

export default async function cronScreenerHandler(req: Request) {
  try {
    const payload = await req.json();
    const { next_run } = payload || {};
    console.log("Received cron event. Next invocation at:", next_run);

    // Run the analysis module (returns { date, reports, errors })
    const result = await runAnalysis();
    console.log("Analysis finished:", result.date);

    const { reports = [], errors = [] } = result as any;
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Filtrer les signaux forts (BUY ou SELL uniquement, pas HOLD)
    const strongSignals = reports.filter(
      (r: any) =>
        (r.action === "🟢 STRONG_BUY" ||
          r.action === "🔵 BUY" ||
          r.action === "🔴 STRONG_SELL" ||
          r.action === "🟠 SELL") &&
        r.confidence >= 50, // Seuil de confiance minimum
    );

    console.log(
      `Found ${strongSignals.length} strong signals (filtered from ${reports.length} total)`,
    );

    // Vérifier quels symboles ont déjà été alertés aujourd'hui
    const symbolsToAlert = strongSignals.filter((r: any) => r.symbol);
    const symbolNames = symbolsToAlert.map((r: any) => r.symbol);

    const existingAlerts = await prisma.alertHistory.findMany({
      where: {
        symbol: { in: symbolNames },
        dateSent: today,
      },
    });

    const alreadyAlerted = new Set(existingAlerts.map((a) => a.symbol));
    const newAlerts = symbolsToAlert.filter(
      (r: any) => !alreadyAlerted.has(r.symbol),
    );

    console.log(
      `${newAlerts.length} new alerts to send (${alreadyAlerted.size} already sent today)`,
    );

    if (newAlerts.length === 0) {
      console.log("✅ No new alerts to send today.");
      return new Response(
        JSON.stringify({
          ok: true,
          date: result.date,
          total: reports.length,
          filtered: strongSignals.length,
          new: 0,
          alreadySent: alreadyAlerted.size,
        }),
        { status: 200 },
      );
    }

    // Grouper par action (BUY vs SELL)
    const buys = newAlerts.filter(
      (r: any) => r.action === "🟢 STRONG_BUY" || r.action === "🔵 BUY",
    );
    const sells = newAlerts.filter(
      (r: any) => r.action === "🔴 STRONG_SELL" || r.action === "🟠 SELL",
    );

    // Construire le message Telegram formaté
    const sections: string[] = [
      "📊 *Stock Screener Alert*",
      `📅 ${new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
      "",
    ];

    // Limiter à 10 symboles par catégorie pour éviter messages trop longs
    const MAX_PER_CATEGORY = 10;

    if (buys.length > 0) {
      const topBuys = buys.slice(0, MAX_PER_CATEGORY);
      const alerts = topBuys.flatMap((report: any) => [
        formatAlert(report),
        "",
      ]);
      const buySections = [
        `🟢 *OPPORTUNITÉS D'ACHAT* (${buys.length})`,
        "---",
        ...alerts,
      ];
      if (buys.length > MAX_PER_CATEGORY) {
        buySections.push(`... et ${buys.length - MAX_PER_CATEGORY} autres`, "");
      }
      sections.push(...buySections);
    }

    if (sells.length > 0) {
      const topSells = sells.slice(0, MAX_PER_CATEGORY);
      const alerts = topSells.flatMap((report: any) => [
        formatAlert(report),
        "",
      ]);
      const sellSections = [
        `🔴 *SIGNAUX DE VENTE* (${sells.length})`,
        "---",
        ...alerts,
      ];
      if (sells.length > MAX_PER_CATEGORY) {
        sellSections.push(
          `... et ${sells.length - MAX_PER_CATEGORY} autres`,
          "",
        );
      }
      sections.push(...sellSections);
    }

    sections.push(
      "---",
      `📊 Total analysé: ${reports.length} symboles`,
      `✅ ${newAlerts.length} nouvelles alertes`,
    );

    const message = sections.join("\n");

    // Envoyer l'alerte Telegram
    await sendTelegramAlert(message);
    console.log("📨 Sent aggregated alert with", newAlerts.length, "signals");

    // Enregistrer les alertes en base de données
    await prisma.alertHistory.createMany({
      data: newAlerts.map((r: any) => ({
        symbol: r.symbol,
        action: r.action,
        score: r.score || 0,
        price: r.details?.price || null,
        dateSent: today,
      })),
      skipDuplicates: true, // Éviter les erreurs si déjà inséré
    });

    console.log("💾 Saved", newAlerts.length, "alerts to database");

    if (errors.length > 0) {
      console.warn("⚠️ Analysis errors:", errors);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        date: result.date,
        total: reports.length,
        filtered: strongSignals.length,
        new: newAlerts.length,
        alreadySent: alreadyAlerted.size,
      }),
      { status: 200 },
    );
  } catch (err) {
    console.error("❌ Cron screener failed:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
    });
  }
}

export const config: Config = {
  // Run every day at 9:30 AM EST (market open) and 4:00 PM EST (market close)
  // Cron format: minute hour day month weekday
  // 9:30 AM EST = 14:30 UTC (during standard time)
  schedule: "30 14 * * 1-5", // Lundi à Vendredi à 14h30 UTC
};
