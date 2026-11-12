CREATE TABLE "WhatsappContact" (
 "id" TEXT NOT NULL PRIMARY KEY, "phone" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
 "consentVersion" TEXT, "consentAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
 "pendingTokenHash" TEXT, "tokenExpiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "WhatsappContact_phone_key" ON "WhatsappContact"("phone");
CREATE UNIQUE INDEX "WhatsappContact_pendingTokenHash_key" ON "WhatsappContact"("pendingTokenHash");
CREATE INDEX "WhatsappContact_status_createdAt_idx" ON "WhatsappContact"("status","createdAt");
CREATE TABLE "WhatsappCampaign" (
 "id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "listingIds" TEXT[], "messageText" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'DRAFT', "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3)
);
CREATE TABLE "WhatsappDelivery" (
 "id" TEXT NOT NULL PRIMARY KEY, "campaignId" TEXT NOT NULL REFERENCES "WhatsappCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "contactId" TEXT NOT NULL REFERENCES "WhatsappContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "status" TEXT NOT NULL DEFAULT 'PENDING',
 "providerMessageId" TEXT, "errorCode" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "WhatsappDelivery_providerMessageId_key" ON "WhatsappDelivery"("providerMessageId");
CREATE UNIQUE INDEX "WhatsappDelivery_campaignId_contactId_key" ON "WhatsappDelivery"("campaignId","contactId");
CREATE INDEX "WhatsappDelivery_status_createdAt_idx" ON "WhatsappDelivery"("status","createdAt");
