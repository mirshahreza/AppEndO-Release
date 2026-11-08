import { describe, expect, it } from 'vitest';
import {
  INTERNAL_API_CALL_ACTION_KEY,
  WEB_FETCH_URL_ACTION_KEY,
  WEB_SCREENSHOT_URL_ACTION_KEY,
  WEB_SEARCH_ACTION_KEY,
  friendlyActionLabel,
  groupActionsForPalette,
  type ActionCatalogEntry,
} from '../actionCatalogUtils';

const entry = (key: string): ActionCatalogEntry => ({
  key,
  version: '1',
  availability: 'AVAILABLE',
  sideEffectClass: 'PURE',
  tags: [],
  configSchema: { type: 'INLINE', schema: {} },
  inputSchema: { type: 'INLINE', schema: {} },
});

describe('groupActionsForPalette', () => {
  it('puts Internal API call under Integration and hides leftover uncategorized actions', () => {
    const groups = groupActionsForPalette([
      entry('text.template'),
      entry('identity.user-get'),
      entry('cms.content-get'),
      entry(INTERNAL_API_CALL_ACTION_KEY),
      entry('jobs.enqueue'),
      entry('integration.http-request'),
    ], '');

    expect(groups.map((group) => group.category)).toEqual(['text', 'integration', 'web']);
    expect(groups.find((group) => group.category === 'other' as never)).toBeUndefined();
    const integration = groups.find((group) => group.category === 'integration');
    expect(integration?.label).toBe('Integration');
    expect(integration?.actions.map((action) => action.key)).toEqual([
      'integration.http-request',
      INTERNAL_API_CALL_ACTION_KEY,
    ]);
  });

  it('surfaces Web search, Fetch page, and Screenshot URL under Web', () => {
    const groups = groupActionsForPalette([
      entry(WEB_SEARCH_ACTION_KEY),
      entry(WEB_FETCH_URL_ACTION_KEY),
      entry(WEB_SCREENSHOT_URL_ACTION_KEY),
    ], '');
    const web = groups.find((group) => group.category === 'web');
    expect(web?.label).toBe('Web');
    expect(web?.actions.map((action) => action.key)).toEqual([
      WEB_SEARCH_ACTION_KEY,
      WEB_FETCH_URL_ACTION_KEY,
      WEB_SCREENSHOT_URL_ACTION_KEY,
    ]);
    expect(friendlyActionLabel(WEB_SEARCH_ACTION_KEY)).toBe('Web search');
    expect(friendlyActionLabel(WEB_FETCH_URL_ACTION_KEY)).toBe('Fetch page');
    expect(friendlyActionLabel(WEB_SCREENSHOT_URL_ACTION_KEY)).toBe('Screenshot URL');
  });

  it('matches Internal API call from friendly label and docs-oriented search', () => {
    const catalog = [entry(INTERNAL_API_CALL_ACTION_KEY), entry('identity.user-get')];
    expect(groupActionsForPalette(catalog, 'internal api')[0]?.actions[0]?.key).toBe(INTERNAL_API_CALL_ACTION_KEY);
    expect(groupActionsForPalette(catalog, 'server function')[0]?.actions[0]?.key).toBe(INTERNAL_API_CALL_ACTION_KEY);
    expect(groupActionsForPalette(catalog, 'identity')).toEqual([]);
  });

  it('labels the action Internal API call', () => {
    expect(friendlyActionLabel(INTERNAL_API_CALL_ACTION_KEY)).toBe('Internal API call');
  });

  it('always shows Integration and Web toolbox items even when the catalog is stale', () => {
    const groups = groupActionsForPalette([entry('text.template')], '');
    const integration = groups.find((group) => group.category === 'integration');
    const web = groups.find((group) => group.category === 'web');
    expect(integration?.actions.map((action) => action.key)).toEqual([INTERNAL_API_CALL_ACTION_KEY]);
    expect(web?.actions.map((action) => action.key)).toEqual([
      WEB_SEARCH_ACTION_KEY,
      WEB_FETCH_URL_ACTION_KEY,
      WEB_SCREENSHOT_URL_ACTION_KEY,
    ]);
  });

  it('surfaces CSV-to-database Actions under Data with operator-facing labels', () => {
    const groups = groupActionsForPalette([
      entry('data.record-create-many'),
      entry('data.map-records'),
      entry('data.csv-parse'),
      entry('integration.http-request'),
    ], '');
    expect(groups.map((group) => group.category)).toEqual(['data', 'integration', 'web']);
    const data = groups.find((group) => group.category === 'data');
    expect(data?.actions.map((action) => action.key)).toEqual([
      'data.csv-parse',
      'data.map-records',
      'data.record-create-many',
    ]);
    expect(friendlyActionLabel('data.record-create-many')).toBe('Create many records');
    expect(friendlyActionLabel('data.map-records')).toBe('Map records');
  });

  it('matches Create many records from friendly label search', () => {
    const catalog = [entry('data.record-create-many'), entry('text.template')];
    expect(groupActionsForPalette(catalog, 'create many')[0]?.actions[0]?.key).toBe('data.record-create-many');
    expect(groupActionsForPalette(catalog, 'csv import')[0]?.actions[0]?.key).toBe('data.record-create-many');
  });

  it('surfaces the new engine toolbox Actions with operator-facing labels and search aliases', () => {
    const catalog = [
      entry('communication.notification-send'),
      entry('crypto.hmac-verify'),
      entry('data.html-to-text'),
      entry('data.rss-parse'),
      entry('document.pdf-extract-text'),
      entry('ai.embedding'),
      entry('ai.vector-upsert'),
      entry('ai.vector-search'),
      entry('integration.event-publish'),
    ];
    const groups = groupActionsForPalette(catalog, '');
    expect(groups.map((group) => group.category)).toEqual(['data', 'communication', 'integration', 'web', 'ai', 'crypto', 'document']);
    expect(friendlyActionLabel('communication.notification-send')).toBe('In-app notification');
    expect(friendlyActionLabel('integration.event-publish')).toBe('Publish event');
    expect(friendlyActionLabel('crypto.hmac-verify')).toBe('Verify HMAC');
    expect(friendlyActionLabel('ai.vector-search')).toBe('Vector search');
    expect(groupActionsForPalette(catalog, 'hmac')[0]?.actions[0]?.key).toBe('crypto.hmac-verify');
    expect(groupActionsForPalette(catalog, 'parse rss')[0]?.actions[0]?.key).toBe('data.rss-parse');
    expect(groupActionsForPalette(catalog, 'in-app')[0]?.actions[0]?.key).toBe('communication.notification-send');
    expect(groupActionsForPalette(catalog, 'event bus')[0]?.actions[0]?.key).toBe('integration.event-publish');
  });
});
