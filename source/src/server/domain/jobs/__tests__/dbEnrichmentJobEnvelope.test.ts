import { describe, expect, it } from 'vitest';
import { buildDbEnrichmentJobPayload, parseDbEnrichmentJobPayload } from '../jobRepository';

describe('DB enrichment job envelope (build → parse)', () => {
  const baseInput = {
    runId: 7,
    dataSourceId: 'ds_default_local',
    scope: 'FULL' as const,
    modelId: 'openai-gpt-5-4',
  };

  it('round-trips a real envelope through build → parse unchanged', () => {
    const payload = buildDbEnrichmentJobPayload(baseInput);
    const parsed = parseDbEnrichmentJobPayload(payload);

    expect(parsed).not.toBeNull();
    expect(parsed?.runId).toBe(7);
    expect(parsed?.dataSourceId).toBe('ds_default_local');
    expect(parsed?.scope).toBe('FULL');
    expect(parsed?.modelId).toBe('openai-gpt-5-4');
    expect(parsed?.title).toBe('DB enrichment for ds_default_local');
  });

  it('carries a TABLES scope with its table list through the round trip', () => {
    const payload = buildDbEnrichmentJobPayload({
      runId: 3,
      dataSourceId: 'ds-1',
      scope: 'TABLES',
      tables: ['base_users', 'base_user_profiles'],
    });
    const parsed = parseDbEnrichmentJobPayload(payload);

    expect(parsed?.scope).toBe('TABLES');
    expect(parsed?.tables).toEqual(['base_users', 'base_user_profiles']);
  });

  it('rejects a payload missing runId/dataSourceId', () => {
    expect(parseDbEnrichmentJobPayload(JSON.stringify({ scope: 'FULL' }))).toBeNull();
    expect(parseDbEnrichmentJobPayload(null)).toBeNull();
    expect(parseDbEnrichmentJobPayload('not json')).toBeNull();
  });

  it('defaults an invalid scope to "FULL" rather than crashing', () => {
    const parsed = parseDbEnrichmentJobPayload(JSON.stringify({
      runId: 1, dataSourceId: 'ds-1', scope: 'not-a-real-scope',
    }));
    expect(parsed?.scope).toBe('FULL');
  });
});
