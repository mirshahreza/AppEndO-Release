export const SSH_HUB_AUTH_METHODS = ['password', 'privateKey'] as const;

export type SshHubAuthMethod = (typeof SSH_HUB_AUTH_METHODS)[number];

export type SshHubConnectionRecord = {
  id: string;
  key: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: SshHubAuthMethod;
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

export type SshHubConnectionPublic = {
  id: string;
  key: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: SshHubAuthMethod;
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

export type SshHubConnectionWritePayload = {
  key?: string;
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  authMethod?: SshHubAuthMethod;
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

export type SshHubIndexFile = {
  schema: 'appendo-ssh-hub-index';
  schemaVersion: '1.0.0';
  updatedAt: string;
  connections: SshHubConnectionRecord[];
};
