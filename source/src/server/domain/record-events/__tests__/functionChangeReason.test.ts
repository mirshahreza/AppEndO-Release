import { describe, expect, it } from 'vitest';
import {
  USERS_PROFILE_CHANGE_REASON,
  SAMPLE_MOCK_CHANGE_REASON,
  functionChangeReasonFallback,
} from '../../../../shared/api/contracts/record-events';
import { parseFunctionMetadataChangeReason } from '../functionChangeReason';

describe('parseFunctionMetadataChangeReason', () => {
  it('uses the stored policy including explicit off', () => {
    expect(parseFunctionMetadataChangeReason(
      { changeReason: { reasonAsk: 'off' } },
      USERS_PROFILE_CHANGE_REASON,
    )).toEqual({ reasonAsk: 'off' });
  });

  it('falls back when metadata has no changeReason', () => {
    expect(parseFunctionMetadataChangeReason(
      { apiDoc: { summary: 'Profile' } },
      USERS_PROFILE_CHANGE_REASON,
    )).toEqual(USERS_PROFILE_CHANGE_REASON);
  });
});

describe('functionChangeReasonFallback', () => {
  it('maps profile writes to the Users profile constant', () => {
    expect(functionChangeReasonFallback('PUT', '/api/profile')).toEqual(USERS_PROFILE_CHANGE_REASON);
    expect(functionChangeReasonFallback('GET', '/api/profile')).toBeUndefined();
  });

  it('maps sample-mock writes to the sample-mock constant', () => {
    expect(functionChangeReasonFallback('PATCH', '/api/sample-mock/records/:id')).toEqual(SAMPLE_MOCK_CHANGE_REASON);
    expect(functionChangeReasonFallback('PATCH', '/api/sample-mock/records/:id/lock')).toEqual(SAMPLE_MOCK_CHANGE_REASON);
    expect(functionChangeReasonFallback('DELETE', '/api/sample-mock/records/:id')).toEqual(SAMPLE_MOCK_CHANGE_REASON);
  });

  it('points Users lock / roles / profile fallbacks at their situation folders', () => {
    expect(functionChangeReasonFallback('PATCH', '/api/users/:id/locked')?.reasonVocabNodeId).toBe('100.6.20');
    expect(functionChangeReasonFallback('PUT', '/api/users/:id/roles')?.reasonVocabNodeId).toBe('100.6.21');
    expect(USERS_PROFILE_CHANGE_REASON.reasonVocabNodeId).toBe('100.6.22');
    expect(SAMPLE_MOCK_CHANGE_REASON.reasonVocabNodeId).toBe('100.6.35');
  });
});
