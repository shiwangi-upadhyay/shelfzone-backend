-- ============================================================
-- RLS Policies for Attendance Tables: attendance_records, attendance_summaries
-- ============================================================

-- ==================== ATTENDANCE_RECORDS ====================
ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_records" FORCE ROW LEVEL SECURITY;

-- SUPER_ADMIN / HR_ADMIN: full CRUD
CREATE POLICY "attendance_records_admin_full_access" ON "attendance_records"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- MANAGER: SELECT own + direct reports' records
CREATE POLICY "attendance_records_manager_select" ON "attendance_records"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) = 'MANAGER'
    AND (
      -- Own records (join through employees to match user_id)
      "employee_id" = (
        SELECT id FROM "employees" e
        WHERE e."user_id" = current_setting('app.current_user_id', true)
        LIMIT 1
      )
      -- Direct reports' records
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

-- EMPLOYEE: SELECT own records only
CREATE POLICY "attendance_records_employee_select" ON "attendance_records"
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
CREATE POLICY "attendance_records_bypass_no_context" ON "attendance_records"
  FOR ALL
  USING (
    current_setting('app.current_user_id', true) IS NULL
    OR current_setting('app.current_user_id', true) = ''
  );

-- ==================== ATTENDANCE_SUMMARIES ====================
ALTER TABLE "attendance_summaries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_summaries" FORCE ROW LEVEL SECURITY;

-- SUPER_ADMIN / HR_ADMIN: full CRUD
CREATE POLICY "attendance_summaries_admin_full_access" ON "attendance_summaries"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- MANAGER: SELECT own + direct reports' summaries
CREATE POLICY "attendance_summaries_manager_select" ON "attendance_summaries"
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

-- EMPLOYEE: SELECT own summaries only
CREATE POLICY "attendance_summaries_employee_select" ON "attendance_summaries"
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
CREATE POLICY "attendance_summaries_bypass_no_context" ON "attendance_summaries"
  FOR ALL
  USING (
    current_setting('app.current_user_id', true) IS NULL
    OR current_setting('app.current_user_id', true) = ''
  );
