import { describe, expect, it } from 'vitest';
import { createInitialDesignerState } from '../../../domain/component-designer/state';
import {
  createClientComponentAgentApplyCollector,
  isDesignerDocument,
} from '../lib/clientComponentAiAgentApply';

describe('createClientComponentAgentApplyCollector', () => {
  const sampleDocument = createInitialDesignerState('probe').document;

  it('prefers component_layout_patch proposal over draft tool args', () => {
    const collector = createClientComponentAgentApplyCollector();
    collector.ingest({
      type: 'tool_start',
      toolCallId: 't1',
      name: 'draft_component_layout',
      args: { name: 'probe', document: { ...sampleDocument, name: 'from-tool' } },
    });
    collector.ingest({
      type: 'proposal',
      proposalId: 'p1',
      changeSets: [{
        id: 'cs1',
        kind: 'component_layout_patch',
        title: 'Component layout: probe',
        layoutId: 'probe',
        patch: { document: { ...sampleDocument, name: 'from-proposal' }, bindingDefinitions: {} },
      }],
    });
    expect(collector.layout()?.document.name).toBe('from-proposal');
  });

  it('uses draft_component_layout args when no proposal arrives', () => {
    const collector = createClientComponentAgentApplyCollector();
    collector.ingest({
      type: 'tool_start',
      toolCallId: 't1',
      name: 'designer_set_prop',
      args: { propKey: 'text', value: 'ignored' },
    });
    collector.ingest({
      type: 'tool_start',
      toolCallId: 't2',
      name: 'draft_component_layout',
      args: { name: 'probe', document: sampleDocument },
    });
    expect(collector.layout()?.document).toEqual(sampleDocument);
  });

  it('returns empty when the agent only chats', () => {
    const collector = createClientComponentAgentApplyCollector();
    collector.ingest({ type: 'text_delta', text: 'I updated the layout.' });
    expect(collector.layout()).toBeNull();
  });
});

describe('isDesignerDocument', () => {
  it('accepts a Live Designer document', () => {
    expect(isDesignerDocument(createInitialDesignerState('probe').document)).toBe(true);
  });

  it('rejects a document without a root node', () => {
    expect(isDesignerDocument({ rootNodeId: 'root', nodes: {} })).toBe(false);
  });
});
