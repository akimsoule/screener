import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

let connectionString = process.env.DATABASE_URL ?? "";

// Handle SSL configuration for PostgreSQL connections
const forceNoSSL =
  process.env.DATABASE_NO_SSL === "true" ||
  process.env.APP_ENV === "development";

// If no explicit sslmode or uselibpqcompat is provided in DATABASE_URL, default
// to `sslmode=verify-full` to preserve current behavior (avoid libpq compatibility change).
// If you prefer libpq semantics, set `uselibpqcompat=true&sslmode=require` in DATABASE_URL.
// For local development without SSL, set DATABASE_NO_SSL=true or NODE_ENV=development.
if (
  connectionString &&
  !/(?:\?|&|^)sslmode=/i.test(connectionString) &&
  !/uselibpqcompat=/i.test(connectionString)
) {
  const sslMode = forceNoSSL ? "disable" : "verify-full";
  connectionString +=
    (connectionString.includes("?") ? "&" : "?") + `sslmode=${sslMode}`;
  console.warn(
    `DATABASE_URL has no sslmode; defaulting to sslmode=${sslMode}. To opt into libpq compatibility, set 'uselibpqcompat=true&sslmode=require' in DATABASE_URL.`,
  );
}

const adapter = new PrismaPg({ connectionString });

// Ensure a single PrismaClient instance is reused across hot-reloads / multiple function invocations.
declare global {
  // eslint-disable-next-line no-var
  var prismaClientInstance: PrismaClient | undefined;
}

const prisma = globalThis.prismaClientInstance ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaClientInstance = prisma;
}

export { prisma };
