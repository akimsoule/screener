import type { Context } from "@netlify/functions";
import runAnalysis from "../app/index";

export default async function handler(request: Request, context: Context) {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const limit = Math.max(1, Number(url.searchParams.get("limit") || "10"));

    const result = await runAnalysis();
    const allReports = result.reports || [];
    const total = allReports.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const start = (page - 1) * limit;
    const end = page * limit;
    const reports = allReports.slice(start, end);

    return new Response(
      JSON.stringify({
        date: result.date,
        reports,
        total,
        page,
        limit,
        totalPages,
        errors: result.errors,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
