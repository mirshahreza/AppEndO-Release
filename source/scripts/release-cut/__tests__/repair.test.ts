import { describe, expect, it } from 'vitest';
import { attemptRepairForLog, repairActionForLog } from '../repair';

describe('repairActionForLog', () => {
  it('returns abort for unrelated logs', () => {
    expect(repairActionForLog('some random failure')).toBe('abort');
  });

  it('returns retry for ZIP_VERSION_MISMATCH', () => {
    expect(repairActionForLog('ZIP_VERSION_MISMATCH: manifest=1 code=2')).toBe('retry');
  });
});

describe('attemptRepairForLog', () => {
  it('returns abort for unrelated logs without spawning npm', () => {
    expect(attemptRepairForLog('some random failure', process.cwd(), process.cwd())).toBe('abort');
  });
});
