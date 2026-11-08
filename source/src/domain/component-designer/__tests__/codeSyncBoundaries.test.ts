import { describe, expect, it } from 'vitest';
import { syncCodeToCanvas } from '../codegen';

describe('syncCodeToCanvas reentrancy contract', () => {
  const baseDocument = {
    id: 'draft-1',
    name: 'Test',
    rootNodeId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'root',
        parentId: null,
        order: 0,
        props: {},
        layout: {},
        binding: {},
        children: [],
      },
    },
    metadata: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    diagnostics: [],
  };

  it('returns diagnostics for incomplete JSX without throwing', () => {
    const broken = [
      "import React from 'react';",
      '',
      'export const GeneratedComponent: React.FC = () => {',
      '  return (',
      '    <div className="space-y-3">',
      '      <div',
      '    </div>',
      '  );',
      '};',
      '',
    ].join('\n');

    expect(() => syncCodeToCanvas({
      format: 'tsx',
      code: broken,
      currentDocument: baseDocument,
    })).not.toThrow();

    const result = syncCodeToCanvas({
      format: 'tsx',
      code: broken,
      currentDocument: baseDocument,
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.diagnostics[0]?.code).toBe('parse-tsx');
      expect(result.diagnostics[0]?.message.toLowerCase()).toContain('jsx');
    }
  });

  it('recovers when JSX syntax becomes valid again', () => {
    const valid = [
      "import React from 'react';",
      '',
      'export const GeneratedComponent: React.FC = () => {',
      '  return (',
      '    <div className="space-y-3">',
      '      <p className="text-sm" aria-describedby="hint-id" title="Greeting">Hello</p>',
      '    </div>',
      '  );',
      '};',
      '',
    ].join('\n');

    const broken = valid.replace('</p>', '');

    const failed = syncCodeToCanvas({ format: 'tsx', code: broken, currentDocument: baseDocument });
    expect(failed.ok).toBe(false);

    const recovered = syncCodeToCanvas({ format: 'tsx', code: valid, currentDocument: baseDocument });
    expect(recovered.ok).toBe(true);
    if (recovered.ok) {
      const textNode = Object.values(recovered.document.nodes).find((node) => node.type === 'text');
      expect(textNode?.props.text).toBe('Hello');
      expect(textNode?.props.ariaDescribedby).toBe('hint-id');
      expect(textNode?.props.title).toBe('Greeting');
    }
  });

  it('preserves binding definitions when JSON export omits bindingDefinitions', () => {
    const currentBindings = {
      definitions: {
        defaultVisibility: { sourceType: 'static' as const, sourcePath: 'true', fallbackValue: true },
        customFlag: { sourceType: 'static' as const, sourcePath: 'false', fallbackValue: false },
      },
      storeSegments: {
        filters: { id: 'filters', initialValue: {}, persist: 'none' as const },
      },
      dataSources: {},
      lovs: {},
    };

    const jsonWithoutBindings = JSON.stringify({
      schema: 'component-designer-export',
      version: '1.0.0',
      document: baseDocument,
    });

    const result = syncCodeToCanvas({
      format: 'json',
      code: jsonWithoutBindings,
      currentDocument: baseDocument,
      currentBindingDefinitions: currentBindings,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bindingDefinitions).toEqual(currentBindings);
    }
  });
});

describe('CODE_SYNC_DEBOUNCE_MS', () => {
  it('uses a 450ms debounce boundary for editor-to-canvas sync', async () => {
    const { CODE_SYNC_DEBOUNCE_MS } = await import('../../../features/component-designer/hooks/useDesignerCode');
    expect(CODE_SYNC_DEBOUNCE_MS).toBe(450);
  });
});
