export type HttpWorkshopAuthKind = 'inherit' | 'none' | 'apiKey' | 'bearer' | 'basic' | 'customHeaders';

export type HttpWorkshopCustomHeader = { name: string; value: string };

/** Stored shape — the secret lives in the credential vault, not on this record. */
export type HttpWorkshopAuth = {
  kind: HttpWorkshopAuthKind;
  apiKeyHeaderName?: string;
  basicUsername?: string;
  customHeaders?: HttpWorkshopCustomHeader[];
  hasSecret?: boolean;
};

/** What API responses expose — never a vault blob or plaintext secret. */
export type HttpWorkshopAuthSummary = Omit<HttpWorkshopAuth, 'hasSecret'> & { hasSecret: boolean };

/** Input accepted from clients when creating/updating an auth config. Omit `secretPlaintext` on update to keep the existing secret. */
export type HttpWorkshopAuthInput = {
  kind: HttpWorkshopAuthKind;
  apiKeyHeaderName?: string;
  basicUsername?: string;
  secretPlaintext?: string;
  customHeaders?: HttpWorkshopCustomHeader[];
};

export function toHttpWorkshopAuthSummary(auth: HttpWorkshopAuth): HttpWorkshopAuthSummary {
  return { ...auth, hasSecret: Boolean(auth.hasSecret) };
}

export const INHERIT_AUTH: HttpWorkshopAuth = { kind: 'inherit', hasSecret: false };

export type HttpWorkshopCollection = {
  id: string;
  name: string;
  description?: string;
  auth: HttpWorkshopAuth;
  /** Set by the one-off legacy migration script; lets it be re-run idempotently. */
  migratedFromLegacyId?: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId: number;
};

export type HttpWorkshopFolder = {
  id: string;
  collectionId: string;
  parentFolderId: string | null;
  name: string;
  auth: HttpWorkshopAuth;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type HttpWorkshopMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type HttpWorkshopKeyValue = { key: string; value: string; enabled: boolean };
export type HttpWorkshopFormField = HttpWorkshopKeyValue & { isFile?: boolean };
export type HttpWorkshopBodyMode = 'none' | 'json' | 'raw' | 'form-urlencoded' | 'multipart';

export type HttpWorkshopAssertion =
  | { kind: 'status'; op: 'equals' | 'in-range'; value: number | [number, number] }
  | { kind: 'duration'; op: 'lt'; ms: number }
  | { kind: 'header'; name: string; op: 'exists' | 'equals'; value?: string }
  | { kind: 'jsonPath'; path: string; op: 'exists' | 'equals' | 'contains'; value?: unknown };

export type HttpWorkshopRequest = {
  id: string;
  collectionId: string;
  folderId: string | null;
  name: string;
  method: HttpWorkshopMethod;
  url: string;
  queryParams: HttpWorkshopKeyValue[];
  headers: HttpWorkshopKeyValue[];
  bodyMode: HttpWorkshopBodyMode;
  bodyRaw?: string;
  bodyForm?: HttpWorkshopFormField[];
  auth: HttpWorkshopAuth;
  assertions: HttpWorkshopAssertion[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
