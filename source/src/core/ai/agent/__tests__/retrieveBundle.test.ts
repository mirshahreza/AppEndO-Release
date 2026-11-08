import { describe, expect, it } from 'vitest';
import {
  applyRetrieveToolCall,
  EMPTY_RETRIEVE_FLAGS,
  isRetrieveBundleSatisfied,
  resolveRetrieveBundleRequirement,
} from '../retrieveBundle';
import { testAiPageContext } from './testAgentFixtures';

describe('retrieveBundle', () => {
  it('requires workflow standards and code context', () => {
    const requirement = resolveRetrieveBundleRequirement(
      testAiPageContext({ path: '/server-functions', pageKey: 'server-functions' }),
    );

    expect(isRetrieveBundleSatisfied(EMPTY_RETRIEVE_FLAGS, requirement)).toBe(false);

    let flags = applyRetrieveToolCall(
      EMPTY_RETRIEVE_FLAGS,
      'get_project_standards',
      { shard: 'vibe-server-function' },
      requirement.standardsShard,
    );
    expect(isRetrieveBundleSatisfied(flags, requirement)).toBe(false);

    flags = applyRetrieveToolCall(flags, 'read_file', { path: 'src/foo.ts' }, requirement.standardsShard);
    expect(isRetrieveBundleSatisfied(flags, requirement)).toBe(true);
  });

  it('requires function context when functionId is active on WF-1', () => {
    const requirement = resolveRetrieveBundleRequirement(
      testAiPageContext({
        path: '/server-functions',
        pageKey: 'server-functions',
        functionId: 'smoke.echo',
      }),
    );

    let flags = applyRetrieveToolCall(
      EMPTY_RETRIEVE_FLAGS,
      'get_project_standards',
      { shard: 'vibe-server-function' },
      requirement.standardsShard,
    );
    flags = applyRetrieveToolCall(flags, 'read_file', { path: 'src/foo.ts' }, requirement.standardsShard);
    expect(isRetrieveBundleSatisfied(flags, requirement)).toBe(false);

    flags = applyRetrieveToolCall(
      flags,
      'get_server_function',
      { functionId: 'smoke.echo' },
      requirement.standardsShard,
    );
    expect(isRetrieveBundleSatisfied(flags, requirement)).toBe(true);
  });
});
