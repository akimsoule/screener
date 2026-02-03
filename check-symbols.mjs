import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkSymbols() {
  const symbols = await prisma.symbol.findMany({
    where: { isPopular: true, enabled: true },
    select: { 
      id: true, 
      name: true, 
      sector: true, 
      industry: true, 
      exchange: true, 
      type: true,
      isPopular: true,
      enabled: true
    }
  });
  
  console.log(`Found ${symbols.length} popular symbols:`);
  console.log(JSON.stringify(symbols, null, 2));
  
  await prisma.$disconnect();
  await pool.end();
}

checkSymbols();
