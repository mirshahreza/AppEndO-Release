export const FILE_HUB_PROTOCOLS = ['sftp', 'ftp', 'ftps'] as const;
export type FileHubProtocol = (typeof FILE_HUB_PROTOCOLS)[number];

export const FILE_HUB_AUTH_METHODS = ['password', 'privateKey'] as const;
export type FileHubAuthMethod = (typeof FILE_HUB_AUTH_METHODS)[number];

export const FILE_HUB_ENTRY_TYPES = ['file', 'directory'] as const;
export type FileHubEntryType = (typeof FILE_HUB_ENTRY_TYPES)[number];

export type FileHubConnectionRecord = {
  id: string;
  key: string;
  name: string;
  protocol: FileHubProtocol;
  host: string;
  port: number;
  username: string;
  authMethod: FileHubAuthMethod;
  hasPassword: boolean;
  hasPrivateKey: boolean;
  hasPassphrase: boolean;
  initialPath: string;
  tags: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type FileHubConnectionPublic = {
  id: string;
  key: string;
  name: string;
  protocol: FileHubProtocol;
  host: string;
  port: number;
  username: string;
  authMethod: FileHubAuthMethod;
  hasPassword: boolean;
  hasPrivateKey: boolean;
  hasPassphrase: boolean;
  initialPath: string;
  tags: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type FileHubConnectionWritePayload = {
  key?: string;
  name?: string;
  protocol?: FileHubProtocol;
  host?: string;
  port?: number;
  username?: string;
  authMethod?: FileHubAuthMethod;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  clearPassword?: boolean;
  clearPrivateKey?: boolean;
  clearPassphrase?: boolean;
  initialPath?: string;
  tags?: string[];
  note?: string;
};

export type FileHubIndexFile = {
  schema: 'appendo-file-hub-index';
  schemaVersion: '1.0.0';
  updatedAt: string;
  connections: FileHubConnectionRecord[];
};

export type FileHubRemoteEntry = {
  name: string;
  type: FileHubEntryType;
  size: number;
  modifyTime: number | null;
  permissions: string;
};

export type FileHubListResponse = {
  success: boolean;
  path: string;
  items: FileHubRemoteEntry[];
  error?: string;
};
