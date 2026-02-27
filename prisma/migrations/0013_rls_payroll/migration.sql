-- ============================================================
-- RLS Policies for Payroll Tables: salary_structures, payroll_runs, payslips
-- ============================================================

-- ==================== SALARY_STRUCTURES ====================
ALTER TABLE "salary_structures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "salary_structures" FORCE ROW LEVEL SECURITY;

-- HR_ADMIN / SUPER_ADMIN: full CRUD
CREATE POLICY "salary_structures_admin_full_access" ON "salary_structures"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- EMPLOYEE: SELECT own only
CREATE POLICY "salary_structures_employee_select" ON "salary_structures"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'EMPLOYEE'
    AND "employee_id" = (
      SELECT id FROM "employees" e
      WHERE e."user_id" = current_setting('app.current_user_id', true)
      LIMIT 1
    )
  );

-- MANAGER: explicitly denied (no policy grants access)

-- Bypass when no RLS context set (migrations, seeding)
CREATE POLICY "salary_structures_bypass_no_context" ON "salary_structures"
  FOR ALL
  USING (
    current_setting('app.current_user_id', true) IS NULL
    OR current_setting('app.current_user_id', true) = ''
  );

-- ==================== PAYROLL_RUNS ====================
ALTER TABLE "payroll_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_runs" FORCE ROW LEVEL SECURITY;

-- Only HR_ADMIN / SUPER_ADMIN: full CRUD
CREATE POLICY "payroll_runs_admin_full_access" ON "payroll_runs"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- Bypass when no RLS context set (migrations, seeding)
CREATE POLICY "payroll_runs_bypass_no_context" ON "payroll_runs"
  FOR ALL
  USING (
    current_setting('app.current_user_id', true) IS NULL
    OR current_setting('app.current_user_id', true) = ''
  );

-- ==================== PAYSLIPS ====================
ALTER TABLE "payslips" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payslips" FORCE ROW LEVEL SECURITY;

-- HR_ADMIN / SUPER_ADMIN: full CRUD
CREATE POLICY "payslips_admin_full_access" ON "payslips"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- EMPLOYEE: SELECT own only
CREATE POLICY "payslips_employee_select" ON "payslips"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'EMPLOYEE'
    AND "employee_id" = (
      SELECT id FROM "employees" e
      WHERE e."user_id" = current_setting('app.current_user_id', true)
      LIMIT 1
    )
  );

-- MANAGER: explicitly denied (no policy grants access)

-- Bypass when no RLS context set (migrations, seeding)
CREATE POLICY "payslips_bypass_no_context" ON "payslips"
  FOR ALL
  USING (
    current_setting('app.current_user_id', true) IS NULL
    OR current_setting('app.current_user_id', true) = ''
  );
