import { describe, expect, it } from 'vitest';
import { FILE_MANAGER_DESTINATION_EXISTS_ERROR } from '../../../shared/api/contracts/file-manager/types';
import { isFileManagerDestinationExistsError, openFileManagerMoveConflict } from '../constants';

describe('file-manager moveConflict helpers', () => {
  it('detects destination exists errors by status or message', () => {
    const byStatus = new Error('ignored');
    (byStatus as Error & { status?: number }).status = 409;
    expect(isFileManagerDestinationExistsError(byStatus)).toBe(true);

    const byMessage = new Error(FILE_MANAGER_DESTINATION_EXISTS_ERROR);
    expect(isFileManagerDestinationExistsError(byMessage)).toBe(true);

    expect(isFileManagerDestinationExistsError(new Error('Something else'))).toBe(false);
  });

  it('builds move conflict state from paths', () => {
    expect(openFileManagerMoveConflict('workspace/a.txt', 'workspace/dest')).toEqual({
      sourcePath: 'workspace/a.txt',
      destinationParentPath: 'workspace/dest',
      entryName: 'a.txt',
    });
  });
});
