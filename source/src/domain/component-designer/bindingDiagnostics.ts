import {
  collectRegionFormFieldMappings,
  findAncestorDataRegion,
  getNodeRegionDataSourceBinding,
  getNodeRegionDataSourceRef,
  isDataRegionEligibleContainer,
  resolveRegionSubmitPlanForEvent,
} from './bindingRegionEngine';
import {
  getNodeGridListResourceRef,
  isDataGridNode,
} from './bindingGridEngine';
import { getDataSources } from './bindingRegistry';
import { sanitizeTrueActions } from './bindingDynamicActionsEngine';
import { dataSourceToResource, extractPathStyleParamNames, isCallMutationOperationFailure, resolveCallMutationOperation } from './bindingResourceModel';
import { isValidWorkflowDefinitionId } from './triggerWorkflowAction';
import type {
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerNode,
} from './types';

export type BindingDiagnosticSeverity = 'error' | 'warning' | 'info';

export type BindingDiagnosticIssue = {
  id: string;
  severity: BindingDiagnosticSeverity;
  message: string;
  nodeId?: string;
};

export type BindingHealthSummary = {
  connectedResourceId?: string;
  connectedResourceName?: string;
  loadEndpoint?: string;
  submitMethod?: string;
  submitEndpoint?: string;
  mappedFieldCount: number;
  totalFieldCount: number;
  issues: BindingDiagnosticIssue[];
};

/**
 * Surfaces unresolved `callMutation` operations (missing data source or named custom op)
 * as Diagnostics errors — never silently drop without an operator-visible signal.
 */
export const collectCallMutationDiagnostics = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): BindingDiagnosticIssue[] => {
  const issues: BindingDiagnosticIssue[] = [];

  for (const node of Object.values(document.nodes)) {
    for (const definition of Object.values(node.binding ?? {})) {
      for (const action of sanitizeTrueActions(definition?.trueActions)) {
        if (action.type !== 'callMutation') {
          continue;
        }

        const dataSourceRef = action.dataSourceRef?.trim() ?? '';
        if (!dataSourceRef) {
          issues.push({
            id: `call-mutation-missing-ref-${node.id}-${action.id}`,
            severity: 'error',
            message: 'Call Mutation action has no Data Source selected.',
            nodeId: node.id,
          });
          continue;
        }

        const dataSource = getDataSources(bindingDefinitions)[dataSourceRef];
        const resolved = resolveCallMutationOperation(dataSource, action.mutationOperation);
        if (isCallMutationOperationFailure(resolved)) {
          if (resolved.reason === 'missing-data-source') {
            issues.push({
              id: `call-mutation-missing-ds-${node.id}-${action.id}`,
              severity: 'error',
              message: `Call Mutation references missing Data Source "${dataSourceRef}".`,
              nodeId: node.id,
            });
          } else {
            const operationKey = resolved.operationKey;
            const isCustom = operationKey !== 'create' && operationKey !== 'update' && operationKey !== 'delete';
            issues.push({
              id: `call-mutation-missing-op-${node.id}-${action.id}`,
              severity: 'error',
              message: isCustom
                ? `Call Mutation operation "${operationKey}" was not found under Data Source "${dataSourceRef}" operations.custom.`
                : `Call Mutation operation "${operationKey}" is not configured on Data Source "${dataSourceRef}".`,
              nodeId: node.id,
            });
          }
        }
      }
    }
  }

  return issues;
};

/**
 * Surfaces invalid / missing `triggerWorkflow` definition ids as Diagnostics errors —
 * independent of whether the Workflow feature is enabled at runtime (never silent).
 */
export const collectTriggerWorkflowDiagnostics = (
  document: DesignerDocument,
): BindingDiagnosticIssue[] => {
  const issues: BindingDiagnosticIssue[] = [];

  for (const node of Object.values(document.nodes)) {
    for (const definition of Object.values(node.binding ?? {})) {
      for (const action of sanitizeTrueActions(definition?.trueActions)) {
        if (action.type !== 'triggerWorkflow') {
          continue;
        }

        const workflowDefinitionId = action.workflowDefinitionId?.trim() ?? '';
        if (!workflowDefinitionId) {
          issues.push({
            id: `trigger-workflow-missing-id-${node.id}-${action.id}`,
            severity: 'error',
            message: 'Trigger Workflow action has no Workflow Definition ID.',
            nodeId: node.id,
          });
          continue;
        }

        if (!isValidWorkflowDefinitionId(workflowDefinitionId)) {
          issues.push({
            id: `trigger-workflow-invalid-id-${node.id}-${action.id}`,
            severity: 'error',
            message: `Trigger Workflow Definition ID "${workflowDefinitionId}" is invalid — use a positive integer id.`,
            nodeId: node.id,
          });
        }
      }
    }
  }

  return issues;
};

const countRegionMappableFields = (
  document: DesignerDocument,
  regionNodeId: string,
  bindingDefinitions: DesignerBindingDefinitions,
): { mapped: number; total: number } => {
  const mappings = collectRegionFormFieldMappings(document, regionNodeId, bindingDefinitions);
  const dataSourceRef = getNodeRegionDataSourceRef(document.nodes[regionNodeId] ?? { binding: {} } as DesignerNode);
  const dataSource = dataSourceRef ? getDataSources(bindingDefinitions)[dataSourceRef] : undefined;
  const total = dataSource?.fields.length ?? mappings.length;

  return {
    mapped: mappings.length,
    total: Math.max(total, mappings.length),
  };
};

export const collectNodeBindingHealth = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  nodeId: string,
): BindingHealthSummary => {
  const issues: BindingDiagnosticIssue[] = [];
  const node = document.nodes[nodeId];

  if (!node) {
    return { mappedFieldCount: 0, totalFieldCount: 0, issues };
  }

  if (isDataGridNode(node)) {
    const gridResourceRef = getNodeGridListResourceRef(node);
    if (!gridResourceRef) {
      issues.push({
        id: 'grid-no-resource',
        severity: 'info',
        message: 'Grid is not bound to a list resource. Rows use manual binding or preview mock data.',
        nodeId,
      });
      return { mappedFieldCount: 0, totalFieldCount: 0, issues };
    }

    const dataSource = getDataSources(bindingDefinitions)[gridResourceRef];
    if (!dataSource) {
      issues.push({
        id: 'grid-missing-resource',
        severity: 'error',
        message: `Grid list resource "${gridResourceRef}" was not found.`,
        nodeId,
      });
      return { mappedFieldCount: 0, totalFieldCount: 0, issues };
    }

    const resource = dataSourceToResource(dataSource);
    const listEndpoint = resource.operations.list?.endpoint?.trim() ?? dataSource.endpoint.trim();
    if (!listEndpoint) {
      issues.push({
        id: 'grid-missing-list-endpoint',
        severity: 'error',
        message: 'List endpoint is not configured on the bound resource.',
        nodeId,
      });
    }

    return {
      connectedResourceId: gridResourceRef,
      connectedResourceName: dataSource.name,
      loadEndpoint: listEndpoint,
      mappedFieldCount: 0,
      totalFieldCount: dataSource.fields.length,
      issues,
    };
  }

  const regionContext = isDataRegionEligibleContainer(node)
    ? { regionNode: node, dataSourceRef: getNodeRegionDataSourceRef(node) }
    : findAncestorDataRegion(document, nodeId);

  if (!regionContext?.dataSourceRef) {
    return { mappedFieldCount: 0, totalFieldCount: 0, issues };
  }

  const dataSource = getDataSources(bindingDefinitions)[regionContext.dataSourceRef];
  const resource = dataSource ? dataSourceToResource(dataSource) : undefined;
  const fieldCounts = countRegionMappableFields(document, regionContext.regionNode.id, bindingDefinitions);

  if (!dataSource) {
    issues.push({
      id: 'missing-resource',
      severity: 'error',
      message: `Connected resource "${regionContext.dataSourceRef}" was not found in the document registry.`,
      nodeId: regionContext.regionNode.id,
    });
  } else if (!dataSource.endpoint.trim()) {
    issues.push({
      id: 'missing-endpoint',
      severity: 'error',
      message: 'Resource endpoint is empty. Configure a base API path on the resource.',
      nodeId: regionContext.regionNode.id,
    });
  }

  const regionBinding = getNodeRegionDataSourceBinding(regionContext.regionNode);
  if (dataSource && (regionBinding?.loadOperation ?? 'detail') === 'detail') {
    const detailEndpoint = resource?.operations.detail?.endpoint ?? dataSource.endpoint;
    const pathParams = extractPathStyleParamNames(detailEndpoint);
    const urlParams = regionBinding?.urlParams ?? {};
    const missingParams = pathParams.filter((param) => !urlParams[param]?.trim());
    if (pathParams.length > 0 && missingParams.length > 0) {
      issues.push({
        id: 'missing-detail-url-params',
        severity: 'warning',
        message: `Detail load is missing URL parameter mapping for: ${missingParams.join(', ')}.`,
        nodeId: regionContext.regionNode.id,
      });
    }
  }

  if (dataSource && fieldCounts.mapped === 0 && dataSource.fields.length > 0) {
    issues.push({
      id: 'no-field-mappings',
      severity: 'warning',
      message: 'No child fields are mapped to record columns yet.',
      nodeId: regionContext.regionNode.id,
    });
  }

  if (dataSource && fieldCounts.mapped < dataSource.fields.length) {
    const unmapped = dataSource.fields.length - fieldCounts.mapped;
    if (unmapped > 0) {
      issues.push({
        id: 'partial-field-mappings',
        severity: 'info',
        message: `${unmapped} resource field${unmapped === 1 ? '' : 's'} not mapped to any input.`,
        nodeId: regionContext.regionNode.id,
      });
    }
  }

  const submitPlan = resolveRegionSubmitPlanForEvent(document, nodeId, bindingDefinitions);

  if (dataSource && fieldCounts.mapped > 0 && !dataSource.primaryKey?.trim()) {
    const hasSubmitPlan = Boolean(submitPlan);
    if (hasSubmitPlan) {
      issues.push({
        id: 'missing-primary-key',
        severity: 'info',
        message: 'No primary key — submit will always use POST (create). Add a primary key for edit/update.',
        nodeId: regionContext.regionNode.id,
      });
    }
  }

  return {
    connectedResourceId: regionContext.dataSourceRef,
    connectedResourceName: dataSource?.name ?? regionContext.dataSourceRef,
    loadEndpoint: resource?.operations.detail?.endpoint ?? dataSource?.endpoint,
    submitMethod: submitPlan ? (dataSource?.primaryKey ? 'PUT / POST (auto)' : 'POST') : undefined,
    submitEndpoint: submitPlan?.endpoint ?? resource?.operations.create?.endpoint,
    mappedFieldCount: fieldCounts.mapped,
    totalFieldCount: fieldCounts.total,
    issues,
  };
};

const collectDocumentBindingHealth = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): BindingHealthSummary => {
  const issues: BindingDiagnosticIssue[] = [];
  let mappedFieldCount = 0;
  let totalFieldCount = 0;
  let connectedResourceId: string | undefined;
  let connectedResourceName: string | undefined;
  let loadEndpoint: string | undefined;
  let submitEndpoint: string | undefined;
  let submitMethod: string | undefined;

  for (const node of Object.values(document.nodes)) {
    if (!isDataRegionEligibleContainer(node)) {
      continue;
    }

    const health = collectNodeBindingHealth(document, bindingDefinitions, node.id);
    mappedFieldCount += health.mappedFieldCount;
    totalFieldCount += health.totalFieldCount;
    issues.push(...health.issues);

    if (health.connectedResourceId) {
      connectedResourceId = health.connectedResourceId;
      connectedResourceName = health.connectedResourceName;
      loadEndpoint = health.loadEndpoint;
      submitEndpoint = health.submitEndpoint;
      submitMethod = health.submitMethod;
    }
  }

  issues.push(...collectCallMutationDiagnostics(document, bindingDefinitions));
  issues.push(...collectTriggerWorkflowDiagnostics(document));

  const dataSources = Object.values(getDataSources(bindingDefinitions));
  for (const dataSource of dataSources) {
    if (!dataSource.endpoint.trim()) {
      issues.push({
        id: `resource-endpoint-${dataSource.id}`,
        severity: 'warning',
        message: `Resource "${dataSource.name}" has no endpoint configured.`,
      });
    }

    if (dataSource.fields.length === 0) {
      issues.push({
        id: `resource-fields-${dataSource.id}`,
        severity: 'info',
        message: `Resource "${dataSource.name}" has no fields defined.`,
      });
    }
  }

  return {
    connectedResourceId,
    connectedResourceName,
    loadEndpoint,
    submitMethod,
    submitEndpoint,
    mappedFieldCount,
    totalFieldCount,
    issues,
  };
};

export const collectRegionBindingHealth = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  regionNode: DesignerNode,
): BindingHealthSummary => collectNodeBindingHealth(document, bindingDefinitions, regionNode.id);
