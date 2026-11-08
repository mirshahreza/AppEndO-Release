import { describe, expect, it } from 'vitest';
import {
  isOptionalDbObject,
  packageHasOptionalDbRecords,
  parseInstallOptionalRecordsFlag,
  resolveDbObjectInstallMode,
  selectDbObjectsForRecordChoice,
} from '../packageDbObjectInstallMode';

describe('packageDbObjectInstallMode', () => {
  it('treats omitted installMode as required', () => {
    expect(resolveDbObjectInstallMode({ objectType: 'seed' })).toBe('required');
    expect(isOptionalDbObject({ objectType: 'table', installMode: 'optional' })).toBe(false);
  });

  it('marks seed objects with installMode optional', () => {
    expect(resolveDbObjectInstallMode({
      objectType: 'seed',
      installMode: 'optional',
    })).toBe('optional');
  });

  it('filters optional seed objects unless the installer includes them', () => {
    const objects = [
      { objectType: 'seed' as const, objectName: 'schema', installMode: 'required' as const },
      { objectType: 'seed' as const, objectName: 'rows', installMode: 'optional' as const },
    ];
    expect(selectDbObjectsForRecordChoice(objects, true).map((obj) => obj.objectName)).toEqual(['schema', 'rows']);
    expect(selectDbObjectsForRecordChoice(objects, false).map((obj) => obj.objectName)).toEqual(['schema']);
  });

  it('detects optional records on a manifest', () => {
    expect(packageHasOptionalDbRecords({
      capabilities: {
        db_objects: [{ objectType: 'seed', installMode: 'optional' }],
      },
    })).toBe(true);
    expect(packageHasOptionalDbRecords({
      capabilities: { db_objects: [{ objectType: 'seed' }] },
    })).toBe(false);
  });

  it('parses the install flag with a true default', () => {
    expect(parseInstallOptionalRecordsFlag(undefined)).toBe(true);
    expect(parseInstallOptionalRecordsFlag(false)).toBe(false);
    expect(parseInstallOptionalRecordsFlag(true)).toBe(true);
  });
});
