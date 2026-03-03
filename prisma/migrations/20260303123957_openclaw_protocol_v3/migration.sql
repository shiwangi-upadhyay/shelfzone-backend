-- Add OpenClaw Protocol v3 support

-- Create PairingStatus enum
CREATE TYPE "PairingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Create DevicePairing table
CREATE TABLE "device_pairings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "device_id" TEXT NOT NULL UNIQUE,
    "public_key" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "status" "PairingStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "device_pairings_device_id_idx" ON "device_pairings"("device_id");
CREATE INDEX "device_pairings_status_idx" ON "device_pairings"("status");

-- Add new columns to nodes table
ALTER TABLE "nodes" ADD COLUMN "device_id" TEXT UNIQUE;
ALTER TABLE "nodes" ADD COLUMN "capabilities" JSONB;
ALTER TABLE "nodes" ADD COLUMN "commands" JSONB;
ALTER TABLE "nodes" ADD COLUMN "permissions" JSONB;
