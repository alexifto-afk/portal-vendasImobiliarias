ALTER TABLE "Listing" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "renewalOfId" TEXT;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_renewalOfId_fkey" FOREIGN KEY ("renewalOfId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Listing_renewalOfId_idx" ON "Listing"("renewalOfId");
CREATE UNIQUE INDEX "Listing_one_live_renewal" ON "Listing"("renewalOfId") WHERE "renewalOfId" IS NOT NULL AND "deletedAt" IS NULL;
CREATE INDEX "Listing_images_idx" ON "Listing" USING GIN ("images");
