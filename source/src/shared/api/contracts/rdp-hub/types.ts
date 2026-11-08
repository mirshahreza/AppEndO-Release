export const RDP_HUB_SECURITY_MODES = ['any', 'nla', 'tls', 'rdp'] as const;

export type RdpHubSecurityMode = (typeof RDP_HUB_SECURITY_MODES)[number];

export type RdpHubConnectionRecord = {
  id: string;
  key: string;
  name: string;
  host: string;
  port: number;
  username: string;
  domain: string;
  security: RdpHubSecurityMode;
  ignoreCert: boolean;
  hasPassword: boolean;
  tags: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type RdpHubConnectionPublic = {
  id: string;
  key: string;
  name: string;
  host: string;
  port: number;
  username: string;
  domain: string;
  security: RdpHubSecurityMode;
  ignoreCert: boolean;
  hasPassword: boolean;
  tags: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type RdpHubConnectionWritePayload = {
  key?: string;
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  domain?: string;
  security?: RdpHubSecurityMode;
  ignoreCert?: boolean;
  password?: string;
  clearPassword?: boolean;
  tags?: string[];
  note?: string;
};

export type RdpHubIndexFile = {
  schema: 'appendo-rdp-hub-index';
  schemaVersion: '1.0.0';
  updatedAt: string;
  connections: RdpHubConnectionRecord[];
};

export type RdpHubSessionTicketPayload = {
  width?: number;
  height?: number;
};

export type RdpHubSessionTicket = {
  token: string;
  expiresAt: string;
};
