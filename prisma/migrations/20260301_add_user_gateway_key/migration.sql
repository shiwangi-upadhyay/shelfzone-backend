-- CreateTable
CREATE TABLE "user_gateway_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_gateway_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_gateway_keys_user_id_key" ON "user_gateway_keys"("user_id");

-- CreateIndex
CREATE INDEX "user_gateway_keys_user_id_idx" ON "user_gateway_keys"("user_id");

-- AddForeignKey
ALTER TABLE "user_gateway_keys" ADD CONSTRAINT "user_gateway_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
