-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "affiliateVoidedAt" TIMESTAMP(3),
ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "couponId" TEXT,
ADD COLUMN     "originalAdPrice" INTEGER,
ADD COLUMN     "partnerHoldDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "partnerReward" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "minWithdrawal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "discountCents" INTEGER NOT NULL,
    "rewardCents" INTEGER NOT NULL,
    "holdDays" INTEGER NOT NULL,
    "plans" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER,
    "reservations" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateEntry" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerPayout" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "pixKey" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "receiptReference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PartnerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_userId_key" ON "Partner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "AffiliateEntry_partnerId_payoutId_availableAt_idx" ON "AffiliateEntry"("partnerId", "payoutId", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateEntry_listingId_kind_key" ON "AffiliateEntry"("listingId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerPayout_requestKey_key" ON "PartnerPayout"("requestKey");

-- CreateIndex
CREATE INDEX "PartnerPayout_partnerId_status_idx" ON "PartnerPayout"("partnerId", "status");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateEntry" ADD CONSTRAINT "AffiliateEntry_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateEntry" ADD CONSTRAINT "AffiliateEntry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateEntry" ADD CONSTRAINT "AffiliateEntry_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "PartnerPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerPayout" ADD CONSTRAINT "PartnerPayout_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level guardrails for financial writes, including competing requests.
CREATE UNIQUE INDEX "PartnerPayout_one_requested_per_partner" ON "PartnerPayout"("partnerId") WHERE "status" = 'REQUESTED';
CREATE INDEX "Listing_couponId_paidAt_idx" ON "Listing"("couponId", "paidAt");
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_minWithdrawal_positive" CHECK ("minWithdrawal" > 0);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_values_valid" CHECK (
  "discountCents" > 0 AND "rewardCents" > 0 AND "holdDays" BETWEEN 7 AND 365
  AND "reservations" >= 0 AND ("maxUses" IS NULL OR "maxUses" > 0)
  AND cardinality("plans") BETWEEN 1 AND 2 AND "plans" <@ ARRAY['BASIC', 'FEATURED']::TEXT[]
  AND "code" ~ '^[A-Z0-9_-]{3,32}$'
);
ALTER TABLE "AffiliateEntry" ADD CONSTRAINT "AffiliateEntry_kind_amount_valid" CHECK (
  ("kind" = 'CREDIT' AND "amount" > 0) OR ("kind" = 'REVERSAL' AND "amount" < 0)
);
ALTER TABLE "PartnerPayout" ADD CONSTRAINT "PartnerPayout_state_valid" CHECK (
  "amount" > 0 AND "status" IN ('REQUESTED', 'PAID', 'REJECTED')
  AND ("status" <> 'PAID' OR ("receiptReference" IS NOT NULL AND "resolvedAt" IS NOT NULL))
);
