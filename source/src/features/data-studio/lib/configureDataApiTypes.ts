import type { EdgeApiLangSource, EdgeApiRuntimeSettings } from '../../../shared/api/contracts/data-api';
import type { FunctionAccessControl } from '../../../shared/api/contracts/server-functions/accessControl';
import type { ChangeReasonPolicyForm } from '../../../shared/ui/ChangeReasonPolicyFields';
import type { RouteComposerOption, RouteValidationField } from './routeComposerTypes';

/** How list total COUNT behaves when `countMode` is not fixed on the operation. */
export type ConfigureDataApiListCountMode = 'inherit' | 'none' | 'exact' | 'query';

export type ConfigureDataApiQueryOptions = {
  allowFilter: boolean;
  allowSort: boolean;
  maxPageSize: number;
  defaultPageSize: number;
  allowLangParam: boolean;
  forcedPresetIds: string[];
  clientPresetIds: string[];
  listCountMode: ConfigureDataApiListCountMode;
  /** Used when listCountMode is `query` and the client omits `?includeCount`. */
  defaultIncludeCountWhenQuery: boolean;
};

export type ConfigureDataApiEnrichmentAttachedField = {
  sourceColumn: string;
  outputField: string;
};

export type ConfigureDataApiEnrichmentBase = {
  id: string;
  sourceField: string;
};

export type ConfigureDataApiBaseInfoEnrichment = ConfigureDataApiEnrichmentBase & {
  kind: 'base_info_title';
  joinTableSource: 'base_info';
  /** Required for legacy code-based lookup; optional when `attachedFields` resolves by base_info id. */
  rootId?: string;
  attachedFields?: ConfigureDataApiEnrichmentAttachedField[];
  outputField?: string;
  langSource: EdgeApiLangSource;
  includeUiMeta?: boolean;
};

export type ConfigureDataApiJoinLookupEnrichment = ConfigureDataApiEnrichmentBase & {
  kind: 'join_lookup';
  joinTableSource: 'edge_model';
  targetModelId: string;
  targetMatchColumn: string;
  attachedFields: ConfigureDataApiEnrichmentAttachedField[];
};

export type ConfigureDataApiEnrichment =
  | ConfigureDataApiBaseInfoEnrichment
  | ConfigureDataApiJoinLookupEnrichment;

export type ConfigureDataApiIncludeConfig = {
  as: string;
  enabled: boolean;
  limit?: number;
  separate?: boolean;
  order?: string;
  fields?: string[];
  nestedIncludes?: string[];
};

export type ConfigureDataApiComputedField = {
  id: string;
  outputField: string;
  kind: 'scalar_subquery' | 'aggregate';
  expression: string;
};

export type ConfigureDataApiRecordScopeMode = 'default' | 'bypass' | 'policy';

export type ConfigureDataApiFormState = {
  apiName: string;
  model: RouteComposerOption;
  outputFields: string[];
  inputFields: RouteValidationField[];
  enrichments: ConfigureDataApiEnrichment[];
  includeConfigs: ConfigureDataApiIncludeConfig[];
  computedFields: ConfigureDataApiComputedField[];
  queryOptions: ConfigureDataApiQueryOptions;
  accessControl: FunctionAccessControl;
  runtime: EdgeApiRuntimeSettings;
  operationId?: string;
  definitionId?: string;
  recordScopeMode: ConfigureDataApiRecordScopeMode;
  recordPolicyId: string;
  /** @deprecated Derived from recordScopeMode when saving. */
  bypassRecordPolicy: boolean;
  clientContextFields?: Array<{ id: string; mode: 'off' | 'record' | 'require' }>;
  changeReason: ChangeReasonPolicyForm;
};

export type ConfigureDataApiDialogMode = 'create' | 'edit';

export type ConfigureDataApiConfigTabId =
  | 'fields'
  | 'relations'
  | 'computed'
  | 'query'
  | 'access'
  | 'runtime'
  | 'hooks'
  | 'test';
