-- DropIndex
DROP INDEX "audit_logs_action_idx";

-- DropIndex
DROP INDEX "audit_logs_created_at_idx";

-- DropIndex
DROP INDEX "audit_logs_user_id_idx";

-- DropIndex
DROP INDEX "leave_balances_employee_id_leave_type_year_idx";

-- DropIndex
DROP INDEX "leave_requests_employee_id_status_idx";

-- DropIndex
DROP INDEX "leave_requests_start_date_end_date_idx";

-- CreateTable
CREATE TABLE "task_traces" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "master_agent_id" TEXT,
    "instruction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "totalCost" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "agents_used" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trace_sessions" (
    "id" TEXT NOT NULL,
    "task_trace_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "parent_session_id" TEXT,
    "delegated_by" TEXT,
    "instruction" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "cost" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "tokens_in" INTEGER NOT NULL DEFAULT 0,
    "tokens_out" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trace_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_events" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "from_agent_id" TEXT,
    "to_agent_id" TEXT,
    "content" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_traces_owner_id_idx" ON "task_traces"("owner_id");

-- CreateIndex
CREATE INDEX "task_traces_status_idx" ON "task_traces"("status");

-- CreateIndex
CREATE INDEX "task_traces_started_at_idx" ON "task_traces"("started_at");

-- CreateIndex
CREATE INDEX "trace_sessions_task_trace_id_idx" ON "trace_sessions"("task_trace_id");

-- CreateIndex
CREATE INDEX "trace_sessions_agent_id_idx" ON "trace_sessions"("agent_id");

-- CreateIndex
CREATE INDEX "trace_sessions_parent_session_id_idx" ON "trace_sessions"("parent_session_id");

-- CreateIndex
CREATE INDEX "trace_sessions_status_idx" ON "trace_sessions"("status");

-- CreateIndex
CREATE INDEX "session_events_session_id_idx" ON "session_events"("session_id");

-- CreateIndex
CREATE INDEX "session_events_type_idx" ON "session_events"("type");

-- CreateIndex
CREATE INDEX "session_events_timestamp_idx" ON "session_events"("timestamp");

-- AddForeignKey
ALTER TABLE "task_traces" ADD CONSTRAINT "task_traces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_traces" ADD CONSTRAINT "task_traces_master_agent_id_fkey" FOREIGN KEY ("master_agent_id") REFERENCES "agent_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trace_sessions" ADD CONSTRAINT "trace_sessions_task_trace_id_fkey" FOREIGN KEY ("task_trace_id") REFERENCES "task_traces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trace_sessions" ADD CONSTRAINT "trace_sessions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trace_sessions" ADD CONSTRAINT "trace_sessions_parent_session_id_fkey" FOREIGN KEY ("parent_session_id") REFERENCES "trace_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trace_sessions" ADD CONSTRAINT "trace_sessions_delegated_by_fkey" FOREIGN KEY ("delegated_by") REFERENCES "agent_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "trace_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_from_agent_id_fkey" FOREIGN KEY ("from_agent_id") REFERENCES "agent_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_to_agent_id_fkey" FOREIGN KEY ("to_agent_id") REFERENCES "agent_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
