import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
}

checkSymbols();
