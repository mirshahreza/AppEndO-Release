import { describe, expect, it } from 'vitest';
import { BASE_INFO_JOIN_TABLE_ID } from '../dataApiJoinTableOptions';
import {
  buildEnrichmentFromDialogState,
  buildFieldEnrichmentDialogState,
} from '../dataApiFieldEnrichmentUi';

const baseInfoJoinOptions = [{
  id: BASE_INFO_JOIN_TABLE_ID,
  label: 'base_info',
  source: 'base_info' as const,
}];

describe('dataApiFieldEnrichmentUi', () => {
  it('builds base_info enrichment for id columns without a mapped rootId', () => {
    const state = buildFieldEnrichmentDialogState(
      'madein_country_id',
      undefined,
      baseInfoJoinOptions,
    );

    expect(state.selectedFieldNames).toEqual(['title']);

    const enrichment = buildEnrichmentFromDialogState(
      'madein_country_id',
      undefined,
      baseInfoJoinOptions,
      state,
    );

    expect(enrichment).toMatchObject({
      kind: 'base_info_title',
      sourceField: 'madein_country_id',
      attachedFields: [{
        sourceColumn: 'title',
        outputField: 'madein_country_id_Title',
      }],
    });
    expect(enrichment && 'rootId' in enrichment ? enrichment.rootId : undefined).toBeUndefined();
  });

  it('keeps rootId for known base_info code fields', () => {
    const state = {
      joinTableId: BASE_INFO_JOIN_TABLE_ID,
      selectedFieldNames: ['title'],
    };

    const enrichment = buildEnrichmentFromDialogState(
      'gender_code',
      undefined,
      baseInfoJoinOptions,
      state,
    );

    expect(enrichment).toMatchObject({
      kind: 'base_info_title',
      rootId: '100.1',
      attachedFields: [{
        sourceColumn: 'title',
        outputField: 'gender_title',
      }],
    });
  });
});
