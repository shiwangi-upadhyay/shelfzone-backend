-- ============================================================
-- RLS Policies for Core HR Tables: departments, designations, employees
-- ============================================================

-- ==================== DEPARTMENTS ====================
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "departments" FORCE ROW LEVEL SECURITY;

-- All authenticated users can SELECT
CREATE POLICY "departments_select_authenticated" ON "departments"
  FOR SELECT
  USING (
    current_setting('app.current_user_id', true) IS NOT NULL
    AND current_setting('app.current_user_id', true) != ''
  );

-- Only HR_ADMIN/SUPER_ADMIN can INSERT/UPDATE/DELETE
CREATE POLICY "departments_admin_modify" ON "departments"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- Bypass when no RLS context set (migrations, seeding)
CREATE POLICY "departments_bypass_no_context" ON "departments"
  FOR ALL
  USING (
    current_setting('app.current_user_id', true) IS NULL
    OR current_setting('app.current_user_id', true) = ''
  );

-- ==================== DESIGNATIONS ====================
ALTER TABLE "designations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "designations" FORCE ROW LEVEL SECURITY;

-- All authenticated users can SELECT
CREATE POLICY "designations_select_authenticated" ON "designations"
  FOR SELECT
  USING (
    current_setting('app.current_user_id', true) IS NOT NULL
    AND current_setting('app.current_user_id', true) != ''
  );

-- Only HR_ADMIN/SUPER_ADMIN can INSERT/UPDATE/DELETE
CREATE POLICY "designations_admin_modify" ON "designations"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- Bypass when no RLS context set
CREATE POLICY "designations_bypass_no_context" ON "designations"
  FOR ALL
  USING (
    current_setting('app.current_user_id', true) IS NULL
    OR current_setting('app.current_user_id', true) = ''
  );

-- ==================== EMPLOYEES ====================
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employees" FORCE ROW LEVEL SECURITY;

-- SUPER_ADMIN / HR_ADMIN: full access
CREATE POLICY "employees_admin_full_access" ON "employees"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- MANAGER: SELECT own row + direct reports
CREATE POLICY "employees_manager_select" ON "employees"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'MANAGER'
    AND (
      -- Own row (match via user_id)
      "user_id" = current_setting('app.current_user_id', true)
      -- Direct reports (manager_id = own employee id)
      OR "manager_id" = (
        SELECT id FROM "employees" e2
        WHERE e2."user_id" = current_setting('app.current_user_id', true)
        LIMIT 1
      )
    )
  );

-- EMPLOYEE: SELECT own row only
CREATE POLICY "employees_employee_select" ON "employees"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'EMPLOYEE'
    AND "user_id" = current_setting('app.current_user_id', true)
  );

-- Bypass when no RLS context set
CREATE POLICY "employees_bypass_no_context" ON "employees"
  FOR ALL
  USING (
    current_setting('app.current_user_id', true) IS NULL
    OR current_setting('app.current_user_id', true) = ''
  );
