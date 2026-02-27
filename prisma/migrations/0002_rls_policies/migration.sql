-- Enable RLS on users table
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

-- Allow superusers/app owner to bypass RLS (for migrations, admin tasks)
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

-- Policy: SUPER_ADMIN and HR_ADMIN can see all rows
CREATE POLICY "admin_full_access" ON "users"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- Policy: MANAGER can see own row (team-level access added later)
CREATE POLICY "manager_own_access" ON "users"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) = 'MANAGER'
    AND id = current_setting('app.current_user_id', true)
  );

-- Policy: EMPLOYEE can only see own row
CREATE POLICY "employee_own_access" ON "users"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) = 'EMPLOYEE'
    AND id = current_setting('app.current_user_id', true)
  );

-- Bypass policy for when no RLS context is set (e.g., during auth)
CREATE POLICY "bypass_when_no_context" ON "users"
  FOR ALL
  USING (
    current_setting('app.current_user_id', true) IS NULL
    OR current_setting('app.current_user_id', true) = ''
  );
