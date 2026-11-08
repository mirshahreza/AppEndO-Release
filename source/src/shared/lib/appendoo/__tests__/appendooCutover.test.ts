import { describe, expect, it } from 'vitest';
import {
  APPENDOO_V3_CUTOVER_ENABLED,
  isV1DirectWriteBlocked,
  shouldBlockPanelAutoApply,
  shouldBlockV1ChangeSetApply,
  shouldBlockV1ProposalForEngineering,
} from '../appendooCutover';

describe('appendooCutover', () => {
  it('keeps the V3 cutover flag on for pipeline gating', () => {
    expect(APPENDOO_V3_CUTOVER_ENABLED).toBe(true);
  });

  it('p-63 — v1 direct apply is reopened (PO decision 2026-07-18)', () => {
    // The old unconditional block left Agent mode in a dead end: the panel auto-applied a
    // valid proposal and the server 403'd it every time.
    expect(isV1DirectWriteBlocked()).toBe(false);
  });

  it('does not block engineering pipeline proposals after the reopen', () => {
    expect(shouldBlockV1ProposalForEngineering(true)).toBe(false);
    expect(shouldBlockV1ProposalForEngineering(false)).toBe(false);
  });

  it('does not block panel auto-apply for any routing after the reopen', () => {
    expect(shouldBlockPanelAutoApply({
      useEngineeringPipeline: false,
      requestClass: 'ENGINEERING_CHANGE',
    })).toBe(false);

    expect(shouldBlockPanelAutoApply({
      useEngineeringPipeline: true,
      requestClass: 'ENGINEERING_CHANGE',
    })).toBe(false);

    expect(shouldBlockPanelAutoApply({
      useEngineeringPipeline: false,
      requestClass: 'TOOL_QUERY',
    })).toBe(false);
  });

  it('does not block ChangeSet apply', () => {
    expect(shouldBlockV1ChangeSetApply()).toBe(false);
  });
});
