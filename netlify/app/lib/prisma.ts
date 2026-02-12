import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;

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
