-- Preserve all financial guardrails while allowing release on payment confirmation.
ALTER TABLE "Coupon" DROP CONSTRAINT "Coupon_values_valid";
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_values_valid" CHECK (
  "discountCents" > 0 AND "rewardCents" > 0 AND "holdDays" BETWEEN 0 AND 365
  AND "reservations" >= 0 AND ("maxUses" IS NULL OR "maxUses" > 0)
  AND cardinality("plans") BETWEEN 1 AND 2 AND "plans" <@ ARRAY['BASIC', 'FEATURED']::TEXT[]
  AND "code" ~ '^[A-Z0-9_-]{3,32}$'
);
