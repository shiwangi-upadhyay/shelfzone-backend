-- ============================================================
-- RLS Policies for Leave Tables: leave_policies, leave_balances, leave_requests
-- ============================================================

-- ==================== LEAVE_POLICIES ====================
ALTER TABLE "leave_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_policies" FORCE ROW LEVEL SECURITY;

-- All authenticated users can SELECT
CREATE POLICY "leave_policies_authenticated_select" ON "leave_policies"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE')
  );

-- Only HR_ADMIN / SUPER_ADMIN can INSERT/UPDATE/DELETE
CREATE POLICY "leave_policies_admin_modify" ON "leave_policies"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- Bypass when no RLS context set (migrations, seeding)
CREATE POLICY "leave_policies_bypass_no_context" ON "leave_policies"
  FOR ALL
  USING (
    current_setting('app.current_user_id', true) IS NULL
    OR current_setting('app.current_user_id', true) = ''
  );

-- ==================== LEAVE_BALANCES ====================
ALTER TABLE "leave_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_balances" FORCE ROW LEVEL SECURITY;

-- SUPER_ADMIN / HR_ADMIN: full CRUD
CREATE POLICY "leave_balances_admin_full_access" ON "leave_balances"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- MANAGER: SELECT own + direct reports
CREATE POLICY "leave_balances_manager_select" ON "leave_balances"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'MANAGER'
    AND (
      "employee_id" = (
        SELECT id FROM "employees" e
        WHERE e."user_id" = current_setting('app.current_user_id', true)
        LIMIT 1
      )
      OR "employee_id" IN (
        SELECT id FROM "employees" e
        WHERE e."manager_id" = (
          SELECT id FROM "employees" e2
          WHERE e2."user_id" = current_setting('app.current_user_id', true)
          LIMIT 1
        )
      )
    )
  );

-- EMPLOYEE: SELECT own only
CREATE POLICY "leave_balances_employee_select" ON "leave_balances"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'EMPLOYEE'
    AND "employee_id" = (
      SELECT id FROM "employees" e
      WHERE e."user_id" = current_setting('app.current_user_id', true)
      LIMIT 1
    )
  );

-- Bypass when no RLS context set (migrations, seeding)
CREATE POLICY "leave_balances_bypass_no_context" ON "leave_balances"
  FOR ALL
  USING (
    current_setting('app.current_user_id', true) IS NULL
    OR current_setting('app.current_user_id', true) = ''
  );

-- ==================== LEAVE_REQUESTS ====================
ALTER TABLE "leave_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_requests" FORCE ROW LEVEL SECURITY;

-- SUPER_ADMIN / HR_ADMIN: full CRUD
CREATE POLICY "leave_requests_admin_full_access" ON "leave_requests"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- MANAGER: SELECT own + direct reports' requests
CREATE POLICY "leave_requests_manager_select" ON "leave_requests"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'MANAGER'
    AND (
      "employee_id" = (
        SELECT id FROM "employees" e
        WHERE e."user_id" = current_setting('app.current_user_id', true)
        LIMIT 1
      )
      OR "employee_id" IN (
        SELECT id FROM "employees" e
        WHERE e."manager_id" = (
          SELECT id FROM "employees" e2
          WHERE e2."user_id" = current_setting('app.current_user_id', true)
          LIMIT 1
        )
      )
    )
  );

-- EMPLOYEE: SELECT own only
CREATE POLICY "leave_requests_employee_select" ON "leave_requests"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'EMPLOYEE'
    AND "employee_id" = (
      SELECT id FROM "employees" e
      WHERE e."user_id" = current_setting('app.current_user_id', true)
      LIMIT 1
    )
  );

-- Bypass when no RLS context set (migrations, seeding)
CREATE POLICY "leave_requests_bypass_no_context" ON "leave_requests"
  FOR ALL
  USING (
    current_setting('app.current_user_id', true) IS NULL
    OR current_setting('app.current_user_id', true) = ''
  );
