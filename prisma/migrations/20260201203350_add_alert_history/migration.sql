-- CreateTable
CREATE TABLE "AlertHistory" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "price" DOUBLE PRECISION,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateSent" TEXT NOT NULL,

    CONSTRAINT "AlertHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertHistory_dateSent_idx" ON "AlertHistory"("dateSent");

-- CreateIndex
CREATE UNIQUE INDEX "AlertHistory_symbol_dateSent_key" ON "AlertHistory"("symbol", "dateSent");
