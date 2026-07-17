import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../tools/registry.js';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('registers and retrieves a tool', () => {
    registry.register(
      {
        name: 'test.tool',
        description: 'A test tool',
        inputSchema: { type: 'object' },
        requiredPermission: 'test.read',
        riskLevel: 'low',
        approvalPolicy: 'never',
        idempotent: true,
        timeoutMs: 1000,
        auditRequired: false,
      },
      async () => ({ result: 'ok' }),
    );

    expect(registry.has('test.tool')).toBe(true);
    expect(registry.get('test.tool')?.definition.name).toBe('test.tool');
  });

  it('returns undefined for unknown tool', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
    expect(registry.has('nonexistent')).toBe(false);
  });

  it('getByNames filters correctly', () => {
    registry.register(
      { name: 'tool.a', description: '', inputSchema: { type: 'object' }, requiredPermission: '', riskLevel: 'low', approvalPolicy: 'never', idempotent: true, timeoutMs: 1000, auditRequired: false },
      async () => ({}),
    );
    registry.register(
      { name: 'tool.b', description: '', inputSchema: { type: 'object' }, requiredPermission: '', riskLevel: 'low', approvalPolicy: 'never', idempotent: true, timeoutMs: 1000, auditRequired: false },
      async () => ({}),
    );

    const result = registry.getByNames(['tool.a', 'tool.c']);
    expect(result).toHaveLength(1);
    expect(result[0]?.definition.name).toBe('tool.a');
  });

  it('getAll returns all registered tools', () => {
    registry.register(
      { name: 'tool.x', description: '', inputSchema: { type: 'object' }, requiredPermission: '', riskLevel: 'low', approvalPolicy: 'never', idempotent: true, timeoutMs: 1000, auditRequired: false },
      async () => ({}),
    );
    expect(registry.getAll()).toHaveLength(1);
  });
});
