-- Create audit_logs table (append-only)
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Create index on common query patterns
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- Prevent UPDATE and DELETE on audit_logs (immutable)
CREATE RULE "audit_logs_no_update" AS ON UPDATE TO "audit_logs" DO INSTEAD NOTHING;
CREATE RULE "audit_logs_no_delete" AS ON DELETE TO "audit_logs" DO INSTEAD NOTHING;
