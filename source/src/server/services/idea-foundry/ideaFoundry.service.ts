import { HttpError } from '../../errors/HttpError';
import type {
  CreateProductIdeaInput,
  IdeaPackageHome,
  IdeaTeamPerson,
  ProductIdeaRecord,
} from '../../../shared/api/contracts/idea-foundry/types';
import {
  DEFAULT_IDEA_IMPORTANCE,
  DEFAULT_IDEA_MATURITY,
  DEFAULT_IDEA_SCALE,
  DEFAULT_IDEA_TARGET_KIND,
  isIdeaImportance,
  isIdeaScale,
  isIdeaTargetKind,
  parseIdeaTeamModels,
  parseIdeaTeamPeople,
  parseIdeaTeamPerson,
  resolveIdeaIconRef,
} from '../../../shared/api/contracts/idea-foundry/types';
import { createProductIdea, getProductIdea, listProductIdeas, updateProductIdea } from '../../domain/idea-foundry/ideaFoundryRepository';
import {
  findIdeaPackageHome,
  findIdeaPackageSection,
  listIdeaPackageHomes,
} from '../../domain/idea-foundry/ideaFoundryHomes';
import { loadIdeaTeamPeopleByIds } from '../../domain/idea-foundry/ideaFoundryTeam';
import type { ActorContext } from '../../types/requestContext';

const requireActor = (actor: ActorContext): number => {
  if (!actor.userId) {
    throw new HttpError(401, 'Authentication required.');
  }
  return actor.userId;
};

const optionalText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new HttpError(400, `Value must be ${maxLength} characters or fewer.`);
  }
  return trimmed;
};

const parseWritePayload = (
  payload: Record<string, unknown>,
  homes: IdeaPackageHome[],
  options?: { maturity?: CreateProductIdeaInput['maturity'] },
): Omit<CreateProductIdeaInput, 'decisionMaker' | 'collaborators'> & {
  decisionMakerDraft: IdeaTeamPerson | null;
  collaboratorDraft: IdeaTeamPerson[];
} => {
  const title = String(payload.title ?? '').trim();
  if (!title) {
    throw new HttpError(400, 'Title is required.');
  }
  if (title.length > 255) {
    throw new HttpError(400, 'Title must be 255 characters or fewer.');
  }
  const description = String(payload.description ?? '').trim();
  if (!description) {
    throw new HttpError(400, 'Description is required.');
  }
  const frontOffice = String(payload.frontOffice ?? '').trim();
  if (!frontOffice) {
    throw new HttpError(400, 'Front office is required.');
  }
  const backOffice = String(payload.backOffice ?? '').trim();
  if (!backOffice) {
    throw new HttpError(400, 'Back office is required.');
  }
  // Create always starts at Defining. Reconfigure keeps the idea's current stage.
  const maturity = options?.maturity ?? DEFAULT_IDEA_MATURITY;
  const importance = payload.importance ?? DEFAULT_IDEA_IMPORTANCE;
  if (!isIdeaImportance(importance)) {
    throw new HttpError(400, 'Importance is invalid.');
  }
  const scale = payload.scale ?? DEFAULT_IDEA_SCALE;
  if (!isIdeaScale(scale)) {
    throw new HttpError(400, 'Scale is invalid.');
  }
  const targetKind = payload.targetKind ?? DEFAULT_IDEA_TARGET_KIND;
  if (!isIdeaTargetKind(targetKind)) {
    throw new HttpError(400, 'Domain is invalid.');
  }

  const noteRaw = payload.note;
  const note = typeof noteRaw === 'string' ? noteRaw.trim() : '';
  const models = parseIdeaTeamModels(payload.models);
  if (models.length === 0) {
    throw new HttpError(400, 'Choose at least one model.');
  }
  const iconDraft = optionalText(payload.icon, 128);

  const base = {
    title,
    description,
    importance,
    scale,
    maturity,
    targetKind,
    frontOffice,
    backOffice,
    note: note.length > 0 ? note : null,
    models,
    decisionMakerDraft: parseIdeaTeamPerson(payload.decisionMaker),
    collaboratorDraft: parseIdeaTeamPeople(payload.collaborators),
  };

  if (targetKind !== 'existing-package') {
    return {
      ...base,
      icon: resolveIdeaIconRef(iconDraft),
      packageId: null,
      packageTitle: null,
      sectionKey: null,
      sectionTitle: null,
    };
  }

  const packageId = optionalText(payload.packageId, 128);
  if (!packageId) {
    throw new HttpError(400, 'Choose an existing package.');
  }
  const home = findIdeaPackageHome(packageId, homes);
  if (!home) {
    throw new HttpError(400, 'Unknown package. Idea Foundry only takes package ideas, not Core Studio.');
  }
  const sectionKey = optionalText(payload.sectionKey, 128);
  if (!sectionKey) {
    throw new HttpError(400, 'Choose which section of the package this idea belongs to.');
  }
  const section = findIdeaPackageSection(home, sectionKey);
  if (!section) {
    throw new HttpError(400, 'Unknown package section. Core Studio pages are out of scope.');
  }

  return {
    ...base,
    icon: resolveIdeaIconRef(home.icon),
    packageId: home.packageId,
    packageTitle: home.displayName,
    sectionKey: section.key,
    sectionTitle: section.title,
  };
};

const resolveTeam = async (
  actorUserId: number,
  decisionMakerDraft: IdeaTeamPerson | null,
  collaboratorDraft: IdeaTeamPerson[],
): Promise<{ decisionMaker: IdeaTeamPerson; collaborators: IdeaTeamPerson[] }> => {
  const decisionMakerUserId = decisionMakerDraft?.userId ?? actorUserId;
  const collaboratorIds = collaboratorDraft
    .map((person) => person.userId)
    .filter((id) => id !== decisionMakerUserId);
  const people = await loadIdeaTeamPeopleByIds([decisionMakerUserId, ...collaboratorIds]);
  const decisionMaker = people.get(decisionMakerUserId);
  if (!decisionMaker) {
    throw new HttpError(400, 'Choose who makes the final decision.');
  }
  const collaborators = collaboratorIds.map((id) => {
    const person = people.get(id);
    if (!person) {
      throw new HttpError(400, 'One of the collaborators is not a known user.');
    }
    return person;
  });
  return { decisionMaker, collaborators };
};

const withLivePackageIcon = (
  item: ProductIdeaRecord,
  homes: IdeaPackageHome[],
): ProductIdeaRecord => {
  if (item.targetKind !== 'existing-package' || !item.packageId) {
    return { ...item, icon: resolveIdeaIconRef(item.icon) };
  }
  const home = findIdeaPackageHome(item.packageId, homes);
  return { ...item, icon: resolveIdeaIconRef(home?.icon ?? item.icon) };
};

export class IdeaFoundryService {
  async list(actor: ActorContext) {
    requireActor(actor);
    const homes = listIdeaPackageHomes();
    const items = await listProductIdeas();
    return items.map((item) => withLivePackageIcon(item, homes));
  }

  async get(actor: ActorContext, id: string) {
    requireActor(actor);
    const ideaId = id.trim();
    if (!ideaId) {
      throw new HttpError(404, 'Idea not found.');
    }
    const homes = listIdeaPackageHomes();
    return withLivePackageIcon(await getProductIdea(ideaId), homes);
  }

  async listHomes(actor: ActorContext): Promise<IdeaPackageHome[]> {
    requireActor(actor);
    return listIdeaPackageHomes();
  }

  async create(actor: ActorContext, payload: Record<string, unknown>): Promise<ProductIdeaRecord> {
    const actorUserId = requireActor(actor);
    const homes = listIdeaPackageHomes();
    const parsed = parseWritePayload(payload, homes);
    const team = await resolveTeam(actorUserId, parsed.decisionMakerDraft, parsed.collaboratorDraft);
    const { decisionMakerDraft: _draft, collaboratorDraft: _collab, ...rest } = parsed;
    return createProductIdea({
      ...rest,
      ...team,
      actorUserId,
    });
  }

  async update(actor: ActorContext, id: string, payload: Record<string, unknown>): Promise<ProductIdeaRecord> {
    const actorUserId = requireActor(actor);
    const ideaId = id.trim();
    if (!ideaId) {
      throw new HttpError(404, 'Idea not found.');
    }
    const existing = await getProductIdea(ideaId);
    const homes = listIdeaPackageHomes();
    const parsed = parseWritePayload(payload, homes, { maturity: existing.maturity });
    const team = await resolveTeam(actorUserId, parsed.decisionMakerDraft, parsed.collaboratorDraft);
    const { decisionMakerDraft: _draft, collaboratorDraft: _collab, ...rest } = parsed;
    return withLivePackageIcon(await updateProductIdea({
      ...rest,
      ...team,
      id: existing.id,
      actorUserId,
    }), homes);
  }
}

let singleton: IdeaFoundryService | undefined;

export const getIdeaFoundryService = (): IdeaFoundryService => {
  if (!singleton) {
    singleton = new IdeaFoundryService();
  }
  return singleton;
};
