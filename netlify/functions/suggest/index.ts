import { fetchSuggestions } from "../lib/provider/dataProvider";

export default async function handler(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    if (!q) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const suggestions = await fetchSuggestions(q);

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("suggest function error:", err);
    return new Response(JSON.stringify({ suggestions: [] }), { status: 500 });
  }
}
