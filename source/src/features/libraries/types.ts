import type { DeveloperLibraryRecord } from '../../shared/api/contracts/libraries/types';

export type LibraryGridRow = DeveloperLibraryRecord & {
  installed: boolean;
  description?: string;
};
