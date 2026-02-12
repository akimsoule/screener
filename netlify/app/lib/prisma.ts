import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

let connectionString = process.env.DATABASE_URL ?? "";

// If no explicit sslmode or uselibpqcompat is provided in DATABASE_URL, default
// to `sslmode=verify-full` to preserve current behavior (avoid libpq compatibility change).
// If you prefer libpq semantics, set `uselibpqcompat=true&sslmode=require` in DATABASE_URL.
if (
  connectionString &&
  !/(?:\?|&|^)sslmode=/i.test(connectionString) &&
  !/uselibpqcompat=/i.test(connectionString)
) {
  connectionString +=
    (connectionString.includes("?") ? "&" : "?") + "sslmode=verify-full";
  console.warn(
    "DATABASE_URL has no sslmode; defaulting to sslmode=verify-full. To opt into libpq compatibility, set 'uselibpqcompat=true&sslmode=require' in DATABASE_URL.",
  );
}

const adapter = new PrismaPg({ connectionString });

// Ensure a single PrismaClient instance is reused across hot-reloads / multiple function invocations.
declare global {
  // eslint-disable-next-line no-var
  var prismaClientInstance: PrismaClient | undefined;
}

const prisma = global.prismaClientInstance ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  global.prismaClientInstance = prisma;
}

export { prisma };
