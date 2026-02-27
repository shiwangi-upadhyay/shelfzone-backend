-- RLS Policies for Agent Portal Tables
-- Convention: app sets role via SET LOCAL app.current_user_id / app.current_user_role

-- ============================================================
-- agent_registry: All authenticated can SELECT active, SUPER_ADMIN/HR_ADMIN CUD
-- ============================================================
ALTER TABLE "agent_registry" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_registry_select" ON "agent_registry"
  FOR SELECT USING (
    current_setting('app.current_user_role', true) IS NOT NULL
    AND (status = 'ACTIVE' OR current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN'))
  );

CREATE POLICY "agent_registry_insert" ON "agent_registry"
  FOR INSERT WITH CHECK (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

CREATE POLICY "agent_registry_update" ON "agent_registry"
  FOR UPDATE USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

CREATE POLICY "agent_registry_delete" ON "agent_registry"
  FOR DELETE USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- ============================================================
-- agent_sessions: SUPER_ADMIN/HR_ADMIN all, users own sessions
-- ============================================================
ALTER TABLE "agent_sessions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_sessions_select" ON "agent_sessions"
  FOR SELECT USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
    OR user_id = current_setting('app.current_user_id', true)
  );

CREATE POLICY "agent_sessions_insert" ON "agent_sessions"
  FOR INSERT WITH CHECK (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
    OR user_id = current_setting('app.current_user_id', true)
  );

CREATE POLICY "agent_sessions_update" ON "agent_sessions"
  FOR UPDATE USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
    OR user_id = current_setting('app.current_user_id', true)
  );

-- ============================================================
-- agent_cost_ledger: SUPER_ADMIN/HR_ADMIN only
-- ============================================================
ALTER TABLE "agent_cost_ledger" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_cost_ledger_all" ON "agent_cost_ledger"
  FOR ALL USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- ============================================================
-- agent_daily_stats: SUPER_ADMIN/HR_ADMIN + MANAGER can SELECT
-- ============================================================
ALTER TABLE "agent_daily_stats" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_daily_stats_select" ON "agent_daily_stats"
  FOR SELECT USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER')
  );

CREATE POLICY "agent_daily_stats_modify" ON "agent_daily_stats"
  FOR ALL USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- ============================================================
-- agent_budgets: SUPER_ADMIN/HR_ADMIN only
-- ============================================================
ALTER TABLE "agent_budgets" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_budgets_all" ON "agent_budgets"
  FOR ALL USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- ============================================================
-- agent_config_log: SUPER_ADMIN/HR_ADMIN only
-- ============================================================
ALTER TABLE "agent_config_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_config_log_all" ON "agent_config_log"
  FOR ALL USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- ============================================================
-- command_log: SUPER_ADMIN/HR_ADMIN all, users own
-- ============================================================
ALTER TABLE "command_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "command_log_select" ON "command_log"
  FOR SELECT USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
    OR user_id = current_setting('app.current_user_id', true)
  );

CREATE POLICY "command_log_insert" ON "command_log"
  FOR INSERT WITH CHECK (
    current_setting('app.current_user_role', true) IS NOT NULL
  );

-- ============================================================
-- agent_api_keys: SUPER_ADMIN/HR_ADMIN only
-- ============================================================
ALTER TABLE "agent_api_keys" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_api_keys_all" ON "agent_api_keys"
  FOR ALL USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- ============================================================
-- Bypass RLS for connections without app context (migrations, etc.)
-- ============================================================
ALTER TABLE "agent_registry" FORCE ROW LEVEL SECURITY;
ALTER TABLE "agent_sessions" FORCE ROW LEVEL SECURITY;
ALTER TABLE "agent_cost_ledger" FORCE ROW LEVEL SECURITY;
ALTER TABLE "agent_daily_stats" FORCE ROW LEVEL SECURITY;
ALTER TABLE "agent_budgets" FORCE ROW LEVEL SECURITY;
ALTER TABLE "agent_config_log" FORCE ROW LEVEL SECURITY;
ALTER TABLE "command_log" FORCE ROW LEVEL SECURITY;
ALTER TABLE "agent_api_keys" FORCE ROW LEVEL SECURITY;

-- Create a bypass role for the application service account
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shelfzone_service') THEN
    CREATE ROLE shelfzone_service NOLOGIN;
  END IF;
END
$$;

-- Grant bypass to service role
ALTER TABLE "agent_registry" OWNER TO shelfzone_service;
ALTER TABLE "agent_sessions" OWNER TO shelfzone_service;
ALTER TABLE "agent_cost_ledger" OWNER TO shelfzone_service;
ALTER TABLE "agent_daily_stats" OWNER TO shelfzone_service;
ALTER TABLE "agent_budgets" OWNER TO shelfzone_service;
ALTER TABLE "agent_config_log" OWNER TO shelfzone_service;
ALTER TABLE "command_log" OWNER TO shelfzone_service;
ALTER TABLE "agent_api_keys" OWNER TO shelfzone_service;
