import type { Context } from "@netlify/functions";
import { analyzeMacroContextWithRealData } from "../../app/analysis/services/macroService";

// NOTE: fetching real macro data is delegated to the service (`macroDataService`).
// The function handler must use the service only to ensure caching + TTL are applied
// consistently and to avoid duplicated network calls from the function layer.

export default async function handler(request: Request, context: Context) {
  try {
    // Use the macro service which handles caching and analysis
    const macroResult = await analyzeMacroContextWithRealData();

    // Exposer le marketData de façon sûre (le type est défini dans le service)
    const marketData = (macroResult as any).marketData ?? null;

    return new Response(
      JSON.stringify({
        // Timestamp de la source si disponible
        timestamp: macroResult.metadata?.timestamp ?? new Date().toISOString(),
        marketData,
        macroRegime: macroResult.regime,
        assetBias: macroResult.assetBias,
        insights: macroResult.insights,
        confidence: macroResult.confidence,
        metadata: macroResult.metadata,
        cached: macroResult.fromCache === true,
        cacheTs: macroResult.metadata?.timestamp ?? null,
        regimeChanged: macroResult.regimeChanged ?? false,
        previousRegime: macroResult.previousRegime ?? undefined,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
        },
      },
    );
  } catch (error) {
    console.error("Macro analysis failed:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to analyze macro conditions",
        message: (error as Error).message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
