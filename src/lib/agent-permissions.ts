/**
 * Agent permission matrix — maps AgentType to allowed operations.
 */

export type AgentOperation =
  | 'employee:read'
  | 'employee:write'
  | 'attendance:read'
  | 'attendance:write'
  | 'leave:read'
  | 'leave:write'
  | 'payroll:read'
  | 'payroll:write'
  | 'report:read'
  | 'report:generate'
  | 'department:read'
  | 'department:write'
  | 'notification:send'
  | 'workflow:execute'
  | 'scheduled:execute'
  | 'integration:call'
  | 'chat:respond';

const PERMISSION_MATRIX: Record<string, AgentOperation[]> = {
  CHAT: [
    'employee:read',
    'attendance:read',
    'leave:read',
    'payroll:read',
    'report:read',
    'department:read',
    'chat:respond',
  ],
  WORKFLOW: [
    'employee:read',
    'employee:write',
    'attendance:read',
    'attendance:write',
    'leave:read',
    'leave:write',
    'payroll:read',
    'report:read',
    'report:generate',
    'department:read',
    'notification:send',
    'workflow:execute',
  ],
  SCHEDULED: ['scheduled:execute', 'report:read', 'report:generate', 'notification:send'],
  INTEGRATION: ['integration:call', 'employee:read', 'attendance:read'],
};

/**
 * Check if an agent type is allowed to perform a given operation.
 */
export function checkAgentPermission(agentType: string, operation: AgentOperation): boolean {
  const allowed = PERMISSION_MATRIX[agentType];
  if (!allowed) return false;
  return allowed.includes(operation);
}

/**
 * Get all allowed operations for an agent type.
 */
export function getAllowedOperations(agentType: string): AgentOperation[] {
  return PERMISSION_MATRIX[agentType] ?? [];
}
