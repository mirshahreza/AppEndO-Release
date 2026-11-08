import type { FunctionAccessEntityKind } from '../server-functions/entityAccess';

export type AccessAssistantSurfaceManifest = {
  surfaceId: string;
  title: string;
  functionIds: string[];
};

export type AccessAssistantPageManifest = {
  pageKey: string;
  root: AccessAssistantSurfaceManifest;
  linkedSurfaces: AccessAssistantSurfaceManifest[];
};

export type AccessAssistantFunctionRow = {
  id: string;
  name: string;
  method: string;
  path: string;
  blurb: string;
  allowed: boolean;
  editable: boolean;
};

export type AccessAssistantSurfaceContext = {
  surfaceId: string;
  title: string;
  functions: AccessAssistantFunctionRow[];
};

export type AccessAssistantEligibility = {
  eligible: boolean;
  reason?: string;
  editComponent?: {
    enabled: boolean;
    reason?: string;
    componentSlug?: string;
  };
};

export type AccessAssistantContextResponse = {
  success: true;
  pageKey: string;
  pageTitle: string;
  eligibility: AccessAssistantEligibility;
  surfaces: AccessAssistantSurfaceContext[];
  entityKind?: FunctionAccessEntityKind;
  entityKey?: string;
  entityLabel?: string;
  adminBypass: boolean;
};

export type AccessAssistantSavePayload = {
  entityKind: FunctionAccessEntityKind;
  entityKey: string;
  allowedByFunctionId: Record<string, boolean>;
};
