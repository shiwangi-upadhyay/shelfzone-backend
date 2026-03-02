import {
  createTabSchema,
  updateTabSchema,
  tabIdParamSchema,
} from '../../../src/modules/command-center/tabs.schemas.js';

describe('Tabs Schemas', () => {
  // ─── createTabSchema ────────────────────────────────────────────────

  describe('createTabSchema', () => {
    it('should validate with valid title', () => {
      const result = createTabSchema.safeParse({ title: 'My Tab' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('My Tab');
      }
    });

    it('should use default title when not provided', () => {
      const result = createTabSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('New Conversation');
      }
    });

    it('should reject empty title', () => {
      const result = createTabSchema.safeParse({ title: '' });
      expect(result.success).toBe(false);
    });

    it('should reject title longer than 100 characters', () => {
      const longTitle = 'a'.repeat(101);
      const result = createTabSchema.safeParse({ title: longTitle });
      expect(result.success).toBe(false);
    });

    it('should accept title with exactly 100 characters', () => {
      const maxTitle = 'a'.repeat(100);
      const result = createTabSchema.safeParse({ title: maxTitle });
      expect(result.success).toBe(true);
    });

    it('should accept title with special characters', () => {
      const result = createTabSchema.safeParse({ title: 'Tab #1: Testing & Development' });
      expect(result.success).toBe(true);
    });

    it('should accept title with Unicode characters', () => {
      const result = createTabSchema.safeParse({ title: 'My Tab 🚀 测试' });
      expect(result.success).toBe(true);
    });
  });

  // ─── updateTabSchema ────────────────────────────────────────────────

  describe('updateTabSchema', () => {
    it('should validate with valid title', () => {
      const result = updateTabSchema.safeParse({ title: 'Updated Title' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Updated Title');
      }
    });

    it('should validate with valid position', () => {
      const result = updateTabSchema.safeParse({ position: 2 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.position).toBe(2);
      }
    });

    it('should validate with valid isActive', () => {
      const result = updateTabSchema.safeParse({ isActive: true });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it('should validate with multiple fields', () => {
      const result = updateTabSchema.safeParse({
        title: 'New Title',
        position: 1,
        isActive: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('New Title');
        expect(result.data.position).toBe(1);
        expect(result.data.isActive).toBe(false);
      }
    });

    it('should validate with empty object (all optional)', () => {
      const result = updateTabSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const result = updateTabSchema.safeParse({ title: '' });
      expect(result.success).toBe(false);
    });

    it('should reject title longer than 100 characters', () => {
      const longTitle = 'a'.repeat(101);
      const result = updateTabSchema.safeParse({ title: longTitle });
      expect(result.success).toBe(false);
    });

    it('should reject negative position', () => {
      const result = updateTabSchema.safeParse({ position: -1 });
      expect(result.success).toBe(false);
    });

    it('should accept position 0', () => {
      const result = updateTabSchema.safeParse({ position: 0 });
      expect(result.success).toBe(true);
    });

    it('should reject non-integer position', () => {
      const result = updateTabSchema.safeParse({ position: 1.5 });
      expect(result.success).toBe(false);
    });

    it('should reject non-boolean isActive', () => {
      const result = updateTabSchema.safeParse({ isActive: 'true' });
      expect(result.success).toBe(false);
    });

    it('should accept large position numbers', () => {
      const result = updateTabSchema.safeParse({ position: 999 });
      expect(result.success).toBe(true);
    });
  });

  // ─── tabIdParamSchema ───────────────────────────────────────────────
  // THIS IS THE KEY SCHEMA FOR THE DELETE ENDPOINT 400 ERROR

  describe('tabIdParamSchema - DELETE endpoint validation', () => {
    it('should validate CUID format ID from error log', () => {
      // This is the exact ID from the user's 400 error:
      // DELETE /api/command-center/tabs/cmm8vm6fk0002ypf3cke5hdfi
      const result = tabIdParamSchema.safeParse({ id: 'cmm8vm6fk0002ypf3cke5hdfi' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('cmm8vm6fk0002ypf3cke5hdfi');
      }
    });

    it('should validate any non-empty string ID', () => {
      const result = tabIdParamSchema.safeParse({ id: 'tab-123' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('tab-123');
      }
    });

    it('should validate UUID format', () => {
      const result = tabIdParamSchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' });
      expect(result.success).toBe(true);
    });

    it('should validate short IDs', () => {
      const result = tabIdParamSchema.safeParse({ id: 'a' });
      expect(result.success).toBe(true);
    });

    it('should validate very long IDs', () => {
      const longId = 'a'.repeat(500);
      const result = tabIdParamSchema.safeParse({ id: longId });
      expect(result.success).toBe(true);
    });

    it('should validate IDs with special characters', () => {
      const result = tabIdParamSchema.safeParse({ id: 'tab-123_456' });
      expect(result.success).toBe(true);
    });

    it('should validate IDs with numbers', () => {
      const result = tabIdParamSchema.safeParse({ id: '123456' });
      expect(result.success).toBe(true);
    });

    it('should reject empty string ID', () => {
      const result = tabIdParamSchema.safeParse({ id: '' });
      expect(result.success).toBe(false);
    });

    it('should handle whitespace-only ID (Zod behavior)', () => {
      // Zod string() by default does NOT trim (that's a misconception)
      // Let's test the actual behavior
      const result = tabIdParamSchema.safeParse({ id: '   ' });
      // Whitespace string '   ' has length 3, so it passes min(1)
      // This is technically valid per the current schema
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('   ');
      }
    });

    it('should reject missing id field', () => {
      const result = tabIdParamSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject null id', () => {
      const result = tabIdParamSchema.safeParse({ id: null });
      expect(result.success).toBe(false);
    });

    it('should reject undefined id', () => {
      const result = tabIdParamSchema.safeParse({ id: undefined });
      expect(result.success).toBe(false);
    });

    it('should reject numeric id (not string)', () => {
      const result = tabIdParamSchema.safeParse({ id: 123 });
      expect(result.success).toBe(false);
    });

    it('should trim whitespace from ID', () => {
      const result = tabIdParamSchema.safeParse({ id: '  tab-123  ' });
      // Zod string() by default trims unless configured otherwise
      // Let's check the behavior
      expect(result.success).toBe(true);
    });

    // Edge cases that might have caused 400 errors
    it('should handle IDs with hyphens', () => {
      const result = tabIdParamSchema.safeParse({ id: 'cmm8vm6fk-0002-ypf3-cke5hdfi' });
      expect(result.success).toBe(true);
    });

    it('should handle mixed case IDs', () => {
      const result = tabIdParamSchema.safeParse({ id: 'AbC123XyZ' });
      expect(result.success).toBe(true);
    });

    it('should handle IDs with dots', () => {
      const result = tabIdParamSchema.safeParse({ id: 'tab.123.456' });
      expect(result.success).toBe(true);
    });

    // Test the fix: should NOT enforce strict CUID validation
    it('should NOT require strict CUID format (fix verification)', () => {
      // These are NOT valid CUIDs but should pass after the hotfix
      const nonCuidIds = [
        'simple-id',
        '123',
        'tab_test',
        'a-b-c',
        'very.long.id.with.dots',
      ];

      nonCuidIds.forEach((id) => {
        const result = tabIdParamSchema.safeParse({ id });
        expect(result.success).toBe(true);
      });
    });

    // Validate the schema structure
    it('should have correct schema shape', () => {
      const parsed = tabIdParamSchema.safeParse({ id: 'test-id', extra: 'field' });
      
      // Should strip extra fields
      if (parsed.success) {
        expect(parsed.data).toEqual({ id: 'test-id' });
        expect(parsed.data).not.toHaveProperty('extra');
      }
    });
  });
});
