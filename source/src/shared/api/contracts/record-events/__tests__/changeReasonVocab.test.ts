import { describe, expect, it } from 'vitest';
import {
  RECORD_CHANGE_REASON_GENERAL,
  RECORD_CHANGE_REASON_USERS_LOCK,
  RECORD_CHANGE_REASON_USERS_ROLES,
  RECORD_CHANGE_REASON_VOCAB_ROOT,
  catalogAllowedReasonCodes,
  catalogLabelForReasonCode,
  catalogLeavesForReasonVocab,
  hasAssignedReasonFolder,
  mergeChangeReasonSelectOptions,
  resolveReasonVocabNodeId,
  toChangeReasonSelectOptions,
  withSelectedChangeReasonCode,
} from '../changeReasonVocab';

describe('change reason vocab', () => {
  it('maps the catalog root to the General folder', () => {
    expect(resolveReasonVocabNodeId(undefined)).toBe(RECORD_CHANGE_REASON_GENERAL);
    expect(resolveReasonVocabNodeId(RECORD_CHANGE_REASON_VOCAB_ROOT)).toBe(RECORD_CHANGE_REASON_GENERAL);
    expect(resolveReasonVocabNodeId(RECORD_CHANGE_REASON_USERS_LOCK)).toBe(RECORD_CHANGE_REASON_USERS_LOCK);
  });

  it('drops the parent folder from combo options', () => {
    expect(toChangeReasonSelectOptions(
      [
        { id: RECORD_CHANGE_REASON_USERS_LOCK, label: 'Users lock', has_children: true },
        { id: '100.6.6', label: 'Lock' },
        { id: '100.6.7', label: 'Unlock' },
      ],
      RECORD_CHANGE_REASON_USERS_LOCK,
    )).toEqual([
      { id: '100.6.6', label: 'Lock' },
      { id: '100.6.7', label: 'Unlock' },
    ]);
  });

  it('unions situation leaves ahead of general leaves', () => {
    expect(mergeChangeReasonSelectOptions(
      [{ id: '100.6.6', label: 'Lock' }],
      [{ id: '100.6.1', label: 'Correction' }],
      true,
      RECORD_CHANGE_REASON_USERS_LOCK,
    )).toEqual([
      { id: '100.6.6', label: 'Lock' },
      { id: '100.6.1', label: 'Correction' },
    ]);
  });

  it('omits general leaves when includeGeneral is false', () => {
    expect(mergeChangeReasonSelectOptions(
      [{ id: '100.6.6', label: 'Lock' }],
      [{ id: '100.6.1', label: 'Correction' }],
      false,
      RECORD_CHANGE_REASON_USERS_LOCK,
    )).toEqual([{ id: '100.6.6', label: 'Lock' }]);
  });

  it('treats General as unassigned so each API can own its own folder', () => {
    expect(hasAssignedReasonFolder(undefined)).toBe(false);
    expect(hasAssignedReasonFolder(RECORD_CHANGE_REASON_GENERAL)).toBe(false);
    expect(hasAssignedReasonFolder(RECORD_CHANGE_REASON_VOCAB_ROOT)).toBe(false);
    expect(hasAssignedReasonFolder(RECORD_CHANGE_REASON_USERS_LOCK)).toBe(true);
    expect(hasAssignedReasonFolder('100.6.47')).toBe(true);
  });

  it('paints catalog titles instead of raw node ids in the combo', () => {
    expect(catalogLabelForReasonCode('100.6.6')).toBe('Lock');
    expect(withSelectedChangeReasonCode(
      [{ id: '100.6.1', label: '100.6.1' }],
      '100.6.6',
    )).toEqual([
      { id: '100.6.6', label: 'Lock' },
      { id: '100.6.1', label: 'Correction' },
    ]);
  });

  it('fills each current combo from the platform catalog', () => {
    const general = catalogLeavesForReasonVocab(RECORD_CHANGE_REASON_GENERAL);
    expect(general.map((item) => item.label)).toEqual([
      'Correction',
      'User requested',
      'Data entry error',
      'Name or identity change',
      'Duplicate or merge',
      'Policy update',
      'Security',
      'Compliance',
      'Legal or court order',
      'Reverted',
      'Other',
    ]);
    expect(catalogLeavesForReasonVocab(RECORD_CHANGE_REASON_USERS_LOCK).map((item) => item.label)).toContain('Lock');
    expect(catalogLeavesForReasonVocab(RECORD_CHANGE_REASON_USERS_LOCK).map((item) => item.label)).toContain('Inactivity');
    expect(catalogLeavesForReasonVocab(RECORD_CHANGE_REASON_USERS_ROLES).map((item) => item.label)).toContain('Access review');
    expect(catalogLeavesForReasonVocab('100.6.22').map((item) => item.label)).toContain('Onboarding');
    expect(catalogLeavesForReasonVocab('100.6.35').map((item) => item.label)).toEqual([
      'Status change',
      'Approval',
      'Record update',
    ]);
    expect(catalogAllowedReasonCodes(RECORD_CHANGE_REASON_USERS_LOCK, true)).toContain('100.6.1');
    expect(catalogAllowedReasonCodes(RECORD_CHANGE_REASON_USERS_LOCK, true)).toContain('100.6.6');
  });
});
