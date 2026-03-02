-- CreateEnum
CREATE TYPE "SharePermission" AS ENUM ('control', 'view');

-- CreateEnum
CREATE TYPE "ShareMode" AS ENUM ('route', 'collaborate', 'transfer');

-- CreateEnum
CREATE TYPE "ShareStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "agent_shares" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "shared_with_user_id" TEXT NOT NULL,
    "permission" "SharePermission" NOT NULL DEFAULT 'view',
    "mode" "ShareMode" NOT NULL DEFAULT 'route',
    "status" "ShareStatus" NOT NULL DEFAULT 'active',
    "conversation_id" TEXT,
    "cost_limit" DECIMAL(10,6),
    "cost_used" DECIMAL(10,6) DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_shares_agent_id_idx" ON "agent_shares"("agent_id");

-- CreateIndex
CREATE INDEX "agent_shares_owner_id_idx" ON "agent_shares"("owner_id");

-- CreateIndex
CREATE INDEX "agent_shares_shared_with_user_id_idx" ON "agent_shares"("shared_with_user_id");

-- CreateIndex
CREATE INDEX "agent_shares_status_idx" ON "agent_shares"("status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_shares_agent_id_shared_with_user_id_status_key" ON "agent_shares"("agent_id", "shared_with_user_id", "status");

-- AddForeignKey
ALTER TABLE "agent_shares" ADD CONSTRAINT "agent_shares_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_shares" ADD CONSTRAINT "agent_shares_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_shares" ADD CONSTRAINT "agent_shares_shared_with_user_id_fkey" FOREIGN KEY ("shared_with_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_shares" ADD CONSTRAINT "agent_shares_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
