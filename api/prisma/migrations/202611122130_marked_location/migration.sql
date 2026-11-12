ALTER TABLE "Listing" ADD COLUMN "locationLatitude" DOUBLE PRECISION,
ADD COLUMN "locationLongitude" DOUBLE PRECISION;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_location_pair_check" CHECK (
  ("locationLatitude" IS NULL AND "locationLongitude" IS NULL) OR
  ("locationLatitude" IS NOT NULL AND "locationLongitude" IS NOT NULL
    AND "locationLatitude" BETWEEN -34 AND 6
    AND "locationLongitude" BETWEEN -74 AND -28)
);
