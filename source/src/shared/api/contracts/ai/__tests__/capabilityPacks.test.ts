import { describe, expect, it } from 'vitest';
import {
  AI_CAPABILITY_PACK_CATALOG,
  AI_CAPABILITY_PACK_IDS,
  DEFAULT_AGENT_CAPABILITY_SCOPE,
  DEFAULT_ENABLED_CAPABILITY_PACK_IDS,
  P0_CAPABILITY_PACK_IDS,
  getAiCapabilityPack,
  isAiCapabilityPackId,
} from '../capabilityPacks';

describe('AI_CAPABILITY_PACK_CATALOG', () => {
  it('has unique pack ids', () => {
    const ids = AI_CAPABILITY_PACK_CATALOG.map((pack) => pack.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('defines all five P0 packs', () => {
    expect(P0_CAPABILITY_PACK_IDS).toEqual([
      'appendo-files',
      'appendo-codebase',
      'appendo-git',
      'appendo-web',
      'appendo-http',
    ]);
    P0_CAPABILITY_PACK_IDS.forEach((id) => {
      expect(isAiCapabilityPackId(id)).toBe(true);
      expect(getAiCapabilityPack(id).tier).toBe('p0');
    });
  });

  it('maps every catalog id through AI_CAPABILITY_PACK_IDS', () => {
    expect(AI_CAPABILITY_PACK_IDS).toHaveLength(AI_CAPABILITY_PACK_CATALOG.length);
    AI_CAPABILITY_PACK_CATALOG.forEach((pack) => {
      expect(AI_CAPABILITY_PACK_IDS).toContain(pack.id);
    });
  });

  it('applies default session scope per product policy', () => {
    // Read-only / draft-gated packs (git writes go through the same confirm-before-apply
    // draft flow as file patches; data/packages/openapi are read-only) are on by default so
    // a fresh agent session isn't silently missing basic dev-assistant capabilities. Packs
    // with real external-egress or side-effect risk (web, http, jobs, memory, cache) stay
    // opt-in.
    expect([...DEFAULT_ENABLED_CAPABILITY_PACK_IDS].sort()).toEqual([
      'appendo-codebase',
      'appendo-context',
      'appendo-data',
      'appendo-designer',
      'appendo-files',
      'appendo-git',
      'appendo-openapi',
      'appendo-packages',
      'appendo-server-functions',
      'appendo-standards',
    ]);
    expect(DEFAULT_AGENT_CAPABILITY_SCOPE).toEqual({
      packIds: [...DEFAULT_ENABLED_CAPABILITY_PACK_IDS],
      mcpServerIds: [],
    });
    expect(getAiCapabilityPack('appendo-web').defaultEnabled).toBe(false);
    expect(getAiCapabilityPack('appendo-http').defaultEnabled).toBe(false);
    expect(getAiCapabilityPack('appendo-jobs').defaultEnabled).toBe(false);
    expect(getAiCapabilityPack('appendo-memory').defaultEnabled).toBe(false);
    expect(getAiCapabilityPack('appendo-cache').defaultEnabled).toBe(false);
    // p-99/WFT-4 — invoke_workflow_action can reach web.*/data.db-query, same real-egress-risk
    // opt-in policy as appendo-web/appendo-http/appendo-jobs above.
    expect(getAiCapabilityPack('appendo-workflow').defaultEnabled).toBe(false);
    expect(getAiCapabilityPack('appendo-git').defaultEnabled).toBe(true);
    expect(getAiCapabilityPack('appendo-data').defaultEnabled).toBe(true);
  });
});
