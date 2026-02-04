import type { Config, Context } from "@netlify/functions";
import { parse } from "csv-parse/sync";
import { analyzePortfolio } from "./lib/portfolioAnalyzer";
import { generateMarkdownReport } from "./lib/markdownGenerator";
import { requireAuth } from "../lib/auth";
import type {
  WealthsimpleActivity,
  WealthsimpleHolding,
} from "../../../src/types/portfolio";

const handler = async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Vérifier l'authentification
    const payload = requireAuth(req);
    const userId = payload.userId;

    // Parser le multipart form data
    const formData = await req.formData();
    const activitiesFile = formData.get("activitiesFile") as File;
    const holdingsFile = formData.get("holdingsFile") as File;

    if (!activitiesFile || !holdingsFile) {
      return new Response(
        JSON.stringify({
          error: "Both activities and holdings files are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Valider les noms de fichiers
    if (
      !activitiesFile.name.endsWith(".csv") ||
      !holdingsFile.name.endsWith(".csv")
    ) {
      return new Response(
        JSON.stringify({ error: "Files must be in CSV format" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Lire et parser les fichiers CSV
    const activitiesText = await activitiesFile.text();
    const holdingsText = await holdingsFile.text();

    const activities = parse(activitiesText, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true, // Permet des lignes avec un nombre différent de colonnes
      skip_records_with_error: true, // Ignore les lignes avec erreurs
      cast: (value, context) => {
        // Convertir les nombres
        if (
          context.column === "quantite" ||
          context.column === "prix_unitaire" ||
          context.column === "commission" ||
          context.column === "montant_net_especes"
        ) {
          return Number.parseFloat(value) || 0;
        }
        return value;
      },
    }) as WealthsimpleActivity[];

    const holdings = parse(holdingsText, {
      columns: (header) => {
        // Normaliser les noms de colonnes
        return header.map((col: string) =>
          col
            .toLowerCase()
            .replaceAll(/\s+/g, "_")
            .replaceAll(/[éè]/g, "e")
            .replaceAll(/[àâ]/g, "a"),
        );
      },
      skip_empty_lines: true,
      relax_column_count: true, // Permet des lignes avec un nombre différent de colonnes
      skip_records_with_error: true, // Ignore les lignes avec erreurs
      cast: (value, context) => {
        // Convertir les nombres pour les colonnes pertinentes
        const numericColumns = [
          "quantite",
          "prix_du_marche",
          "valeur_comptable_cad",
          "valeur_comptable_marche",
          "valeur_marchande",
          "rendements_non_realises_du_marche",
        ];
        if (numericColumns.includes(context.column as string)) {
          return Number.parseFloat(value) || 0;
        }
        return value;
      },
    }) as WealthsimpleHolding[];

    // Analyser le portefeuille (maintenant async)
    const analysis = await analyzePortfolio(activities, holdings);

    // Générer le rapport Markdown
    const markdown = generateMarkdownReport(analysis);

    // Créer le nom du fichier avec la date
    const date = new Date().toISOString().split("T")[0];
    const filename = `analyse-portefeuille-${date}.md`;

    // Retourner le fichier Markdown en téléchargement
    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Portfolio analysis error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to analyze portfolio",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config: Config = {
  path: "/api/portfolio/analyze",
};

export default handler;
