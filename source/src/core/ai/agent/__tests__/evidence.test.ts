import { describe, expect, it } from 'vitest';
import { EvidenceStore, deriveEvidenceFromToolResult } from '../evidence';

describe('V5 P02 — deriveEvidenceFromToolResult (tool adapters)', () => {
  it('maps a successful VERIFY tool to SUPPORTING TEST evidence', () => {
    const evidence = deriveEvidenceFromToolResult({ taskId: 't', toolName: 'run_tests', target: 'x.ts', ok: true, providerMode: 'mock' });
    expect(evidence?.type).toBe('TEST');
    expect(evidence?.result).toBe('SUPPORTING');
  });

  it('maps a failed VERIFY tool to CONTRADICTING TEST evidence', () => {
    const evidence = deriveEvidenceFromToolResult({ taskId: 't', toolName: 'test_server_function', target: 'math.sum', ok: false, providerMode: 'mock' });
    expect(evidence?.type).toBe('TEST');
    expect(evidence?.result).toBe('CONTRADICTING');
  });

  it('maps a successful retrieve tool to NEUTRAL SOURCE evidence', () => {
    const evidence = deriveEvidenceFromToolResult({ taskId: 't', toolName: 'read_file', target: 'x.ts', ok: true, providerMode: 'mock' });
    expect(evidence?.type).toBe('SOURCE');
    expect(evidence?.result).toBe('NEUTRAL');
  });

  it('produces no evidence for a failed retrieve tool or an unmapped tool', () => {
    expect(deriveEvidenceFromToolResult({ taskId: 't', toolName: 'read_file', target: 'x.ts', ok: false, providerMode: 'mock' })).toBeNull();
    expect(deriveEvidenceFromToolResult({ taskId: 't', toolName: 'draft_file_patch', target: 'x.ts', ok: true, providerMode: 'mock' })).toBeNull();
  });

  it('tags provider mode in sourceRefs so mock-derived evidence is distinguishable from live', () => {
    const evidence = deriveEvidenceFromToolResult({ taskId: 't', toolName: 'run_tests', target: 'x.ts', ok: true, providerMode: 'mock' });
    expect(evidence?.sourceRefs).toContain('provider:mock');
  });
});

describe('V5 P02 — EvidenceStore', () => {
  it('records and lists evidence by type', () => {
    const store = new EvidenceStore();
    store.record({ taskId: 't', type: 'SOURCE', subjectRefs: ['a.ts'], result: 'NEUTRAL', sourceRefs: [] });
    store.record({ taskId: 't', type: 'TEST', subjectRefs: ['a.ts'], result: 'SUPPORTING', sourceRefs: [] });
    expect(store.list()).toHaveLength(2);
    expect(store.byType('TEST')).toHaveLength(1);
  });
});
