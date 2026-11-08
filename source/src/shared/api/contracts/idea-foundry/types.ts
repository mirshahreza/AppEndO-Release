export const IDEA_MATURITY_VALUES = ['defining', 'cooking-idea', 'in-production', 'ready-to-use'] as const;
export type IdeaMaturity = (typeof IDEA_MATURITY_VALUES)[number];

export const IDEA_IMPORTANCE_VALUES = ['low', 'medium', 'high', 'critical'] as const;
export type IdeaImportance = (typeof IDEA_IMPORTANCE_VALUES)[number];

export const IDEA_SCALE_VALUES = ['spark', 'small', 'medium', 'large', 'epic'] as const;
export type IdeaScale = (typeof IDEA_SCALE_VALUES)[number];

export const IDEA_TARGET_KIND_VALUES = ['new-package', 'existing-package'] as const;
export type IdeaTargetKind = (typeof IDEA_TARGET_KIND_VALUES)[number];

/** Sentinel section when the idea spans the whole existing package. */
export const IDEA_WHOLE_PACKAGE_SECTION_KEY = 'whole-package';

export type IdeaPackageSection = {
  key: string;
  title: string;
};

export type IdeaPackageHome = {
  packageId: string;
  displayName: string;
  icon: string | null;
  sections: IdeaPackageSection[];
};

export type IdeaTeamPerson = {
  userId: number;
  displayName: string;
  username: string;
  avatarUrl: string | null;
};

export type IdeaTeamModel = {
  id: string;
  name: string;
  provider?: string | null;
  providerLabel?: string | null;
  modelId?: string | null;
  isDefault?: boolean;
};

export type ProductIdeaRecord = {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  importance: IdeaImportance;
  scale: IdeaScale;
  maturity: IdeaMaturity;
  targetKind: IdeaTargetKind;
  packageId: string | null;
  packageTitle: string | null;
  sectionKey: string | null;
  sectionTitle: string | null;
  frontOffice: string;
  backOffice: string;
  note: string | null;
  decisionMaker: IdeaTeamPerson | null;
  collaborators: IdeaTeamPerson[];
  models: IdeaTeamModel[];
  createdAt: string;
  createdBy: number | null;
  createdByUsername: string | null;
  updatedAt: string;
  updatedBy: number | null;
  updatedByUsername: string | null;
};

export type ProductIdeaListItem = ProductIdeaRecord;

export type CreateProductIdeaInput = {
  title: string;
  description: string;
  icon?: string | null;
  importance: IdeaImportance;
  scale: IdeaScale;
  maturity: IdeaMaturity;
  targetKind: IdeaTargetKind;
  packageId?: string | null;
  packageTitle?: string | null;
  sectionKey?: string | null;
  sectionTitle?: string | null;
  frontOffice: string;
  backOffice: string;
  note?: string | null;
  decisionMaker: IdeaTeamPerson;
  collaborators: IdeaTeamPerson[];
  models: IdeaTeamModel[];
};

const isMember = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (values as readonly string[]).includes(value);

export const isIdeaMaturity = (value: unknown): value is IdeaMaturity =>
  isMember(IDEA_MATURITY_VALUES, value);

export const isIdeaImportance = (value: unknown): value is IdeaImportance =>
  isMember(IDEA_IMPORTANCE_VALUES, value);

export const isIdeaScale = (value: unknown): value is IdeaScale =>
  isMember(IDEA_SCALE_VALUES, value);

export const isIdeaTargetKind = (value: unknown): value is IdeaTargetKind =>
  isMember(IDEA_TARGET_KIND_VALUES, value);

export const DEFAULT_IDEA_MATURITY: IdeaMaturity = 'defining';
export const DEFAULT_IDEA_IMPORTANCE: IdeaImportance = 'medium';
export const DEFAULT_IDEA_SCALE: IdeaScale = 'small';
export const DEFAULT_IDEA_TARGET_KIND: IdeaTargetKind = 'new-package';
export const DEFAULT_IDEA_ICON = 'lucide:Lightbulb';

export const resolveIdeaIconRef = (icon?: string | null): string => {
  const trimmed = icon?.trim() ?? '';
  return trimmed || DEFAULT_IDEA_ICON;
};

const asPositiveInt = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const asTrimmed = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
};

export const parseIdeaTeamPerson = (value: unknown): IdeaTeamPerson | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const userId = asPositiveInt(record.userId);
  const displayName = asTrimmed(record.displayName, 255);
  const username = asTrimmed(record.username, 128);
  if (!userId || !displayName || !username) return null;
  const avatarRaw = record.avatarUrl;
  const avatarUrl = typeof avatarRaw === 'string' && avatarRaw.trim() ? avatarRaw.trim() : null;
  return { userId, displayName, username, avatarUrl };
};

export const parseIdeaTeamPeople = (value: unknown): IdeaTeamPerson[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const people: IdeaTeamPerson[] = [];
  for (const item of value) {
    const person = parseIdeaTeamPerson(item);
    if (!person || seen.has(person.userId)) continue;
    seen.add(person.userId);
    people.push(person);
  }
  return people;
};

export const parseIdeaTeamModels = (value: unknown): IdeaTeamModel[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const models: IdeaTeamModel[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const id = asTrimmed(record.id, 128);
    const name = asTrimmed(record.name, 255);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    models.push({
      id,
      name,
      provider: asTrimmed(record.provider, 64),
      providerLabel: asTrimmed(record.providerLabel, 128),
      modelId: asTrimmed(record.modelId, 128),
    });
  }
  return models;
};

