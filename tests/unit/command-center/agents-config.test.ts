import {
  SUB_AGENTS,
  MASTER_AGENT_CONFIG,
  getAgentConfig,
  getAvailableAgents,
} from '../../../src/modules/command-center/agents-config.js';

describe('Agents Configuration', () => {
  // ─── SUB_AGENTS ─────────────────────────────────────────────────────

  describe('SUB_AGENTS', () => {
    it('should define all required sub-agents', () => {
      const requiredAgents = ['BackendForge', 'UIcraft', 'DataArchitect', 'TestRunner', 'DocSmith'];

      requiredAgents.forEach((agentName) => {
        expect(SUB_AGENTS[agentName]).toBeDefined();
      });

      expect(Object.keys(SUB_AGENTS)).toHaveLength(5);
    });

    it('should have valid configuration for BackendForge', () => {
      const agent = SUB_AGENTS.BackendForge;

      expect(agent.name).toBe('BackendForge');
      expect(agent.model).toBe('claude-sonnet-4-5');
      expect(agent.maxTokens).toBe(8192);
      expect(agent.temperature).toBe(0.3);
      expect(agent.systemPrompt).toContain('backend');
      expect(agent.systemPrompt).toContain('Fastify');
      expect(agent.systemPrompt).toContain('TypeScript');
    });

    it('should have valid configuration for UIcraft', () => {
      const agent = SUB_AGENTS.UIcraft;

      expect(agent.name).toBe('UIcraft');
      expect(agent.model).toBe('claude-sonnet-4-5');
      expect(agent.maxTokens).toBe(8192);
      expect(agent.temperature).toBe(0.4);
      expect(agent.systemPrompt).toContain('frontend');
      expect(agent.systemPrompt).toContain('React');
      expect(agent.systemPrompt).toContain('Next.js');
    });

    it('should have valid configuration for DataArchitect', () => {
      const agent = SUB_AGENTS.DataArchitect;

      expect(agent.name).toBe('DataArchitect');
      expect(agent.model).toBe('claude-sonnet-4-5');
      expect(agent.maxTokens).toBe(8192);
      expect(agent.temperature).toBe(0.2);
      expect(agent.systemPrompt).toContain('database');
      expect(agent.systemPrompt).toContain('Prisma');
      expect(agent.systemPrompt).toContain('CUID');
    });

    it('should have valid configuration for TestRunner', () => {
      const agent = SUB_AGENTS.TestRunner;

      expect(agent.name).toBe('TestRunner');
      expect(agent.model).toBe('claude-sonnet-4-5');
      expect(agent.maxTokens).toBe(8192);
      expect(agent.temperature).toBe(0.3);
      expect(agent.systemPrompt).toContain('testing');
      expect(agent.systemPrompt).toContain('Jest');
    });

    it('should have valid configuration for DocSmith', () => {
      const agent = SUB_AGENTS.DocSmith;

      expect(agent.name).toBe('DocSmith');
      expect(agent.model).toBe('claude-haiku-4-5');
      expect(agent.maxTokens).toBe(4096);
      expect(agent.temperature).toBe(0.5);
      expect(agent.systemPrompt).toContain('documentation');
      expect(agent.systemPrompt).toContain('Markdown');
    });

    it('should use appropriate temperatures for different agents', () => {
      // DataArchitect should be most deterministic (lowest temp)
      expect(SUB_AGENTS.DataArchitect.temperature).toBeLessThan(SUB_AGENTS.BackendForge.temperature);

      // DocSmith can be more creative (highest temp among sub-agents)
      expect(SUB_AGENTS.DocSmith.temperature).toBeGreaterThan(SUB_AGENTS.DataArchitect.temperature);

      // All temperatures should be reasonable (0-1)
      Object.values(SUB_AGENTS).forEach((agent) => {
        expect(agent.temperature).toBeGreaterThanOrEqual(0);
        expect(agent.temperature).toBeLessThanOrEqual(1);
      });
    });

    it('should use appropriate models for cost optimization', () => {
      // DocSmith uses cheaper Haiku model (docs don't need Sonnet)
      expect(SUB_AGENTS.DocSmith.model).toBe('claude-haiku-4-5');

      // Complex agents use Sonnet
      expect(SUB_AGENTS.BackendForge.model).toBe('claude-sonnet-4-5');
      expect(SUB_AGENTS.UIcraft.model).toBe('claude-sonnet-4-5');
      expect(SUB_AGENTS.DataArchitect.model).toBe('claude-sonnet-4-5');
      expect(SUB_AGENTS.TestRunner.model).toBe('claude-sonnet-4-5');
    });

    it('should have appropriate max tokens', () => {
      // DocSmith needs fewer tokens
      expect(SUB_AGENTS.DocSmith.maxTokens).toBe(4096);

      // Code-generating agents need more tokens
      expect(SUB_AGENTS.BackendForge.maxTokens).toBe(8192);
      expect(SUB_AGENTS.UIcraft.maxTokens).toBe(8192);
      expect(SUB_AGENTS.DataArchitect.maxTokens).toBe(8192);
      expect(SUB_AGENTS.TestRunner.maxTokens).toBe(8192);
    });

    it('should include critical rules in system prompts', () => {
      // BackendForge rules
      expect(SUB_AGENTS.BackendForge.systemPrompt).toContain('CUID');
      expect(SUB_AGENTS.BackendForge.systemPrompt).toContain('.js extensions');

      // UIcraft rules
      expect(SUB_AGENTS.UIcraft.systemPrompt).toContain('TypeScript');
      expect(SUB_AGENTS.UIcraft.systemPrompt).toContain('shadcn/ui');

      // DataArchitect rules
      expect(SUB_AGENTS.DataArchitect.systemPrompt).toContain('@map');
      expect(SUB_AGENTS.DataArchitect.systemPrompt).toContain('snake_case');

      // TestRunner rules
      expect(SUB_AGENTS.TestRunner.systemPrompt).toContain('AAA pattern');
      expect(SUB_AGENTS.TestRunner.systemPrompt).toContain('Mock');
    });

    it('should instruct agents not to ask questions', () => {
      Object.values(SUB_AGENTS).forEach((agent) => {
        expect(
          agent.systemPrompt.toLowerCase().includes('do not ask questions') ||
            agent.systemPrompt.toLowerCase().includes("don't ask")
        ).toBe(true);
      });
    });
  });

  // ─── MASTER_AGENT_CONFIG ────────────────────────────────────────────

  describe('MASTER_AGENT_CONFIG', () => {
    it('should configure SHIWANGI correctly', () => {
      expect(MASTER_AGENT_CONFIG.name).toBe('SHIWANGI');
      expect(MASTER_AGENT_CONFIG.model).toBe('claude-sonnet-4-5');
      expect(MASTER_AGENT_CONFIG.maxTokens).toBe(8192);
      expect(MASTER_AGENT_CONFIG.temperature).toBe(0.7);
    });

    it('should include delegation instructions', () => {
      expect(MASTER_AGENT_CONFIG.systemPrompt).toContain('delegate');
      expect(MASTER_AGENT_CONFIG.systemPrompt).toContain('BackendForge');
      expect(MASTER_AGENT_CONFIG.systemPrompt).toContain('UIcraft');
      expect(MASTER_AGENT_CONFIG.systemPrompt).toContain('DataArchitect');
      expect(MASTER_AGENT_CONFIG.systemPrompt).toContain('TestRunner');
      expect(MASTER_AGENT_CONFIG.systemPrompt).toContain('DocSmith');
    });

    it('should instruct when to delegate', () => {
      const prompt = MASTER_AGENT_CONFIG.systemPrompt.toLowerCase();

      expect(prompt).toContain('when to delegate');
      expect(prompt).toContain('backend');
      expect(prompt).toContain('frontend');
      expect(prompt).toContain('database');
      expect(prompt).toContain('test');
      expect(prompt).toContain('documentation');
    });

    it('should instruct how to use delegate tool', () => {
      const prompt = MASTER_AGENT_CONFIG.systemPrompt;

      expect(prompt).toContain('agentName');
      expect(prompt).toContain('instruction');
      expect(prompt).toContain('reason');
    });

    it('should have higher temperature than sub-agents', () => {
      // SHIWANGI needs creativity for orchestration
      expect(MASTER_AGENT_CONFIG.temperature).toBeGreaterThan(SUB_AGENTS.BackendForge.temperature);
      expect(MASTER_AGENT_CONFIG.temperature).toBeGreaterThan(SUB_AGENTS.DataArchitect.temperature);
    });

    it('should emphasize transparency and real delegation', () => {
      const prompt = MASTER_AGENT_CONFIG.systemPrompt.toLowerCase();

      expect(prompt).toContain('real delegation');
      expect(prompt).toContain('track');
      expect(prompt).toContain('cost');
      expect(
        prompt.includes('never fake') ||
          prompt.includes('no fake') ||
          prompt.includes("don't fake")
      ).toBe(true);
    });
  });

  // ─── getAgentConfig ─────────────────────────────────────────────────

  describe('getAgentConfig', () => {
    it('should return SHIWANGI config', () => {
      const config = getAgentConfig('SHIWANGI');

      expect(config).toBeDefined();
      expect(config?.name).toBe('SHIWANGI');
      expect(config?.model).toBe('claude-sonnet-4-5');
    });

    it('should return BackendForge config', () => {
      const config = getAgentConfig('BackendForge');

      expect(config).toBeDefined();
      expect(config?.name).toBe('BackendForge');
      expect(config?.systemPrompt).toContain('backend');
    });

    it('should return UIcraft config', () => {
      const config = getAgentConfig('UIcraft');

      expect(config).toBeDefined();
      expect(config?.name).toBe('UIcraft');
      expect(config?.systemPrompt).toContain('frontend');
    });

    it('should return DataArchitect config', () => {
      const config = getAgentConfig('DataArchitect');

      expect(config).toBeDefined();
      expect(config?.name).toBe('DataArchitect');
      expect(config?.systemPrompt).toContain('database');
    });

    it('should return TestRunner config', () => {
      const config = getAgentConfig('TestRunner');

      expect(config).toBeDefined();
      expect(config?.name).toBe('TestRunner');
      expect(config?.systemPrompt).toContain('testing');
    });

    it('should return DocSmith config', () => {
      const config = getAgentConfig('DocSmith');

      expect(config).toBeDefined();
      expect(config?.name).toBe('DocSmith');
      expect(config?.systemPrompt).toContain('documentation');
    });

    it('should return null for unknown agent', () => {
      const config = getAgentConfig('UnknownAgent');

      expect(config).toBeNull();
    });

    it('should return null for empty string', () => {
      const config = getAgentConfig('');

      expect(config).toBeNull();
    });

    it('should be case-sensitive', () => {
      expect(getAgentConfig('backendforge')).toBeNull();
      expect(getAgentConfig('BackendForge')).toBeDefined();
      expect(getAgentConfig('BACKENDFORGE')).toBeNull();
    });
  });

  // ─── getAvailableAgents ─────────────────────────────────────────────

  describe('getAvailableAgents', () => {
    it('should return all sub-agent names', () => {
      const agents = getAvailableAgents();

      expect(agents).toHaveLength(5);
      expect(agents).toContain('BackendForge');
      expect(agents).toContain('UIcraft');
      expect(agents).toContain('DataArchitect');
      expect(agents).toContain('TestRunner');
      expect(agents).toContain('DocSmith');
    });

    it('should not include SHIWANGI in available agents', () => {
      const agents = getAvailableAgents();

      expect(agents).not.toContain('SHIWANGI');
    });

    it('should return agents in deterministic order', () => {
      const agents1 = getAvailableAgents();
      const agents2 = getAvailableAgents();

      expect(agents1).toEqual(agents2);
    });
  });

  // ─── System Prompt Quality ──────────────────────────────────────────

  describe('System Prompt Quality', () => {
    it('should have non-empty system prompts', () => {
      Object.values(SUB_AGENTS).forEach((agent) => {
        expect(agent.systemPrompt.length).toBeGreaterThan(100);
      });

      expect(MASTER_AGENT_CONFIG.systemPrompt.length).toBeGreaterThan(100);
    });

    it('should include response format instructions', () => {
      const agentsWithCodeOutput = [
        SUB_AGENTS.BackendForge,
        SUB_AGENTS.UIcraft,
        SUB_AGENTS.DataArchitect,
        SUB_AGENTS.TestRunner,
      ];

      agentsWithCodeOutput.forEach((agent) => {
        const prompt = agent.systemPrompt.toLowerCase();
        expect(
          prompt.includes('file path') ||
          prompt.includes('complete') ||
          prompt.includes('response format')
        ).toBe(true);
      });

      // DocSmith should have documentation-specific format instructions
      const docSmithPrompt = SUB_AGENTS.DocSmith.systemPrompt.toLowerCase();
      expect(
        docSmithPrompt.includes('markdown') ||
        docSmithPrompt.includes('documentation')
      ).toBe(true);
    });

    it('should mention ShelfZone context', () => {
      Object.values(SUB_AGENTS).forEach((agent) => {
        expect(agent.systemPrompt.toLowerCase()).toContain('shelfzone');
      });
    });

    it('should define agent roles clearly', () => {
      Object.values(SUB_AGENTS).forEach((agent) => {
        expect(
          agent.systemPrompt.includes('Your Role:') || agent.systemPrompt.includes('You are')
        ).toBe(true);
      });
    });
  });

  // ─── Configuration Consistency ──────────────────────────────────────

  describe('Configuration Consistency', () => {
    it('should have consistent property structure', () => {
      const allAgents = [...Object.values(SUB_AGENTS), MASTER_AGENT_CONFIG];

      allAgents.forEach((agent) => {
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('model');
        expect(agent).toHaveProperty('systemPrompt');
        expect(agent).toHaveProperty('maxTokens');
        expect(agent).toHaveProperty('temperature');
      });
    });

    it('should use valid Anthropic model names', () => {
      const validModels = ['claude-opus-4-6', 'claude-sonnet-4-5', 'claude-haiku-4-5'];

      const allAgents = [...Object.values(SUB_AGENTS), MASTER_AGENT_CONFIG];

      allAgents.forEach((agent) => {
        expect(validModels).toContain(agent.model);
      });
    });

    it('should have reasonable maxTokens values', () => {
      const allAgents = [...Object.values(SUB_AGENTS), MASTER_AGENT_CONFIG];

      allAgents.forEach((agent) => {
        expect(agent.maxTokens).toBeGreaterThan(0);
        expect(agent.maxTokens).toBeLessThanOrEqual(200000);
      });
    });

    it('should have valid temperature values', () => {
      const allAgents = [...Object.values(SUB_AGENTS), MASTER_AGENT_CONFIG];

      allAgents.forEach((agent) => {
        expect(agent.temperature).toBeGreaterThanOrEqual(0);
        expect(agent.temperature).toBeLessThanOrEqual(2);
      });
    });

    it('should match agent names in config and systemPrompt', () => {
      Object.values(SUB_AGENTS).forEach((agent) => {
        expect(agent.systemPrompt).toContain(agent.name);
      });

      expect(MASTER_AGENT_CONFIG.systemPrompt).toContain('SHIWANGI');
    });
  });
});
