import crypto from 'crypto';
import type { EdgeModelAssociation, EdgeModelDefinition } from '../../src/shared/api/contracts/data-api';
import type { EdgeModelService } from '../../src/server/services/data-api/edgeModelService';
import { listEdgeModels } from '../../src/server/services/data-api/edgeModelStore';
import { VOTE_TABLE_NAMES } from './index';

const associationId = () => `ea_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

const belongsTo = (
  targetModelId: string,
  foreignKey: string,
  as: string,
): EdgeModelAssociation => ({
  id: associationId(),
  kind: 'belongsTo',
  targetModelId,
  foreignKey,
  as,
  source: 'manual',
});

const hasMany = (
  targetModelId: string,
  foreignKey: string,
  as: string,
): EdgeModelAssociation => ({
  id: associationId(),
  kind: 'hasMany',
  targetModelId,
  foreignKey,
  as,
  source: 'manual',
});

const LEGACY_VOTE_TABLE_NAMES = ['vote_elections'] as const;

export const removeVoteEdgeModels = (edgeModelService: EdgeModelService): void => {
  const voteNames = new Set<string>([...VOTE_TABLE_NAMES, ...LEGACY_VOTE_TABLE_NAMES]);
  for (const model of listEdgeModels()) {
    if (voteNames.has(model.objectName)) {
      edgeModelService.deleteModel(model.id);
      console.log(`  removed edge model: ${model.objectName}`);
    }
  }
};

export const importVoteEdgeModels = async (
  edgeModelService: EdgeModelService,
  dataSourceId: string,
): Promise<Map<string, EdgeModelDefinition>> => {
  const modelsByName = new Map<string, EdgeModelDefinition>();

  for (const objectName of VOTE_TABLE_NAMES) {
    const existing = listEdgeModels().find(
      (item) => item.dataSourceId === dataSourceId && item.objectName === objectName,
    );
    const model = existing ?? await edgeModelService.importModel({
      dataSourceId,
      objectName,
      objectType: 'TABLE',
    });
    if (!existing) {
      console.log(`  imported edge model: ${objectName} (${model.id})`);
    }
    modelsByName.set(objectName, model);
  }

  let baseInfo = listEdgeModels().find(
    (item) => item.dataSourceId === dataSourceId && item.objectName === 'base_info',
  );
  if (!baseInfo) {
    baseInfo = await edgeModelService.importModel({
      dataSourceId,
      objectName: 'base_info',
      objectType: 'TABLE',
    });
  }

  let baseUsers = listEdgeModels().find(
    (item) => item.dataSourceId === dataSourceId && item.objectName === 'base_users',
  );
  if (!baseUsers) {
    baseUsers = await edgeModelService.importModel({
      dataSourceId,
      objectName: 'base_users',
      objectType: 'TABLE',
    });
  }

  const votings = modelsByName.get('vote_votings')!;
  const ballots = modelsByName.get('vote_ballots')!;
  const candidates = modelsByName.get('vote_candidates')!;
  const registrations = modelsByName.get('vote_voter_registrations')!;
  const stations = modelsByName.get('vote_polling_stations')!;
  const observers = modelsByName.get('vote_observers')!;
  const castEvents = modelsByName.get('vote_cast_events')!;
  const questions = modelsByName.get('vote_poll_questions')!;
  const answers = modelsByName.get('vote_poll_answers')!;

  await edgeModelService.updateModel(votings.id, {
    associations: [
      belongsTo(baseInfo.id, 'status_code', 'status'),
      belongsTo(baseUsers.id, 'created_by', 'createdByUser'),
      belongsTo(baseUsers.id, 'updated_by', 'updatedByUser'),
      hasMany(ballots.id, 'voting_id', 'ballots'),
      hasMany(candidates.id, 'voting_id', 'candidates'),
      hasMany(registrations.id, 'voting_id', 'registrations'),
      hasMany(stations.id, 'voting_id', 'stations'),
      hasMany(observers.id, 'voting_id', 'observers'),
      hasMany(castEvents.id, 'voting_id', 'castEvents'),
      hasMany(questions.id, 'voting_id', 'pollQuestions'),
    ],
  });

  await edgeModelService.updateModel(ballots.id, {
    associations: [
      belongsTo(votings.id, 'voting_id', 'voting'),
      belongsTo(baseInfo.id, 'ballot_type_code', 'ballotType'),
      belongsTo(baseInfo.id, 'status_code', 'status'),
      hasMany(candidates.id, 'ballot_id', 'candidates'),
      hasMany(castEvents.id, 'ballot_id', 'castEvents'),
    ],
  });

  await edgeModelService.updateModel(candidates.id, {
    associations: [
      belongsTo(votings.id, 'voting_id', 'voting'),
      belongsTo(ballots.id, 'ballot_id', 'ballot'),
      belongsTo(baseInfo.id, 'status_code', 'status'),
      hasMany(castEvents.id, 'candidate_id', 'castEvents'),
    ],
  });

  await edgeModelService.updateModel(registrations.id, {
    associations: [
      belongsTo(votings.id, 'voting_id', 'voting'),
      belongsTo(baseInfo.id, 'status_code', 'status'),
      hasMany(castEvents.id, 'voter_registration_id', 'castEvents'),
    ],
  });

  await edgeModelService.updateModel(stations.id, {
    associations: [
      belongsTo(votings.id, 'voting_id', 'voting'),
      hasMany(observers.id, 'station_id', 'observers'),
    ],
  });

  await edgeModelService.updateModel(observers.id, {
    associations: [
      belongsTo(votings.id, 'voting_id', 'voting'),
      belongsTo(stations.id, 'station_id', 'station'),
      belongsTo(baseInfo.id, 'role_code', 'role'),
    ],
  });

  await edgeModelService.updateModel(castEvents.id, {
    associations: [
      belongsTo(votings.id, 'voting_id', 'voting'),
      belongsTo(ballots.id, 'ballot_id', 'ballot'),
      belongsTo(candidates.id, 'candidate_id', 'candidate'),
      belongsTo(registrations.id, 'voter_registration_id', 'voterRegistration'),
      belongsTo(baseInfo.id, 'cast_channel_code', 'castChannel'),
      belongsTo(baseUsers.id, 'created_by', 'createdByUser'),
    ],
  });

  await edgeModelService.updateModel(questions.id, {
    associations: [
      belongsTo(votings.id, 'voting_id', 'voting'),
      belongsTo(baseInfo.id, 'status_code', 'status'),
      hasMany(answers.id, 'question_id', 'answers'),
    ],
  });

  await edgeModelService.updateModel(answers.id, {
    associations: [
      belongsTo(questions.id, 'question_id', 'question'),
      belongsTo(baseInfo.id, 'answer_code', 'answerCodeLov'),
    ],
  });

  return modelsByName;
};
