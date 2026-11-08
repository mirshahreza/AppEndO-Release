import { randomUUID } from 'node:crypto';
import { QueryTypes } from 'sequelize';
import { HttpError } from '../../errors/HttpError';
import type {
  CreateProductIdeaInput,
  ProductIdeaListItem,
  ProductIdeaRecord,
} from '../../../shared/api/contracts/idea-foundry/types';
import {
  parseIdeaTeamModels,
  parseIdeaTeamPeople,
  parseIdeaTeamPerson,
} from '../../../shared/api/contracts/idea-foundry/types';
import { getControlPlaneSequelize } from '../../db/controlPlaneSequelize';
import { getProductIdeaModel, type ProductIdeaRow } from './ideaFoundrySequelizeModel';

const toIso = (value: Date | string | null | undefined): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value ?? '');
};

const asUserId = (value: unknown): number | null => {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const loadActorUsernamesByIdeaId = async (
  ideaIds: string[],
): Promise<Map<string, { createdByUsername: string | null; updatedByUsername: string | null }>> => {
  const ids = [...new Set(ideaIds.filter((id) => id.trim()))];
  if (ids.length === 0) {
    return new Map();
  }
  const placeholders = ids.map((_, index) => `:idea${index}`).join(', ');
  const replacements = Object.fromEntries(ids.map((id, index) => [`idea${index}`, id]));
  const rows = await getControlPlaneSequelize().query<{
    id: string;
    created_by_username?: string | null;
    updated_by_username?: string | null;
    createdByUsername?: string | null;
    updatedByUsername?: string | null;
  }>(
    `SELECT i.id,
            creator.username AS created_by_username,
            editor.username AS updated_by_username
     FROM base_product_ideas i
     LEFT JOIN base_users creator ON creator.id = i.created_by
     LEFT JOIN base_users editor ON editor.id = i.updated_by
     WHERE i.id IN (${placeholders})`,
    { replacements, type: QueryTypes.SELECT },
  );
  return new Map(rows.map((row) => {
    const created = String(row.created_by_username ?? row.createdByUsername ?? '').trim();
    const updated = String(row.updated_by_username ?? row.updatedByUsername ?? '').trim();
    return [String(row.id), {
      createdByUsername: created || null,
      updatedByUsername: updated || null,
    }];
  }));
};

const parseJson = (value: unknown): unknown => {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const stringifyJson = (value: unknown): string => JSON.stringify(value);

const mapRow = (row: ProductIdeaRow): Omit<ProductIdeaRecord, 'createdByUsername' | 'updatedByUsername'> => ({
  id: row.id,
  title: row.title,
  description: row.description,
  icon: row.icon?.trim() || null,
  importance: row.importance as ProductIdeaRecord['importance'],
  scale: row.scale as ProductIdeaRecord['scale'],
  maturity: row.maturity as ProductIdeaRecord['maturity'],
  targetKind: row.targetKind as ProductIdeaRecord['targetKind'],
  packageId: row.packageId,
  packageTitle: row.packageTitle,
  sectionKey: row.sectionKey,
  sectionTitle: row.sectionTitle,
  frontOffice: row.frontOffice ?? '',
  backOffice: row.backOffice ?? '',
  note: row.note,
  decisionMaker: parseIdeaTeamPerson(parseJson(row.decisionMaker)),
  collaborators: parseIdeaTeamPeople(parseJson(row.collaborators)),
  models: parseIdeaTeamModels(parseJson(row.teamModels)),
  createdAt: toIso(row.createdAt),
  createdBy: asUserId(row.createdBy),
  updatedAt: toIso(row.updatedAt),
  updatedBy: asUserId(row.updatedBy),
});

export async function listProductIdeas(): Promise<ProductIdeaListItem[]> {
  const rows = await getProductIdeaModel().findAll({
    order: [['updatedAt', 'DESC']],
  });
  const mapped = rows.map((row) => mapRow(row.get({ plain: true })));
  const usernames = await loadActorUsernamesByIdeaId(mapped.map((row) => row.id));
  return mapped.map((row) => {
    const names = usernames.get(row.id);
    return {
      ...row,
      createdByUsername: names?.createdByUsername ?? null,
      updatedByUsername: names?.updatedByUsername ?? null,
    };
  });
}

export async function createProductIdea(input: CreateProductIdeaInput & {
  actorUserId: number;
}): Promise<ProductIdeaRecord> {
  const now = new Date();
  const row = await getProductIdeaModel().create({
    id: randomUUID(),
    title: input.title,
    description: input.description,
    icon: input.icon ?? null,
    importance: input.importance,
    scale: input.scale,
    maturity: input.maturity,
    targetKind: input.targetKind,
    packageId: input.packageId ?? null,
    packageTitle: input.packageTitle ?? null,
    sectionKey: input.sectionKey ?? null,
    sectionTitle: input.sectionTitle ?? null,
    frontOffice: input.frontOffice,
    backOffice: input.backOffice,
    note: input.note ?? null,
    decisionMaker: stringifyJson(input.decisionMaker),
    collaborators: stringifyJson(input.collaborators),
    teamModels: stringifyJson(input.models),
    createdAt: now,
    createdBy: input.actorUserId,
    updatedAt: now,
    updatedBy: input.actorUserId,
  });
  const mapped = mapRow(row.get({ plain: true }));
  const names = (await loadActorUsernamesByIdeaId([mapped.id])).get(mapped.id);
  return {
    ...mapped,
    createdByUsername: names?.createdByUsername ?? null,
    updatedByUsername: names?.updatedByUsername ?? null,
  };
}

export async function getProductIdea(id: string): Promise<ProductIdeaRecord> {
  const row = await getProductIdeaModel().findByPk(id);
  if (!row) {
    throw new HttpError(404, 'Idea not found.');
  }
  const mapped = mapRow(row.get({ plain: true }));
  const names = (await loadActorUsernamesByIdeaId([mapped.id])).get(mapped.id);
  return {
    ...mapped,
    createdByUsername: names?.createdByUsername ?? null,
    updatedByUsername: names?.updatedByUsername ?? null,
  };
}

export async function updateProductIdea(input: CreateProductIdeaInput & {
  id: string;
  actorUserId: number;
}): Promise<ProductIdeaRecord> {
  const row = await getProductIdeaModel().findByPk(input.id);
  if (!row) {
    throw new HttpError(404, 'Idea not found.');
  }
  const now = new Date();
  await row.update({
    title: input.title,
    description: input.description,
    icon: input.icon ?? null,
    importance: input.importance,
    scale: input.scale,
    maturity: input.maturity,
    targetKind: input.targetKind,
    packageId: input.packageId ?? null,
    packageTitle: input.packageTitle ?? null,
    sectionKey: input.sectionKey ?? null,
    sectionTitle: input.sectionTitle ?? null,
    frontOffice: input.frontOffice,
    backOffice: input.backOffice,
    note: input.note ?? null,
    decisionMaker: stringifyJson(input.decisionMaker),
    collaborators: stringifyJson(input.collaborators),
    teamModels: stringifyJson(input.models),
    updatedAt: now,
    updatedBy: input.actorUserId,
  });
  await row.reload();
  const mapped = mapRow(row.get({ plain: true }));
  const names = (await loadActorUsernamesByIdeaId([mapped.id])).get(mapped.id);
  return {
    ...mapped,
    createdByUsername: names?.createdByUsername ?? null,
    updatedByUsername: names?.updatedByUsername ?? null,
  };
}

export type ProductIdeaSeedInput = CreateProductIdeaInput & {
  id?: string;
  actorUserId: number;
};

export async function replaceAllProductIdeas(rows: ProductIdeaSeedInput[]): Promise<number> {
  const model = getProductIdeaModel();
  await model.destroy({ where: {} });
  const now = new Date();
  if (rows.length === 0) {
    return 0;
  }
  await model.bulkCreate(rows.map((input) => ({
    id: input.id ?? randomUUID(),
    title: input.title,
    description: input.description,
    icon: input.icon ?? null,
    importance: input.importance,
    scale: input.scale,
    maturity: input.maturity,
    targetKind: input.targetKind,
    packageId: input.packageId ?? null,
    packageTitle: input.packageTitle ?? null,
    sectionKey: input.sectionKey ?? null,
    sectionTitle: input.sectionTitle ?? null,
    frontOffice: input.frontOffice,
    backOffice: input.backOffice,
    note: input.note ?? null,
    decisionMaker: stringifyJson(input.decisionMaker),
    collaborators: stringifyJson(input.collaborators),
    teamModels: stringifyJson(input.models),
    createdAt: now,
    createdBy: input.actorUserId,
    updatedAt: now,
    updatedBy: input.actorUserId,
  })));
  return rows.length;
}
