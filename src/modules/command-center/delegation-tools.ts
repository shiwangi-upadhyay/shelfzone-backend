/**
 * Tool definitions for Anthropic API
 * Used by SHIWANGI to delegate tasks to sub-agents
 */

export const DELEGATE_TOOL = {
  name: 'delegate',
  description: 'Delegate a task to a specialized sub-agent. Use this when you need specialist work (backend, frontend, database, testing, or documentation). The sub-agent will complete the task and return results.',
  input_schema: {
    type: 'object',
    properties: {
      agentName: {
        type: 'string',
        enum: ['BackendForge', 'UIcraft', 'DataArchitect', 'TestRunner', 'DocSmith'],
        description: 'Which sub-agent to delegate to. BackendForge: API/backend work. UIcraft: UI/frontend work. DataArchitect: database schema. TestRunner: tests. DocSmith: documentation.',
      },
      instruction: {
        type: 'string',
        description: 'Clear, specific instruction for the sub-agent. Include all context they need to complete the task.',
      },
      reason: {
        type: 'string',
        description: 'Brief explanation of why you are delegating this task (for transparency to the user).',
      },
    },
    required: ['agentName', 'instruction', 'reason'],
  },
};

/**
 * Get tools array for Anthropic API request
 * Only SHIWANGI (master agent) gets the delegate tool
 */
export function getToolsForAgent(agentName: string): any[] {
  if (agentName === 'SHIWANGI') {
    return [DELEGATE_TOOL];
  }
  return [];
}
