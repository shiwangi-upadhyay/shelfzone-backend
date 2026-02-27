-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('CHAT', 'WORKFLOW', 'SCHEDULED', 'INTEGRATION');

-- CreateTable
CREATE TABLE "agent_registry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" "AgentType" NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'DRAFT',
    "model" TEXT NOT NULL,
    "system_prompt" TEXT,
    "system_prompt_version" INTEGER NOT NULL DEFAULT 1,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "max_tokens" INTEGER NOT NULL DEFAULT 4096,
    "timeout_ms" INTEGER NOT NULL DEFAULT 30000,
    "capabilities" JSONB,
    "tools" JSONB,
    "metadata" JSONB,
    "team_id" TEXT,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "last_health_check" TIMESTAMP(3),
    "last_health_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "lead_agent_id" TEXT,
    "created_by" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_sessions" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "user_id" TEXT,
    "session_key" TEXT,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "input_preview" TEXT,
    "output_preview" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_cost_ledger" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "input_cost_rate" DOUBLE PRECISION NOT NULL,
    "output_cost_rate" DOUBLE PRECISION NOT NULL,
    "input_cost" DOUBLE PRECISION NOT NULL,
    "output_cost" DOUBLE PRECISION NOT NULL,
    "total_cost" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_cost_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_daily_stats" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "total_sessions" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "timeout_count" INTEGER NOT NULL DEFAULT 0,
    "total_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_output_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_latency_ms" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "p95_latency_ms" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unique_users" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_budgets" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT,
    "team_id" TEXT,
    "monthly_cap_usd" DOUBLE PRECISION NOT NULL,
    "alert_threshold_60" BOOLEAN NOT NULL DEFAULT true,
    "alert_threshold_80" BOOLEAN NOT NULL DEFAULT true,
    "alert_threshold_100" BOOLEAN NOT NULL DEFAULT true,
    "current_spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "auto_pause_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "paused_at" TIMESTAMP(3),
    "paused_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_config_log" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "previous_value" JSONB,
    "new_value" JSONB,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_config_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "command_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "agents_invoked" JSONB,
    "outcome" TEXT NOT NULL,
    "total_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_latency_ms" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "command_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_registry_name_key" ON "agent_registry"("name");

-- CreateIndex
CREATE UNIQUE INDEX "agent_registry_slug_key" ON "agent_registry"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "agent_teams_name_key" ON "agent_teams"("name");

-- CreateIndex
CREATE INDEX "agent_sessions_agent_id_created_at_idx" ON "agent_sessions"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_sessions_user_id_created_at_idx" ON "agent_sessions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_sessions_created_at_idx" ON "agent_sessions"("created_at");

-- CreateIndex
CREATE INDEX "agent_cost_ledger_agent_id_created_at_idx" ON "agent_cost_ledger"("agent_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "agent_daily_stats_agent_id_date_key" ON "agent_daily_stats"("agent_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "agent_budgets_agent_id_team_id_month_year_key" ON "agent_budgets"("agent_id", "team_id", "month", "year");

-- CreateIndex
CREATE INDEX "agent_config_log_agent_id_created_at_idx" ON "agent_config_log"("agent_id", "created_at");

-- CreateIndex
CREATE INDEX "command_log_user_id_created_at_idx" ON "command_log"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "agent_registry" ADD CONSTRAINT "agent_registry_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "agent_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_registry" ADD CONSTRAINT "agent_registry_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_registry" ADD CONSTRAINT "agent_registry_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_teams" ADD CONSTRAINT "agent_teams_lead_agent_id_fkey" FOREIGN KEY ("lead_agent_id") REFERENCES "agent_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_teams" ADD CONSTRAINT "agent_teams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_cost_ledger" ADD CONSTRAINT "agent_cost_ledger_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_cost_ledger" ADD CONSTRAINT "agent_cost_ledger_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_daily_stats" ADD CONSTRAINT "agent_daily_stats_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_budgets" ADD CONSTRAINT "agent_budgets_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_budgets" ADD CONSTRAINT "agent_budgets_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "agent_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_config_log" ADD CONSTRAINT "agent_config_log_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agent_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_config_log" ADD CONSTRAINT "agent_config_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "command_log" ADD CONSTRAINT "command_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

