import { describe, expect, it } from 'vitest';
import { probeChangeGraphWorkspaceScaffold } from '../changeGraphWorkspaceHealth';

describe('changeGraphWorkspaceHealth', () => {
  it('passes combined change graph + workspace + builder orchestration probe', () => {
    const probe = probeChangeGraphWorkspaceScaffold();
    expect(probe.ok).toBe(true);
    expect(probe.failures).toEqual([]);
  });
});
