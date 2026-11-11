/**
 * Voting package — Phase 2 (DATA_API edge definitions under /api/voting/*).
 *
 *   npm run voting:phase2
 *   npm run voting:phase2:rollback
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
import { VOTE_TABLE_NAMES } from '../voting-phase1';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const statePath = path.join(scriptDir, 'state.json');
const isRollback = process.argv.includes('--rollback');

const VOTING_API_SPECS = [
  { objectName: 'vote_votings', key: 'vote-votings', label: 'Voting scopes', basePath: '/api/voting/votings', publicCache: true },
  { objectName: 'vote_ballots', key: 'vote-ballots', label: 'Voting Ballots', basePath: '/api/voting/ballots', publicCache: true },
  { objectName: 'vote_candidates', key: 'vote-candidates', label: 'Voting Candidates', basePath: '/api/voting/candidates', publicCache: true },
  { objectName: 'vote_voter_registrations', key: 'vote-voter-registrations', label: 'Voting Voter Registrations', basePath: '/api/voting/voter-registrations', publicCache: false },
  { objectName: 'vote_polling_stations', key: 'vote-polling-stations', label: 'Voting Polling Stations', basePath: '/api/voting/polling-stations', publicCache: true },
  { objectName: 'vote_observers', key: 'vote-observers', label: 'Voting Observers', basePath: '/api/voting/observers', publicCache: false },
  { objectName: 'vote_cast_events', key: 'vote-cast-events', label: 'Voting Cast Events', basePath: '/api/voting/cast-events', publicCache: false },
  { objectName: 'vote_poll_questions', key: 'vote-poll-questions', label: 'Voting Poll Questions', basePath: '/api/voting/poll-questions', publicCache: true },
  { objectName: 'vote_poll_answers', key: 'vote-poll-answers', label: 'Voting Poll Answers', basePath: '/api/voting/poll-answers', publicCache: false },
] as const;

type Phase2State = {
  schema: string;
  definitionIds: string[];
  keys: string[];
  updatedAt: string;
};

const readState = (): Phase2State | null => {
  if (!fs.existsSync(statePath)) return null;
  return JSON.parse(fs.readFileSync(statePath, 'utf8')) as Phase2State;
};

const writeState = (state: Phase2State): void => {
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
};

const createApiService = (): EdgeApiService => {
  const getDataSources = () => getDataSourcesFromSettings(SETTINGS_PATH);
  return new EdgeApiService(new DataApiExecutor({ getDataSources }));
};

const resolveDefaultDataSource = () => {
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((item) => item.isDefault) ?? sources[0];
  if (!source) {
    throw new Error('Voting Phase 2 requires a default data source.');
  }
  return source;
};

const findVoteModelId = (dataSourceId: string, objectName: string): string => {
  const model = listEdgeModels().find(
    (item) => item.dataSourceId === dataSourceId && item.objectName === objectName,
  );
  if (!model) {
    throw new Error(`Voting edge model missing for ${objectName}. Run npm run voting:phase1 first.`);
  }
  return model.id;
};

const deleteVoteDefinitions = (api: EdgeApiService, ids: string[]): number => {
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

const install = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });

  const source = resolveDefaultDataSource();
  const dataSourceId = source.id;
  const api = createApiService();

  const prior = readState();
  const priorIds = new Set(prior?.definitionIds ?? []);
  for (const def of listEdgeApiDefinitions()) {
    if (priorIds.has(def.id) || VOTING_API_SPECS.some((spec) => spec.key === def.key)) {
      priorIds.add(def.id);
    }
  }
  if (priorIds.size > 0) {
    console.log('[Voting Phase 2] Cleaning previous Voting API definitions…');
    deleteVoteDefinitions(api, [...priorIds]);
  }

  for (const objectName of VOTE_TABLE_NAMES) {
    findVoteModelId(dataSourceId, objectName);
  }

  console.log('[Voting Phase 2] Creating + publishing DATA_API definitions…');
  const definitionIds: string[] = [];
  const keys: string[] = [];

  for (const spec of VOTING_API_SPECS) {
    const edgeModelId = findVoteModelId(dataSourceId, spec.objectName);
    const draft = api.createDefinition({
      edgeModelId,
      key: spec.key,
      label: spec.label,
      basePath: spec.basePath,
    });
    const published = api.publish(draft.id);
    definitionIds.push(published.id);
    keys.push(published.key);
    const ops = published.operations.filter((op) => op.enabled).map((op) => op.kind).join(', ');
    console.log(`  published ${published.key} → ${published.basePath} [${ops}]`);
  }

  writeState({
    schema: 'voting-phase2-state',
    definitionIds,
    keys,
    updatedAt: new Date().toISOString(),
  });

  console.log('[Voting Phase 2] Done.');
};

const rollback = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  const api = createApiService();
  const state = readState();
  const ids = new Set(state?.definitionIds ?? []);
  for (const def of listEdgeApiDefinitions()) {
    if (VOTING_API_SPECS.some((spec) => spec.key === def.key)) {
      ids.add(def.id);
    }
  }

  console.log('[Voting Phase 2 rollback] Removing Voting DATA_API definitions…');
  const removed = deleteVoteDefinitions(api, [...ids]);
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }
  console.log(`[Voting Phase 2 rollback] Done. removed=${removed}`);
};

const main = async (): Promise<void> => {
  if (isRollback) {
    await rollback();
    return;
  }
  await install();
};

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Voting Phase 2] failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
