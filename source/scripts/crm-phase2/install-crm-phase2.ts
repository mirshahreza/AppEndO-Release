/**
 * CRM domain — Phase 2 (DATA_API CRUD + Edge domain actions on Sequelize).
 * v2: customer = base_users + base_user_profiles + `crm_customers` extension.
 *
 * Opt-in only. No Express mountCrmRoutes · no db.query · not part of bootstrap.
 *
 * Usage:
 *   npm run crm:phase2
 *   npm run crm:phase2:rollback
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import {
  ensureControlPlaneInitialized,
  resetControlPlaneInitState,
} from '../../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { DataApiExecutor } from '../../src/server/services/data-api/dataApiExecutor';
import { EdgeApiService } from '../../src/server/services/data-api/edgeApiService';
import { listEdgeModels } from '../../src/server/services/data-api/edgeModelStore';
import { listEdgeApiDefinitions } from '../../src/server/services/data-api/edgeApiStore';
import {
  buildManagedFunctionId,
  deleteManagedFunctionFromStore,
  DuplicateFunctionIdentityError,
  DuplicateFunctionPathError,
  insertManagedFunctionToStore,
  listManagedFunctionsFromStore,
  updateManagedFunctionInStore,
} from '../../src/core/functions/FunctionFileStore';
import { managedFunctionRouteRegistry } from '../../src/server/services/managedFunctionRouteRegistry';
import { EMPTY_FUNCTION_ACCESS_CONTROL } from '../../src/shared/api/contracts/server-functions/accessControl';
import { findRoleIdByName, insertRole } from '../../src/server/domain/users/roleRepository';
import { CRM_TABLE_NAMES } from '../crm-phase1';
import { findCrmBaseInfoItemId, findCrmBaseInfoCategoryId } from '../crm-phase1/seed/seedCrmBaseInfo';
import { buildCrmDomainActions } from './crmDomainActionSources';
import {
  CRM_ACTIVITIES_ENRICHMENTS,
  CRM_ACTIVITIES_SUMMARY_FIELDS,
  CRM_OPPORTUNITIES_ENRICHMENTS,
  CRM_OPPORTUNITIES_SUMMARY_FIELDS,
  CRM_TICKETS_ENRICHMENTS,
  CRM_TICKETS_SUMMARY_FIELDS,
  disableKinds,
  patchListEnrichments,
  stripStageFromWrites,
} from './crmApiProjection';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const statePath = path.join(scriptDir, 'state.json');
const isRollback = process.argv.includes('--rollback');

/** CRM customer/domain role — no dedicated SALES/SUPPORT role in v1 (see plan §شکل API). */
const CRM_CUSTOMER_ROLE_NAME = 'CUSTOMER';

/**
 * `crm_customers` has NO DATA_API definition at all — list AND every single-record op are
 * domain actions (list needs cross-table search on base_users/base_user_profiles that
 * DATA_API's generic search can't reach; single-record ops are keyed by user_id, not the
 * extension row's own id).
 */
const CRM_API_SPECS = [
  {
    objectName: 'crm_opportunities',
    key: 'crm-opportunities',
    label: 'CRM Opportunities',
    basePath: '/api/crm/opportunities',
    disableKinds: ['delete'] as const,
  },
  {
    objectName: 'crm_activities',
    key: 'crm-activities',
    label: 'CRM Activities',
    basePath: '/api/crm/activities',
    disableKinds: ['delete'] as const,
  },
  {
    objectName: 'crm_tickets',
    key: 'crm-tickets',
    label: 'CRM Tickets',
    basePath: '/api/crm/tickets',
    disableKinds: ['create', 'update', 'patch', 'delete'] as const,
  },
  {
    objectName: 'crm_opportunity_stage_history',
    key: 'crm-opportunity-stage-history',
    label: 'CRM Opportunity Stage History',
    basePath: '/api/crm/opportunity-stage-history',
    disableKinds: ['create', 'update', 'patch', 'delete'] as const,
  },
] as const;

const CRM_DOMAIN_FOLDER = 'crm-domain';

type Phase2State = {
  schema: 'crm-phase2-state';
  definitionIds: string[];
  keys: string[];
  domainFunctionIds: string[];
  updatedAt: string;
};

const readState = (): Phase2State | null => {
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8')) as Phase2State;
  } catch {
    return null;
  }
};

const writeState = (state: Phase2State): void => {
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
};

const createApiService = (): EdgeApiService => {
  const getDataSources = () => getDataSourcesFromSettings(SETTINGS_PATH);
  return new EdgeApiService(new DataApiExecutor({ getDataSources }));
};

const resolveDefaultPostgresSourceId = (): string => {
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((item) => item.isDefault) ?? sources[0];
  if (!source || source.type !== 'PostgreSQL') {
    throw new Error('CRM Phase 2 requires a default PostgreSQL data source.');
  }
  return source.id;
};

const findCrmModelId = (dataSourceId: string, objectName: string): string => {
  const model = listEdgeModels().find(
    (item) => item.dataSourceId === dataSourceId && item.objectName === objectName,
  );
  if (!model) {
    throw new Error(
      `CRM edge model missing for ${objectName}. Run npm run crm:phase1 first.`,
    );
  }
  return model.id;
};

const ensureCustomerRoleSeeded = async (actorId: number | null): Promise<void> => {
  const existing = await findRoleIdByName(CRM_CUSTOMER_ROLE_NAME);
  if (existing) {
    console.log(`  role "${CRM_CUSTOMER_ROLE_NAME}" already exists (id=${existing.id})`);
    return;
  }
  await insertRole(CRM_CUSTOMER_ROLE_NAME, 'CRM package — assigned to platform users who are customers.', actorId);
  console.log(`  role "${CRM_CUSTOMER_ROLE_NAME}" created`);
};

const deleteCrmDefinitions = (api: EdgeApiService, ids: string[]): number => {
  let removed = 0;
  for (const id of ids) {
    const existing = api.getDefinition(id);
    if (!existing) continue;
    try {
      if (existing.publishedAt) {
        api.unpublish(id);
      }
    } catch (error) {
      console.warn(`  warn: unpublish ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    api.delete(id);
    removed += 1;
    console.log(`  deleted definition ${existing.key} (${id})`);
  }
  return removed;
};

const deleteDomainFunctions = (ids: string[]): void => {
  for (const id of ids) {
    try {
      deleteManagedFunctionFromStore(id);
      console.log(`  deleted domain function ${id}`);
    } catch (error) {
      console.warn(`  warn: delete domain function ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};

const upsertDomainFunction = (input: {
  name: string;
  method: string;
  path: string;
  code: string;
}): string => {
  const functionId = buildManagedFunctionId(CRM_DOMAIN_FOLDER, input.name);
  const payload = {
    id: functionId,
    name: input.name,
    folder: CRM_DOMAIN_FOLDER,
    method: input.method,
    path: input.path,
    code: input.code,
    language: 'ts' as const,
    testPayload: '{}',
    runtimeVersion: 'v1',
    memoryLimit: 256,
    timeoutMs: 30_000,
    useGlobalConfig: true,
    enableLogs: true,
    cacheEnabled: false,
    cacheTtlMs: 60_000,
    cacheByParam: false,
    cacheByUser: false,
    engineType: 'SANDBOX_JS' as const,
    metadataJson: JSON.stringify({
      origin: 'edge-domain-action',
      package: 'crm',
      action: input.name,
    }),
    accessControl: {
      ...EMPTY_FUNCTION_ACCESS_CONTROL,
      accessMode: 'authenticated' as const,
    },
  };

  const removePathCollision = () => {
    for (const row of listManagedFunctionsFromStore()) {
      if (
        String(row.method || '').toUpperCase() === input.method.toUpperCase()
        && String(row.path || '') === input.path
        && String(row.id || '') !== functionId
      ) {
        deleteManagedFunctionFromStore(String(row.id));
      }
    }
  };

  try {
    insertManagedFunctionToStore(payload);
  } catch (error) {
    if (error instanceof DuplicateFunctionIdentityError) {
      updateManagedFunctionInStore(functionId, payload);
    } else if (error instanceof DuplicateFunctionPathError) {
      removePathCollision();
      try {
        insertManagedFunctionToStore(payload);
      } catch (inner) {
        if (inner instanceof DuplicateFunctionIdentityError) {
          updateManagedFunctionInStore(functionId, payload);
        } else {
          throw inner;
        }
      }
    } else {
      throw error;
    }
  }
  return functionId;
};

const patchDefinitionOperations = (
  api: EdgeApiService,
  definitionId: string,
  key: string,
  usersModelId: string,
  profilesModelId: string,
): void => {
  const current = api.getDefinition(definitionId);
  if (!current) return;

  let operations = current.operations.map((operation) => {
    const spec = CRM_API_SPECS.find((item) => item.key === key);
    let next = operation;
    if (spec?.disableKinds?.length) {
      next = disableKinds(next, spec.disableKinds);
    }

    if (key === 'crm-opportunities') {
      next = patchListEnrichments(next, {
        summaryFields: CRM_OPPORTUNITIES_SUMMARY_FIELDS,
        enrichments: CRM_OPPORTUNITIES_ENRICHMENTS(usersModelId, profilesModelId),
      });
      next = stripStageFromWrites(next);
    }
    if (key === 'crm-tickets') {
      next = patchListEnrichments(next, {
        summaryFields: CRM_TICKETS_SUMMARY_FIELDS,
        enrichments: CRM_TICKETS_ENRICHMENTS(usersModelId, profilesModelId),
      });
    }
    if (key === 'crm-activities') {
      next = patchListEnrichments(next, {
        summaryFields: CRM_ACTIVITIES_SUMMARY_FIELDS,
        enrichments: CRM_ACTIVITIES_ENRICHMENTS(usersModelId, profilesModelId),
      });
    }
    return next;
  });

  // Prefer PATCH over PUT for field updates (opportunities + activities) when both exist.
  const preferPatchKeys = new Set(['crm-opportunities', 'crm-activities']);
  operations = operations.map((operation) => {
    if (preferPatchKeys.has(key) && operation.kind === 'update') {
      return { ...operation, enabled: false };
    }
    if (preferPatchKeys.has(key) && operation.kind === 'patch') {
      return { ...operation, enabled: true, method: 'PATCH' as const };
    }
    return operation;
  });

  if (preferPatchKeys.has(key) && !operations.some((op) => op.kind === 'patch')) {
    const updateOp = operations.find((op) => op.kind === 'update');
    if (updateOp) {
      const patchOp = {
        ...updateOp,
        id: `op_patch_${Date.now().toString(36)}`,
        kind: 'patch' as const,
        method: 'PATCH' as const,
        enabled: true,
      };
      operations = [
        ...operations,
        key === 'crm-opportunities' ? stripStageFromWrites(patchOp) : patchOp,
      ];
    }
  }

  api.updateDefinition(definitionId, { operations });
};

const install = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  const dataSourceId = resolveDefaultPostgresSourceId();
  const api = createApiService();

  const prior = readState();
  const priorIds = new Set(prior?.definitionIds ?? []);
  for (const def of listEdgeApiDefinitions()) {
    if (priorIds.has(def.id) || CRM_API_SPECS.some((spec) => spec.key === def.key)) {
      priorIds.add(def.id);
    }
  }
  if (priorIds.size > 0) {
    console.log('[CRM Phase 2] Cleaning previous CRM API definitions…');
    deleteCrmDefinitions(api, [...priorIds]);
  }
  if (prior?.domainFunctionIds?.length) {
    console.log('[CRM Phase 2] Cleaning previous CRM domain actions…');
    deleteDomainFunctions(prior.domainFunctionIds);
  }

  for (const objectName of CRM_TABLE_NAMES) {
    findCrmModelId(dataSourceId, objectName);
  }

  const usersModelId = findCrmModelId(dataSourceId, 'base_users');
  const profilesModelId = findCrmModelId(dataSourceId, 'base_user_profiles');

  console.log('[CRM Phase 2] Seeding CUSTOMER role…');
  await ensureCustomerRoleSeeded(null);

  console.log('[CRM Phase 2] Creating + publishing DATA_API definitions…');
  const definitionIds: string[] = [];
  const keys: string[] = [];

  for (const spec of CRM_API_SPECS) {
    const edgeModelId = findCrmModelId(dataSourceId, spec.objectName);
    const draft = api.createDefinition({
      edgeModelId,
      key: spec.key,
      label: spec.label,
      basePath: spec.basePath,
    });
    patchDefinitionOperations(api, draft.id, spec.key, usersModelId, profilesModelId);
    const published = api.publish(draft.id);
    definitionIds.push(published.id);
    keys.push(published.key);
    const ops = published.operations.filter((op) => op.enabled).map((op) => `${op.method}:${op.kind}`).join(', ');
    console.log(`  published ${published.key} → ${published.basePath} [${ops}]`);
  }

  console.log('[CRM Phase 2] Resolving Base Info item ids…');
  const domainIds = {
    customersModelId: findCrmModelId(dataSourceId, 'crm_customers'),
    customerTagsModelId: findCrmModelId(dataSourceId, 'crm_customer_tags'),
    usersModelId,
    profilesModelId,
    baseInfoModelId: findCrmModelId(dataSourceId, 'base_info'),
    opportunitiesModelId: findCrmModelId(dataSourceId, 'crm_opportunities'),
    stageHistoryModelId: findCrmModelId(dataSourceId, 'crm_opportunity_stage_history'),
    activitiesModelId: findCrmModelId(dataSourceId, 'crm_activities'),
    ticketsModelId: findCrmModelId(dataSourceId, 'crm_tickets'),
    messagesModelId: findCrmModelId(dataSourceId, 'crm_ticket_messages'),
    pipelineStagesCategoryId: await findCrmBaseInfoCategoryId('Pipeline Stages'),
    lifecycleLeadId: await findCrmBaseInfoItemId('Lifecycle Stages', 'lead'),
    lifecycleLostId: await findCrmBaseInfoItemId('Lifecycle Stages', 'lost'),
    pipelineNewId: await findCrmBaseInfoItemId('Pipeline Stages', 'new'),
    pipelineWonId: await findCrmBaseInfoItemId('Pipeline Stages', 'won'),
    pipelineLostId: await findCrmBaseInfoItemId('Pipeline Stages', 'lost'),
    ticketStatusNewId: await findCrmBaseInfoItemId('Ticket Status', 'new'),
    ticketStatusOpenId: await findCrmBaseInfoItemId('Ticket Status', 'open'),
    ticketStatusResolvedId: await findCrmBaseInfoItemId('Ticket Status', 'resolved'),
    ticketStatusClosedId: await findCrmBaseInfoItemId('Ticket Status', 'closed'),
  };

  console.log('[CRM Phase 2] Publishing Edge domain actions…');
  const domainFunctionIds: string[] = [];
  for (const action of buildCrmDomainActions(domainIds)) {
    const id = upsertDomainFunction(action);
    domainFunctionIds.push(id);
    console.log(`  domain ${action.method} ${action.path} (${action.name})`);
  }

  managedFunctionRouteRegistry.invalidate();

  writeState({
    schema: 'crm-phase2-state',
    definitionIds,
    keys,
    domainFunctionIds,
    updatedAt: new Date().toISOString(),
  });

  console.log('[CRM Phase 2] Done.');
  console.log(`  DATA_API definitions: ${keys.join(', ')}`);
  console.log(`  domain actions: ${domainFunctionIds.length}`);
};

const rollback = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  const api = createApiService();
  const prior = readState();
  const ids = new Set(prior?.definitionIds ?? []);
  for (const def of listEdgeApiDefinitions()) {
    if (ids.has(def.id) || CRM_API_SPECS.some((spec) => spec.key === def.key)) {
      ids.add(def.id);
    }
  }

  console.log('[CRM Phase 2 rollback] Removing domain actions…');
  deleteDomainFunctions(prior?.domainFunctionIds ?? []);

  console.log('[CRM Phase 2 rollback] Removing DATA_API definitions…');
  deleteCrmDefinitions(api, [...ids]);
  managedFunctionRouteRegistry.invalidate();

  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }

  console.log('[CRM Phase 2 rollback] Done. Phase 1 tables/models + CUSTOMER role retained.');
};

const main = async () => {
  if (isRollback) {
    await rollback();
    return;
  }
  await install();
};

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[CRM Phase 2] failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
