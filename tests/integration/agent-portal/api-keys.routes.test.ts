describe('Agent Portal - API Key Routes', () => {
  describe('POST /api/agent-portal/agents/:agentId/api-keys', () => {
    test.todo('should create new API key for agent');
    test.todo('should generate secure random key');
    test.todo('should set expiry date if provided');
    test.todo('should return plaintext key only once');
    test.todo('should deny access to unauthorized roles');
  });

  describe('GET /api/agent-portal/agents/:agentId/api-keys', () => {
    test.todo('should list all API keys for agent');
    test.todo('should NOT include plaintext keys (only masked)');
    test.todo('should show active vs revoked status');
    test.todo('should include last used timestamp');
    test.todo('should require SUPER_ADMIN/HR_ADMIN role');
  });

  describe('POST /api/agent-portal/api-keys/:id/rotate', () => {
    test.todo('should rotate API key (revoke old, create new)');
    test.todo('should generate new secure key');
    test.todo('should mark old key as revoked');
    test.todo('should return new plaintext key only once');
    test.todo('should require SUPER_ADMIN/HR_ADMIN role');
  });

  describe('DELETE /api/agent-portal/api-keys/:id', () => {
    test.todo('should revoke API key');
    test.todo('should mark key as inactive');
    test.todo('should prevent future use of the key');
    test.todo('should return error if key already revoked');
    test.todo('should require SUPER_ADMIN/HR_ADMIN role');
  });
});
