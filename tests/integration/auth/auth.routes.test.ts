// Requires running database — skip in CI without DB

describe('POST /api/auth/register', () => {
  test.todo('should register a new user successfully');
  test.todo('should reject duplicate email');
  test.todo('should reject invalid input');
});

describe('POST /api/auth/login', () => {
  test.todo('should login successfully with valid credentials');
  test.todo('should reject wrong password');
  test.todo('should reject non-existent email');
  test.todo('should reject inactive user');
});

describe('POST /api/auth/refresh', () => {
  test.todo('should refresh tokens successfully');
  test.todo('should reject invalid refresh token');
  test.todo('should reject expired refresh token');
});

describe('POST /api/auth/logout', () => {
  test.todo('should logout successfully');
  test.todo('should fail without auth token');
});

describe('GET /api/auth/me', () => {
  test.todo('should return current user with valid token');
  test.todo('should fail without auth token');
  test.todo('should fail with expired token');
});
