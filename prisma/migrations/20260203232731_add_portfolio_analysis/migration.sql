-- CreateTable
CREATE TABLE "PortfolioAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "uploadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activitiesFileName" TEXT NOT NULL,
    "holdingsFileName" TEXT NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "totalUnrealizedGain" DOUBLE PRECISION NOT NULL,
    "totalUnrealizedGainPercent" DOUBLE PRECISION NOT NULL,
    "totalCommissions" DOUBLE PRECISION NOT NULL,
    "allocation" JSONB NOT NULL,
    "performance" JSONB NOT NULL,
    "fees" JSONB NOT NULL,
    "diversification" JSONB NOT NULL,
    "risks" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortfolioAnalysis_userId_idx" ON "PortfolioAnalysis"("userId");

-- CreateIndex
CREATE INDEX "PortfolioAnalysis_uploadDate_idx" ON "PortfolioAnalysis"("uploadDate");

-- AddForeignKey
ALTER TABLE "PortfolioAnalysis" ADD CONSTRAINT "PortfolioAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
