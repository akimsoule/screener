/*
  Warnings:

  - You are about to drop the `PortfolioAnalysis` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PortfolioAnalysis" DROP CONSTRAINT "PortfolioAnalysis_userId_fkey";

-- DropTable
DROP TABLE "PortfolioAnalysis";
