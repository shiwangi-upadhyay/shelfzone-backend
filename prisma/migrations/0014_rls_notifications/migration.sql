-- ============================================================
-- RLS Policies for Notifications Table
-- ============================================================

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;

-- Bypass when no app context is set (migrations, seeds, background jobs)
CREATE POLICY "notifications_bypass_no_context" ON "notifications"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) IS NULL
    OR current_setting('app.current_user_role', true) = ''
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) IS NULL
    OR current_setting('app.current_user_role', true) = ''
  );

-- HR_ADMIN / SUPER_ADMIN: full CRUD (system announcements)
CREATE POLICY "notifications_admin_full_access" ON "notifications"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('SUPER_ADMIN', 'HR_ADMIN')
  );

-- EMPLOYEE / MANAGER: SELECT own notifications only
CREATE POLICY "notifications_user_select_own" ON "notifications"
  FOR SELECT
  USING (
    current_setting('app.current_user_role', true) IN ('EMPLOYEE', 'MANAGER')
    AND "user_id" = current_setting('app.current_user_id', true)
  );

-- EMPLOYEE / MANAGER: UPDATE own notifications only (mark as read)
CREATE POLICY "notifications_user_update_own" ON "notifications"
  FOR UPDATE
  USING (
    current_setting('app.current_user_role', true) IN ('EMPLOYEE', 'MANAGER')
    AND "user_id" = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) IN ('EMPLOYEE', 'MANAGER')
    AND "user_id" = current_setting('app.current_user_id', true)
  );
