import { prisma } from "../lib/prisma";

export default async function handler(request: Request) {
  try {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === "GET") {
      const symbols = await prisma.symbol.findMany();
      return new Response(JSON.stringify(symbols), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (method === "POST") {
      const { name, enabled = true } = await request.json();
      const symbol = await prisma.symbol.create({ data: { name, enabled } });
      return new Response(JSON.stringify(symbol), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (method === "PUT") {
      const { id, name, enabled } = await request.json();
      const symbol = await prisma.symbol.update({
        where: { id },
        data: { name, enabled },
      });
      return new Response(JSON.stringify(symbol), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (method === "DELETE") {
      const { id } = await request.json();
      await prisma.symbol.delete({ where: { id } });
      return new Response(null, {
        status: 204,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response("Method Not Allowed", { status: 405 });
  } catch (error) {
    console.error("Error in symbols function:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
    });
  }
}
