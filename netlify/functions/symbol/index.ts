import type { Context } from "@netlify/functions";
import { symbolService } from "../../app/analysis/services/symbolService";
import { analysisService } from "../../app/analysis/services/analysisService";
import { fetchRealMacroData } from "../../app/analysis/services/macroDataService";
import { prisma } from "../../app/lib/prisma";

async function handlePut(request: Request) {
  const body = await request.json().catch(() => ({}));
  const symbolName = (body?.symbolName || body?.name || "").toString().trim();
  const symbolType = body?.symbolType;

  if (!symbolName) {
    return new Response(JSON.stringify({ error: "symbolName required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1) Add or get symbol via service
  const addRes = await symbolService.addSymbol({
    symbolName,
    symbolType,
    enabled: true,
  });

  if (!addRes.success) {
    return new Response(
      JSON.stringify({ success: false, error: addRes.error }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // 2) Trigger immediate analysis using real macro data (do not fail the request if analysis fails)
  try {
    const marketContext = await fetchRealMacroData();
    await analysisService.analyzeSymbolWithMacro(
      symbolName,
      marketContext as any,
    );
  } catch (err) {
    console.warn("⚠️ Trigger analysis failed:", err);
  }

  return new Response(
    JSON.stringify({
      success: true,
      symbol: addRes.symbol,
      analysisCached: true,
      cachedAt: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

async function handleDelete(request: Request) {
  const body = await request.json().catch(() => ({}));
  const symbolId = body?.symbolId || body?.id || body?.symbol_id;
  const symbolName = body?.symbolName || body?.name || body?.symbolName;

  let nameToDelete = symbolName;

  if (!nameToDelete && symbolId) {
    // Resolve id -> name
    const row = await prisma.symbol.findUnique({
      where: { id: symbolId },
      select: { name: true },
    });
    if (row) nameToDelete = row.name;
  }

  if (!nameToDelete) {
    return new Response(
      JSON.stringify({ error: "symbolId or symbolName required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const deleted = await symbolService.deleteSymbol(nameToDelete, false);

  if (!deleted) {
    return new Response(
      JSON.stringify({ success: false, error: "Failed to delete symbol" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(request: Request, context: Context) {
  try {
    const method = request.method.toUpperCase();

    if (method === "PUT") return await handlePut(request);
    if (method === "DELETE") return await handleDelete(request);

    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("/symbol failed:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
