// Requires running database — skip in CI without DB

describe('POST /api/leave/apply', () => {
  test.todo('should apply for leave successfully as authenticated employee');
  test.todo('should reject leave application without required fields');
  test.todo('should validate date range (start before end)');
  test.todo('should check leave balance before applying');
  test.todo('should reject overlapping leave applications');
  test.todo('should reject leave application without authentication');
});

describe('PUT /api/leave/:id/review', () => {
  test.todo('should approve leave successfully as MANAGER');
  test.todo('should reject leave successfully as HR_ADMIN');
  test.todo('should deduct from balance on approval');
  test.todo('should reject review as EMPLOYEE (RBAC)');
  test.todo('should reject review of already reviewed leave');
  test.todo('should return 404 for non-existent leave');
  test.todo('should reject review without authentication');
});

describe('PUT /api/leave/:id/cancel', () => {
  test.todo('should cancel own pending leave as EMPLOYEE');
  test.todo('should restore balance on cancellation');
  test.todo('should reject cancellation of already approved/rejected leave');
  test.todo('should reject cancellation of other employee leave');
  test.todo('should return 404 for non-existent leave');
  test.todo('should reject cancellation without authentication');
});

describe('GET /api/leave', () => {
  test.todo('should list own leaves as EMPLOYEE');
  test.todo('should list all leaves as HR_ADMIN');
  test.todo('should filter by status (PENDING, APPROVED, REJECTED)');
  test.todo('should filter by date range');
  test.todo('should support pagination');
  test.todo('should reject request without authentication');
});

describe('GET /api/leave/:id', () => {
  test.todo('should get leave record by ID successfully');
  test.todo('should enforce ownership for EMPLOYEE role');
  test.todo('should allow MANAGER to view team member leaves');
  test.todo('should return 404 for non-existent leave');
  test.todo('should reject request without authentication');
});
