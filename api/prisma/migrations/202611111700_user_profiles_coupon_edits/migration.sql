-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "termsUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "User_cpf_key" ON "User"("cpf");

