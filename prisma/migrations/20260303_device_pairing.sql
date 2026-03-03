-- Device Pairing System Migration
-- Adds device identity, pairing approval, and device tokens

-- Add device identity fields to Node table
ALTER TABLE "nodes" 
  ADD COLUMN IF NOT EXISTS "device_id" VARCHAR,
  ADD COLUMN IF NOT EXISTS "public_key" TEXT,
  ADD COLUMN IF NOT EXISTS "device_token_hash" VARCHAR,
  ADD COLUMN IF NOT EXISTS "capabilities" JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "permissions" JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "pairing_approved" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "pairing_approved_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "pairing_approved_by" VARCHAR,
  ADD COLUMN IF NOT EXISTS "auto_approved" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "token_expires_at" TIMESTAMPTZ;

-- Create index on device_id for fast lookups
CREATE INDEX IF NOT EXISTS "idx_nodes_device_id" ON "nodes" ("device_id");
CREATE INDEX IF NOT EXISTS "idx_nodes_pairing_approved" ON "nodes" ("pairing_approved");

-- Add foreign key for pairing approver
ALTER TABLE "nodes" 
  ADD CONSTRAINT "fk_nodes_pairing_approved_by" 
  FOREIGN KEY ("pairing_approved_by") 
  REFERENCES "users" ("id") 
  ON DELETE SET NULL;

-- Create device_pairing_requests table for pending approvals
CREATE TABLE IF NOT EXISTS "device_pairing_requests" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "device_id" VARCHAR NOT NULL,
  "public_key" TEXT NOT NULL,
  "user_id" VARCHAR NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "node_key" VARCHAR NOT NULL,
  "platform" VARCHAR,
  "ip_address" VARCHAR,
  "user_agent" VARCHAR,
  "capabilities" JSONB DEFAULT '[]',
  "status" VARCHAR NOT NULL DEFAULT 'pending',
  "approved_by" VARCHAR REFERENCES "users" ("id") ON DELETE SET NULL,
  "approved_at" TIMESTAMPTZ,
  "rejected_reason" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expires_at" TIMESTAMPTZ NOT NULL
);

-- Create indexes for pairing requests
CREATE INDEX IF NOT EXISTS "idx_pairing_requests_status" ON "device_pairing_requests" ("status");
CREATE INDEX IF NOT EXISTS "idx_pairing_requests_user" ON "device_pairing_requests" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_pairing_requests_device" ON "device_pairing_requests" ("device_id");

-- Add security audit fields to audit_logs
ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "severity" VARCHAR DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS "device_id" VARCHAR;

CREATE INDEX IF NOT EXISTS "idx_audit_logs_device" ON "audit_logs" ("device_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_severity" ON "audit_logs" ("severity");
