export type DeveloperLibraryRecord = {
  name: string;
  version: string;
  core: boolean;
  requestedBy: string[];
};

export type DeveloperLibrarySearchHit = {
  name: string;
  version: string;
  description: string;
  core: boolean;
};

export type DeveloperLibraryListResponse = {
  success: boolean;
  items: DeveloperLibraryRecord[];
  error?: string;
};

export type DeveloperLibrarySearchResponse = {
  success: boolean;
  items: DeveloperLibrarySearchHit[];
  error?: string;
};

export type DeveloperLibraryMutationResponse = {
  success: boolean;
  library?: DeveloperLibraryRecord;
  error?: string;
};
