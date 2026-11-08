import { apiFetch } from '../../shared/api/authSession';
import { isNestedPayloadPath } from './bindingApiHelpers';
import { buildBindingQuerySearchParams } from './bindingQueryParams';
import type { ResolvedEventBinding } from './bindingEngine';
import type { CrossFieldRule, DesignerBindingActionType, DesignerDocument, PayloadFieldTransform } from './types';
import {
  resolveRegionDmlUrl,
  type RegionFormFieldMapping,
} from './bindingRegionEngine';
import { readNestedContextValue } from './bindingResourceModel';
import { validateRegionSubmitFields } from './previewFieldValidation';

// Same bug/fix as bindingCodegen.ts's resolveCrossFieldRulesForRegion: the Inspector panel
// always stores this prop as a JSON string, not a raw array.
export const resolveCrossFieldRules = (
  document: DesignerDocument | undefined,
  regionNodeId: string | undefined,
): CrossFieldRule[] | undefined => {
  if (!document || !regionNodeId) return undefined;
  const node = document.nodes[regionNodeId];
  if (!node) return undefined;
  const rules = node.props.crossFieldValidationRules;
  if (Array.isArray(rules)) {
    return rules.length > 0 ? rules as CrossFieldRule[] : undefined;
  }
  if (typeof rules === 'string' && rules.trim().length > 0) {
    try {
      const parsed = JSON.parse(rules) as unknown;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed as CrossFieldRule[] : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
};

export const setNestedPayloadValue = (
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void => {
  const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const next = cursor[segment];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }

  cursor[segments[segments.length - 1]] = value;
};

const readBindingParamValue = (
  context: Record<string, unknown> | null | undefined,
  dataPath: string,
): unknown => {
  if (dataPath.startsWith('static:')) {
    return dataPath.slice('static:'.length);
  }
  const segments = dataPath.split('.').map((segment) => segment.trim()).filter(Boolean);
  let cursor: unknown = context;
  for (const segment of segments) {
    if (cursor && typeof cursor === 'object' && segment in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return cursor;
};

export const resolveBindingTemplateValue = (
  template: string,
  context: Record<string, unknown> | null | undefined,
  paramPaths: Record<string, string>,
): string =>
  template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, paramName: string) => {
    const dataPath = paramPaths[paramName];
    if (!dataPath) {
      return '';
    }

    const cursor = readBindingParamValue(context, dataPath);
    return cursor === undefined || cursor === null ? '' : String(cursor);
  });

/**
 * Resolves path placeholders (`{name}`) then appends any leftover `paramPaths` entries as a real
 * query string — parity with `resolveHydrationTargetUrl` (Preview/canvas). Headers must keep using
 * `resolveBindingTemplateValue` only so unused params never become a `?…` suffix on header values.
 *
 * Bug found (API wizards follow-up): `buildDefaultRestOperations` generates REST-convention
 * detail/update/delete endpoints with `:id`-style path params (e.g. `/api/orders/:id`), but this
 * resolver only ever substituted `{id}`-style placeholders. Every published Auto Form / Auto CRUD
 * Edit or Detail region load (`regionDataSource` binding with `loadOperation: 'detail'`) therefore
 * requested the literal, unresolved `/api/orders/:id?id=123` instead of `/api/orders/123`. Now both
 * placeholder styles are substituted, matching `resolveOperationUrl` (Preview/canvas hydration) and
 * `resolveMutationRuntimeUrl` (callMutation/Delete), which already handled `:id` correctly.
 */
export const resolveBindingUrl = (
  endpointTemplate: string,
  context: Record<string, unknown> | null | undefined,
  paramPaths: Record<string, string>,
): string => {
  const usedParamNames = new Set<string>();
  let resolvedPath = endpointTemplate.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, paramName: string) => {
    usedParamNames.add(paramName);
    const dataPath = paramPaths[paramName];
    if (!dataPath) {
      return '';
    }
    const cursor = readBindingParamValue(context, dataPath);
    return cursor === undefined || cursor === null ? '' : String(cursor);
  });

  for (const [paramName, dataPath] of Object.entries(paramPaths)) {
    if (usedParamNames.has(paramName)) {
      continue;
    }
    const colonParamPattern = new RegExp(`:${paramName}(?=/|$)`, 'g');
    if (!colonParamPattern.test(resolvedPath)) {
      continue;
    }
    usedParamNames.add(paramName);
    const cursor = readBindingParamValue(context, dataPath);
    const text = cursor === undefined || cursor === null ? '' : String(cursor);
    resolvedPath = resolvedPath.replace(new RegExp(`:${paramName}(?=/|$)`, 'g'), text);
  }

  const leftoverParams: Record<string, string> = {};
  for (const [paramName, dataPath] of Object.entries(paramPaths)) {
    if (usedParamNames.has(paramName)) {
      continue;
    }
    leftoverParams[paramName] = dataPath;
  }
  const searchParams = buildBindingQuerySearchParams(
    leftoverParams,
    (dataPath) => readBindingParamValue(context, dataPath),
  );

  const queryString = searchParams.toString();
  if (!queryString) {
    return resolvedPath;
  }

  return resolvedPath.includes('?') ? `${resolvedPath}&${queryString}` : `${resolvedPath}?${queryString}`;
};

export const resolveBindingHeaders = (
  context: Record<string, unknown> | null | undefined,
  headerTemplates: Record<string, string>,
  paramPaths: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headerTemplates).map(([key, template]) => [
      key,
      resolveBindingTemplateValue(template, context, paramPaths),
    ]),
  );

export const applyPayloadFieldTransform = (
  value: FormDataEntryValue | null,
  transform?: PayloadFieldTransform,
): unknown => {
  const raw = value === null ? '' : String(value);

  switch (transform) {
    case 'number': {
      const trimmed = raw.trim();
      if (!trimmed) {
        return null;
      }
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }
    case 'boolean':
      return raw === 'true' || raw === '1' || raw === 'on';
    case 'nullableString':
      return raw.trim().length > 0 ? raw : null;
    case 'nullableBoolean': {
      const trimmed = raw.trim().toLowerCase();
      if (!trimmed) return null;
      if (trimmed === 'true' || trimmed === '1' || trimmed === 'on') return true;
      if (trimmed === 'false' || trimmed === '0' || trimmed === 'off') return false;
      return null;
    }
    case 'commaSeparatedArray':
      return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
    default:
      return raw;
  }
};

export const buildPayloadFromFormData = (
  formData: FormData,
  payloadMapping?: Record<string, string>,
  fieldTransforms?: Record<string, PayloadFieldTransform>,
): Record<string, unknown> => {
  if (!payloadMapping || Object.keys(payloadMapping).length === 0) {
    const payload: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      payload[key] = applyPayloadFieldTransform(value, fieldTransforms?.[key]);
    });
    return payload;
  }

  const payload: Record<string, unknown> = {};
  for (const [apiPath, formField] of Object.entries(payloadMapping)) {
    const transformed = applyPayloadFieldTransform(formData.get(formField), fieldTransforms?.[apiPath]);
    if (isNestedPayloadPath(apiPath)) {
      setNestedPayloadValue(payload, apiPath, transformed);
    } else {
      payload[apiPath] = transformed;
    }
  }

  return payload;
};

export const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      const message = record.message ?? record.error ?? record.detail;
      if (typeof message === 'string' && message.trim().length > 0) {
        return message.trim();
      }
    }
  } catch {
    // fall through to status text
  }

  return response.statusText || `Request failed (${response.status})`;
};

/** Session-aware fetch for preview/published designer runtime (401 → silent refresh). */
export const designerFetch: typeof fetch = (input, init) => apiFetch(input, init);

export type BindingMutationCallbacks = {
  onSubmittingChange?: (value: boolean) => void;
  onError?: (message: string | null) => void;
  onSuccess?: (response: Response) => void;
  onFieldValidationErrors?: (errors: Record<string, string>) => void;
  onLog?: (entry: {
    endpoint: string;
    method: string;
    ok: boolean;
    status?: number;
    errorMessage?: string;
  }) => void;
  patchStore?: (path: string, value: unknown) => void;
};

export const resolveStoreWriteValueFromEvent = (event: Event, targetEvent: string): unknown => {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  switch (targetEvent) {
    case 'onChange':
    case 'onBlur':
      return target?.value ?? '';
    case 'onClick':
      return true;
    case 'onPageChange': {
      const customValue = (event as unknown as { target?: { value?: unknown } })?.target?.value;
      if (typeof customValue === 'number' && Number.isFinite(customValue)) {
        return customValue;
      }
      if (typeof customValue === 'string' && customValue.trim().length > 0) {
        const parsed = Number.parseInt(customValue, 10);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    }
    case 'onSortChange': {
      const customValue = (event as unknown as { target?: { value?: unknown } })?.target?.value;
      if (customValue && typeof customValue === 'object') {
        return customValue;
      }
      return null;
    }
    case 'onTaskDrag':
    case 'onCardMove':
      return (event as unknown as { target?: { value?: unknown } })?.target?.value ?? null;
    default:
      return target?.value ?? null;
  }
};

export const executeDesignerMutation = async (
  binding: ResolvedEventBinding,
  bindingContext: Record<string, unknown>,
  body: Record<string, unknown>,
  callbacks: BindingMutationCallbacks = {},
): Promise<boolean> => {
  if (!binding.endpoint) {
    return false;
  }

  const url = resolveBindingUrl(binding.endpoint, bindingContext, binding.urlParams);
  const headers = {
    ...resolveBindingHeaders(bindingContext, binding.headers, binding.urlParams),
    'Content-Type': 'application/json',
  };

  callbacks.onSubmittingChange?.(true);
  callbacks.onError?.(null);

  try {
    const response = await designerFetch(url, {
      method: binding.actionType as DesignerBindingActionType,
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const message = await parseApiErrorMessage(response);
      callbacks.onError?.(message);
      callbacks.onLog?.({
        endpoint: url,
        method: binding.actionType,
        ok: false,
        status: response.status,
        errorMessage: message,
      });
      // Reject so Preview callers do not run success trueActions — matches Export's
      // `if (!response.ok) throw ...` in renderRegionSubmitFetchLines.
      throw Object.assign(new Error(message), { __designerHttpError: true as const });
    }

    const responseStorePath = binding.definition.responseStorePath?.trim();
    if (responseStorePath && callbacks.patchStore) {
      const responsePayload = await response.clone().json().catch(() => null);
      callbacks.patchStore(responseStorePath, responsePayload);
    }

    callbacks.onSuccess?.(response);
    callbacks.onLog?.({
      endpoint: url,
      method: binding.actionType,
      ok: true,
      status: response.status,
    });
    return true;
  } catch (mutationFailure) {
    const isHttpError = Boolean(
      mutationFailure
      && typeof mutationFailure === 'object'
      && '__designerHttpError' in mutationFailure
      && (mutationFailure as { __designerHttpError?: boolean }).__designerHttpError,
    );
    if (!isHttpError) {
      const message = mutationFailure instanceof Error ? mutationFailure.message : 'Request failed';
      callbacks.onError?.(message);
      callbacks.onLog?.({
        endpoint: binding.endpoint,
        method: binding.actionType,
        ok: false,
        errorMessage: message,
      });
    }
    throw mutationFailure instanceof Error ? mutationFailure : new Error('Request failed');
  } finally {
    callbacks.onSubmittingChange?.(false);
  }
};

const readRegionFormFieldValue = (field: Element): string => {
  if (field instanceof HTMLInputElement) {
    if (field.type === 'checkbox' || field.type === 'radio') {
      return field.checked ? 'true' : 'false';
    }

    return field.value;
  }

  if (field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    return field.value;
  }

  const value = field.getAttribute('value');
  return value ?? '';
};

const escapeFormFieldNameSelector = (formFieldName: string): string =>
  formFieldName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Modal footers use `form=` while fields may not be DOM descendants of the `<form>` — scan fallbacks. */
const AUXILIARY_REGION_FORM_FIELD_NAMES = [
  'logoContentClear',
  'logoContentType',
] as const;

export const enrichRegionSubmitFormData = (
  formData: FormData,
  fieldMappings: RegionFormFieldMapping[],
  submitRoot: HTMLFormElement | ParentNode,
): FormData => {
  const merged = new FormData();
  formData.forEach((value, key) => merged.set(key, value));

  const scopes: ParentNode[] = [submitRoot];
  if (typeof document !== 'undefined') {
    scopes.push(document);
  }

  const namesToCollect = [
    ...fieldMappings.map((mapping) => mapping.formFieldName),
    ...AUXILIARY_REGION_FORM_FIELD_NAMES,
  ];

  for (const formFieldName of namesToCollect) {
    if (merged.has(formFieldName)) {
      continue;
    }
    const selector = `[name="${escapeFormFieldNameSelector(formFieldName)}"]`;
    for (const scope of scopes) {
      const field = scope.querySelector?.(selector);
      if (field) {
        merged.set(formFieldName, readRegionFormFieldValue(field));
        break;
      }
    }
  }

  return merged;
};

export const collectRegionFormDataFromContainer = (
  container: ParentNode,
  formFieldNames: readonly string[],
): FormData => {
  const formData = new FormData();

  for (const formFieldName of formFieldNames) {
    const field = container.querySelector(`[name="${escapeFormFieldNameSelector(formFieldName)}"]`);
    if (!field) {
      continue;
    }

    formData.set(formFieldName, readRegionFormFieldValue(field));
  }

  return formData;
};

export const buildRegionSubmitPayload = (
  formData: FormData,
  fieldMappings: RegionFormFieldMapping[],
  fieldTransforms?: Record<string, PayloadFieldTransform>,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  const serverManagedColumns = new Set(['id', 'created_at', 'created_by', 'updated_at', 'updated_by']);

  for (const mapping of fieldMappings) {
    if (serverManagedColumns.has(mapping.column)) {
      continue;
    }

    if (!formData.has(mapping.formFieldName)) {
      continue;
    }

    const transform = mapping.payloadTransform ?? fieldTransforms?.[mapping.column];
    payload[mapping.column] = applyPayloadFieldTransform(
      formData.get(mapping.formFieldName),
      transform,
    );
  }
  return payload;
};

export const mergeAuxiliaryRegionSubmitPayload = (
  formData: FormData,
  payload: Record<string, unknown>,
): Record<string, unknown> => {
  const logoClear = formData.get('logoContentClear');
  if (logoClear === '1' || logoClear === 'true') {
    payload.logoContentClear = true;
  }
  return payload;
};

export const resolveRegionDmlMethod = (
  regionData: Record<string, unknown> | null | undefined,
  primaryKey?: string,
  updateMethod?: string,
): 'POST' | 'PUT' | 'PATCH' => {
  if (!primaryKey?.trim()) {
    return 'POST';
  }

  const pkValue = regionData?.[primaryKey.trim()];
  if (pkValue === undefined || pkValue === null) {
    return 'POST';
  }

  if (String(pkValue).length === 0) {
    return 'POST';
  }
  // See the matching fix + rationale in bindingRegionEngine.ts's resolveRegionDmlMethodExpression
  // (the Export/codegen twin of this function) — same hardcoded-'PUT' bug, same fix.
  return (updateMethod?.trim() as 'PUT' | 'PATCH' | undefined) || 'PUT';
};

/** Prefer hydrated region record; fall back to grid selection id for edit saves. */
export const resolveRegionDataForDml = (
  regionData: Record<string, unknown> | null | undefined,
  primaryKey: string | undefined,
  designerStore: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  const pk = primaryKey?.trim();
  if (!pk) {
    return regionData ?? undefined;
  }

  const pkValue = regionData?.[pk];
  if (pkValue !== undefined && pkValue !== null && String(pkValue).length > 0) {
    return regionData ?? undefined;
  }

  const selectionValue = readNestedContextValue(designerStore, `selection.${pk}`);
  if (selectionValue === undefined || selectionValue === null || String(selectionValue).length === 0) {
    return regionData ?? undefined;
  }

  return {
    ...(regionData ?? {}),
    [pk]: selectionValue,
  };
};

export const resolveRegionSubmitFormData = (
  submitRoot: HTMLFormElement | ParentNode,
  fieldMappings: RegionFormFieldMapping[],
): FormData => {
  const base = submitRoot instanceof HTMLFormElement
    ? new FormData(submitRoot)
    : collectRegionFormDataFromContainer(
      submitRoot,
      fieldMappings.map((mapping) => mapping.formFieldName),
    );
  return enrichRegionSubmitFormData(base, fieldMappings, submitRoot);
};

export const executeDesignerRegionSubmit = async (
  submitRoot: HTMLFormElement | ParentNode,
  binding: ResolvedEventBinding,
  bindingContext: Record<string, unknown>,
  callbacks: BindingMutationCallbacks = {},
  document?: DesignerDocument,
  designerStore: Record<string, unknown> = {},
): Promise<boolean> => {
  const plan = binding.regionSubmitPlan;
  if (!plan) {
    return false;
  }

  if (document) {
    const crossRules = resolveCrossFieldRules(document, plan.regionNodeId);
    const fieldErrors = validateRegionSubmitFields(submitRoot, plan.fieldMappings, document, designerStore, crossRules);
    if (Object.keys(fieldErrors).length > 0) {
      callbacks.onFieldValidationErrors?.(fieldErrors);
      return false;
    }
    callbacks.onFieldValidationErrors?.({});
  } else if (submitRoot instanceof HTMLFormElement && typeof submitRoot.reportValidity === 'function' && !submitRoot.reportValidity()) {
    return false;
  }

  const formData = resolveRegionSubmitFormData(submitRoot, plan.fieldMappings);
  const payload = buildRegionSubmitPayload(
    formData,
    plan.fieldMappings,
    binding.definition.payloadFieldTransforms,
  );
  mergeAuxiliaryRegionSubmitPayload(formData, payload);
  const regionDataRaw = bindingContext[plan.dataVar] as Record<string, unknown> | undefined;
  const regionData = resolveRegionDataForDml(regionDataRaw, plan.primaryKey, designerStore);
  const method = resolveRegionDmlMethod(regionData, plan.primaryKey, plan.updateMethod);
  const endpointTemplate = method === 'POST'
    ? (plan.createEndpoint ?? plan.endpoint)
    : (plan.updateEndpoint ?? plan.endpoint);
  const endpoint = resolveRegionDmlUrl(endpointTemplate, regionData, plan.primaryKey);

  return executeDesignerMutation(
    {
      ...binding,
      endpoint,
      actionType: method,
      urlParams: {},
      headers: {},
    },
    bindingContext,
    payload,
    callbacks,
  );
};

export const executeDesignerFormSubmit = async (
  event: { preventDefault: () => void; currentTarget: HTMLFormElement },
  binding: ResolvedEventBinding,
  bindingContext: Record<string, unknown>,
  callbacks: BindingMutationCallbacks = {},
  document?: DesignerDocument,
  designerStore: Record<string, unknown> = {},
): Promise<boolean> => {
  event.preventDefault();

  if (binding.regionSubmitPlan && document) {
    const crossRules = resolveCrossFieldRules(document, binding.regionSubmitPlan.regionNodeId);
    const fieldErrors = validateRegionSubmitFields(event.currentTarget, binding.regionSubmitPlan.fieldMappings, document, designerStore, crossRules);
    if (Object.keys(fieldErrors).length > 0) {
      callbacks.onFieldValidationErrors?.(fieldErrors);
      return false;
    }
    callbacks.onFieldValidationErrors?.({});
  } else if (typeof event.currentTarget.reportValidity === 'function' && !event.currentTarget.reportValidity()) {
    return false;
  }

  if (binding.storeWritePath) {
    callbacks.patchStore?.(binding.storeWritePath, true);
  }

  if (binding.regionSubmitPlan) {
    return executeDesignerRegionSubmit(event.currentTarget, binding, bindingContext, callbacks, document, designerStore);
  }

  if (!binding.endpoint) {
    return false;
  }

  const formData = new FormData(event.currentTarget);
  const payload = buildPayloadFromFormData(
    formData,
    binding.payloadMapping,
    binding.payloadFieldTransforms,
  );

  return executeDesignerMutation(binding, bindingContext, payload, callbacks);
};

export const executeDesignerValueMutation = async (
  event: { target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement },
  binding: ResolvedEventBinding,
  bindingContext: Record<string, unknown>,
  callbacks: BindingMutationCallbacks = {},
): Promise<boolean> => {
  if (binding.storeWritePath) {
    callbacks.patchStore?.(binding.storeWritePath, event.target.value);
  }

  if (!binding.endpoint) {
    return true;
  }

  return executeDesignerMutation(binding, bindingContext, { value: event.target.value }, callbacks);
};
