import { DELEGATE_TOOL, getToolsForAgent } from '../../../src/modules/command-center/delegation-tools.js';

describe('Delegation Tools', () => {
  // ─── DELEGATE_TOOL ──────────────────────────────────────────────────

  describe('DELEGATE_TOOL', () => {
    it('should have correct tool structure', () => {
      expect(DELEGATE_TOOL).toHaveProperty('name');
      expect(DELEGATE_TOOL).toHaveProperty('description');
      expect(DELEGATE_TOOL).toHaveProperty('input_schema');
    });

    it('should have name "delegate"', () => {
      expect(DELEGATE_TOOL.name).toBe('delegate');
    });

    it('should have descriptive description', () => {
      expect(DELEGATE_TOOL.description).toBeTruthy();
      expect(DELEGATE_TOOL.description.length).toBeGreaterThan(50);
      expect(DELEGATE_TOOL.description.toLowerCase()).toContain('delegate');
      expect(DELEGATE_TOOL.description.toLowerCase()).toContain('sub-agent');
    });

    it('should mention sub-agent categories in description', () => {
      const description = DELEGATE_TOOL.description.toLowerCase();

      // Should mention general categories, not necessarily all agent names
      expect(
        description.includes('backend') ||
        description.includes('frontend') ||
        description.includes('database') ||
        description.includes('testing') ||
        description.includes('documentation')
      ).toBe(true);
    });

    it('should have valid JSON schema structure', () => {
      expect(DELEGATE_TOOL.input_schema.type).toBe('object');
      expect(DELEGATE_TOOL.input_schema.properties).toBeDefined();
      expect(DELEGATE_TOOL.input_schema.required).toBeDefined();
    });

    it('should define agentName property', () => {
      const agentNameProp = DELEGATE_TOOL.input_schema.properties.agentName;

      expect(agentNameProp).toBeDefined();
      expect(agentNameProp.type).toBe('string');
      expect(agentNameProp.enum).toBeDefined();
      expect(agentNameProp.description).toBeTruthy();
    });

    it('should list all valid agent names in enum', () => {
      const agentNameProp = DELEGATE_TOOL.input_schema.properties.agentName;

      expect(agentNameProp.enum).toEqual([
        'BackendForge',
        'UIcraft',
        'DataArchitect',
        'TestRunner',
        'DocSmith',
      ]);
    });

    it('should not include SHIWANGI in agent enum', () => {
      const agentNameProp = DELEGATE_TOOL.input_schema.properties.agentName;

      expect(agentNameProp.enum).not.toContain('SHIWANGI');
    });

    it('should define instruction property', () => {
      const instructionProp = DELEGATE_TOOL.input_schema.properties.instruction;

      expect(instructionProp).toBeDefined();
      expect(instructionProp.type).toBe('string');
      expect(instructionProp.description).toBeTruthy();
      expect(instructionProp.description.toLowerCase()).toContain('instruction');
    });

    it('should define reason property', () => {
      const reasonProp = DELEGATE_TOOL.input_schema.properties.reason;

      expect(reasonProp).toBeDefined();
      expect(reasonProp.type).toBe('string');
      expect(reasonProp.description).toBeTruthy();
      expect(reasonProp.description.length).toBeGreaterThan(20);
    });

    it('should require all three fields', () => {
      expect(DELEGATE_TOOL.input_schema.required).toEqual([
        'agentName',
        'instruction',
        'reason',
      ]);
    });

    it('should explain each agent in agentName description', () => {
      const description = DELEGATE_TOOL.input_schema.properties.agentName.description.toLowerCase();

      expect(description).toContain('backendforge');
      expect(description).toContain('uicraft');
      expect(description).toContain('dataarchitect');
      expect(description).toContain('testrunner');
      expect(description).toContain('docsmith');

      // Should mention what each agent does
      expect(description).toContain('backend') || expect(description).toContain('api');
      expect(description).toContain('frontend') || expect(description).toContain('ui');
      expect(description).toContain('database') || expect(description).toContain('schema');
      expect(description).toContain('test');
      expect(description).toContain('documentation') || expect(description).toContain('docs');
    });

    it('should emphasize clarity in instruction description', () => {
      const description = DELEGATE_TOOL.input_schema.properties.instruction.description.toLowerCase();

      expect(
        description.includes('clear') ||
          description.includes('specific') ||
          description.includes('context')
      ).toBe(true);
    });

    it('should emphasize transparency in reason description', () => {
      const description = DELEGATE_TOOL.input_schema.properties.reason.description.toLowerCase();

      expect(
        description.includes('transparency') ||
          description.includes('explain') ||
          description.includes('why')
      ).toBe(true);
    });

    it('should be compatible with Anthropic API format', () => {
      // Anthropic expects this exact structure
      expect(DELEGATE_TOOL).toMatchObject({
        name: expect.any(String),
        description: expect.any(String),
        input_schema: {
          type: 'object',
          properties: expect.any(Object),
          required: expect.any(Array),
        },
      });
    });

    it('should not have any extra top-level fields', () => {
      const validKeys = ['name', 'description', 'input_schema'];
      const actualKeys = Object.keys(DELEGATE_TOOL);

      actualKeys.forEach((key) => {
        expect(validKeys).toContain(key);
      });
    });
  });

  // ─── getToolsForAgent ───────────────────────────────────────────────

  describe('getToolsForAgent', () => {
    it('should return delegate tool for SHIWANGI', () => {
      const tools = getToolsForAgent('SHIWANGI');

      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual(DELEGATE_TOOL);
    });

    it('should return empty array for BackendForge', () => {
      const tools = getToolsForAgent('BackendForge');

      expect(tools).toEqual([]);
    });

    it('should return empty array for UIcraft', () => {
      const tools = getToolsForAgent('UIcraft');

      expect(tools).toEqual([]);
    });

    it('should return empty array for DataArchitect', () => {
      const tools = getToolsForAgent('DataArchitect');

      expect(tools).toEqual([]);
    });

    it('should return empty array for TestRunner', () => {
      const tools = getToolsForAgent('TestRunner');

      expect(tools).toEqual([]);
    });

    it('should return empty array for DocSmith', () => {
      const tools = getToolsForAgent('DocSmith');

      expect(tools).toEqual([]);
    });

    it('should return empty array for unknown agent', () => {
      const tools = getToolsForAgent('UnknownAgent');

      expect(tools).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      const tools = getToolsForAgent('');

      expect(tools).toEqual([]);
    });

    it('should be case-sensitive', () => {
      expect(getToolsForAgent('shiwangi')).toEqual([]);
      expect(getToolsForAgent('SHIWANGI')).toHaveLength(1);
      expect(getToolsForAgent('Shiwangi')).toEqual([]);
    });

    it('should return new array instance each time', () => {
      const tools1 = getToolsForAgent('SHIWANGI');
      const tools2 = getToolsForAgent('SHIWANGI');

      // Should be equal but not same reference
      expect(tools1).toEqual(tools2);
      expect(tools1).not.toBe(tools2);
    });

    it('should only SHIWANGI have delegation capability', () => {
      const allAgents = [
        'SHIWANGI',
        'BackendForge',
        'UIcraft',
        'DataArchitect',
        'TestRunner',
        'DocSmith',
        'UnknownAgent',
      ];

      allAgents.forEach((agent) => {
        const tools = getToolsForAgent(agent);

        if (agent === 'SHIWANGI') {
          expect(tools.length).toBeGreaterThan(0);
        } else {
          expect(tools.length).toBe(0);
        }
      });
    });
  });

  // ─── Tool Integration ───────────────────────────────────────────────

  describe('Tool Integration', () => {
    it('should be usable in Anthropic API request', () => {
      const tools = getToolsForAgent('SHIWANGI');

      // Simulate Anthropic API request body
      const apiRequestBody = {
        model: 'claude-sonnet-4-5',
        max_tokens: 8192,
        messages: [{ role: 'user', content: 'Hello' }],
        tools,
      };

      expect(apiRequestBody.tools).toHaveLength(1);
      expect(apiRequestBody.tools[0].name).toBe('delegate');
    });

    it('should match schema used by delegation service', () => {
      const tools = getToolsForAgent('SHIWANGI');
      const delegateTool = tools[0];

      // These agent names should match those in delegation.schemas.ts
      const schemaAgents = ['BackendForge', 'UIcraft', 'DataArchitect', 'TestRunner', 'DocSmith'];

      expect(delegateTool.input_schema.properties.agentName.enum).toEqual(schemaAgents);
    });

    it('should describe all agents consistently', () => {
      const agentDescriptions = DELEGATE_TOOL.input_schema.properties.agentName.description;

      // Each agent should be mentioned with their specialty
      expect(agentDescriptions).toContain('BackendForge');
      expect(agentDescriptions).toContain('UIcraft');
      expect(agentDescriptions).toContain('DataArchitect');
      expect(agentDescriptions).toContain('TestRunner');
      expect(agentDescriptions).toContain('DocSmith');
    });
  });

  // ─── Tool Definition Quality ────────────────────────────────────────

  describe('Tool Definition Quality', () => {
    it('should have clear and actionable descriptions', () => {
      const { description, input_schema } = DELEGATE_TOOL;

      // Tool description should be substantial
      expect(description.length).toBeGreaterThan(50);
      expect(description.toLowerCase()).toContain('task');

      // Property descriptions
      Object.values(input_schema.properties).forEach((prop: any) => {
        expect(prop.description).toBeTruthy();
        expect(prop.description.length).toBeGreaterThan(20);
      });
    });

    it('should guide Claude to use tool correctly', () => {
      const description = DELEGATE_TOOL.description.toLowerCase();

      // Should explain when to use
      expect(description.includes('when') || description.includes('use this')).toBe(true);

      // Should mention specialists
      expect(description.includes('specialist') || description.includes('sub-agent')).toBe(true);
    });

    it('should have consistent naming convention', () => {
      // Tool name is lowercase
      expect(DELEGATE_TOOL.name).toBe(DELEGATE_TOOL.name.toLowerCase());

      // Property names are camelCase
      const propNames = Object.keys(DELEGATE_TOOL.input_schema.properties);
      propNames.forEach((name) => {
        expect(name).toMatch(/^[a-z][a-zA-Z]*$/); // camelCase pattern
      });
    });

    it('should not expose internal implementation details', () => {
      const description = DELEGATE_TOOL.description.toLowerCase();

      // Should not mention Prisma, trace, etc.
      expect(description).not.toContain('prisma');
      expect(description).not.toContain('trace');

      // Should be user-facing language
      expect(description).toContain('task');
      expect(description).toContain('agent');
    });

    it('should emphasize results and completion', () => {
      const description = DELEGATE_TOOL.description.toLowerCase();

      expect(
        description.includes('complete') ||
          description.includes('result') ||
          description.includes('return')
      ).toBe(true);
    });
  });
});
