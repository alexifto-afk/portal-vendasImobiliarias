ALTER TABLE "Listing"
 ADD COLUMN "category" TEXT NOT NULL DEFAULT 'REAL_ESTATE',
 ADD COLUMN "state" TEXT NOT NULL DEFAULT 'TO',
 ADD COLUMN "details" JSONB NOT NULL DEFAULT '{}',
 ADD COLUMN "contactMode" TEXT NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_contact_mode_valid" CHECK ("contactMode" IN ('PRIVATE', 'DIRECT'));
CREATE INDEX "Listing_category_status_expiresAt_idx" ON "Listing"("category", "status", "expiresAt");
