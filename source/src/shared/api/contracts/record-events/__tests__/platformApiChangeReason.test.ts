import { describe, expect, it } from 'vitest';
import {
  dataApiOperationAllowsChangeReason,
  familyFolderIdForRoute,
  namedApiAllowsChangeReasonSettings,
  RECORD_CHANGE_REASON_USERS_LIFECYCLE,
  RECORD_CHANGE_REASON_USERS_LOCK,
  functionChangeReasonFallback,
} from '../index';

describe('namedApiAllowsChangeReasonSettings', () => {
  it('hides settings on reads, collection creates, password, and auth', () => {
    expect(namedApiAllowsChangeReasonSettings('GET', '/api/users')).toBe(false);
    expect(namedApiAllowsChangeReasonSettings('GET', '/api/users/:id')).toBe(false);
    expect(namedApiAllowsChangeReasonSettings('POST', '/api/users')).toBe(false);
    expect(namedApiAllowsChangeReasonSettings('POST', '/api/sample-mock')).toBe(false);
    expect(namedApiAllowsChangeReasonSettings('POST', '/api/users/:id/roles')).toBe(false);
    expect(namedApiAllowsChangeReasonSettings('POST', '/api/users/:id/reset-password')).toBe(false);
    expect(namedApiAllowsChangeReasonSettings('PUT', '/api/users/:id/change-password')).toBe(false);
    expect(namedApiAllowsChangeReasonSettings('POST', '/api/auth/login')).toBe(false);
  });

  it('allows settings on update, patch, delete, and resource actions', () => {
    expect(namedApiAllowsChangeReasonSettings('PUT', '/api/users/:id/profile')).toBe(true);
    expect(namedApiAllowsChangeReasonSettings('PATCH', '/api/users/:id/lock')).toBe(true);
    expect(namedApiAllowsChangeReasonSettings('DELETE', '/api/users/:id')).toBe(true);
    expect(namedApiAllowsChangeReasonSettings('PUT', '/api/users/:id/roles')).toBe(true);
    expect(namedApiAllowsChangeReasonSettings('PATCH', '/api/sample-mock/records/:id')).toBe(true);
    expect(namedApiAllowsChangeReasonSettings('DELETE', '/api/sample-mock/records/:id')).toBe(true);
  });
});

describe('dataApiOperationAllowsChangeReason', () => {
  it('allows only update, patch, and delete', () => {
    expect(dataApiOperationAllowsChangeReason('list')).toBe(false);
    expect(dataApiOperationAllowsChangeReason('getOne')).toBe(false);
    expect(dataApiOperationAllowsChangeReason('create')).toBe(false);
    expect(dataApiOperationAllowsChangeReason('lookup')).toBe(false);
    expect(dataApiOperationAllowsChangeReason('update')).toBe(true);
    expect(dataApiOperationAllowsChangeReason('patch')).toBe(true);
    expect(dataApiOperationAllowsChangeReason('delete')).toBe(true);
  });
});

describe('familyFolderIdForRoute', () => {
  it('shares lock/unlock/locked and maps delete to lifecycle', () => {
    expect(familyFolderIdForRoute('PATCH', '/api/users/:id/lock')).toBe(RECORD_CHANGE_REASON_USERS_LOCK);
    expect(familyFolderIdForRoute('PATCH', '/api/users/:id/unlock')).toBe(RECORD_CHANGE_REASON_USERS_LOCK);
    expect(familyFolderIdForRoute('DELETE', '/api/users/:id')).toBe(RECORD_CHANGE_REASON_USERS_LIFECYCLE);
    expect(familyFolderIdForRoute('PATCH', '/api/sample-mock/records/:id')).toBe('100.6.35');
    expect(familyFolderIdForRoute('PATCH', '/api/sample-mock/records/:id/approve')).toBe('100.6.35');
    expect(familyFolderIdForRoute('PATCH', '/api/sample-mock/records/:id/lock')).toBe('100.6.35');
    expect(familyFolderIdForRoute('DELETE', '/api/sample-mock/records/:id')).toBe('100.6.35');
    expect(functionChangeReasonFallback('POST', '/api/users')).toBeUndefined();
    expect(functionChangeReasonFallback('DELETE', '/api/users/:id')?.reasonVocabNodeId)
      .toBe(RECORD_CHANGE_REASON_USERS_LIFECYCLE);
    expect(functionChangeReasonFallback('PATCH', '/api/sample-mock/records/:id')).toEqual(
      expect.objectContaining({ reasonAsk: 'optional' }),
    );
    expect(functionChangeReasonFallback('DELETE', '/api/sample-mock/records/:id')).toEqual(
      expect.objectContaining({ reasonAsk: 'optional' }),
    );
  });
});
