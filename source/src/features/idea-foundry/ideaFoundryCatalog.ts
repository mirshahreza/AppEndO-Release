import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  Bot,
  Brain,
  CheckCircle2,
  CircleDot,
  Cloud,
  Cpu,
  Flame,
  Hammer,
  Leaf,
  Lightbulb,
  Mountain,
  Package,
  Pencil,
  Rocket,
  Sparkles,
  Sun,
  Workflow,
  Zap,
} from 'lucide-react';
import { IDEA_WHOLE_PACKAGE_SECTION_KEY } from '../../shared/api/contracts/idea-foundry/types';
import type {
  CreateProductIdeaInput,
  IdeaImportance,
  IdeaMaturity,
  IdeaPackageHome,
  IdeaScale,
  IdeaTargetKind,
  IdeaTeamModel,
  ProductIdeaListItem,
  ProductIdeaRecord,
} from '../../shared/api/contracts/idea-foundry/types';
import { APP_SURFACE_BOX_TONE_CLASS, type AppSurfaceBoxTone } from '../../shared/ui/surfaceClasses';

export { DEFAULT_IDEA_ICON, resolveIdeaIconRef } from '../../shared/api/contracts/idea-foundry/types';

export type IdeaOptionCard = {
  value: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: AppSurfaceBoxTone;
};

export const IDEA_MATURITY_OPTIONS: readonly IdeaOptionCard[] = [
  {
    value: 'defining',
    title: 'Defining',
    description: 'The problem is still being named. Who it is for, why it hurts, and what a first slice would change are not settled. Nothing is being built yet — this is the brief.',
    icon: Pencil,
    tone: 'slate',
  },
  {
    value: 'cooking-idea',
    title: 'Cooking Idea',
    description: 'The idea is on the stove. Approaches, surfaces, and trade-offs are being worked through, and what does not belong is being dropped. Shape it here before production work starts.',
    icon: Flame,
    tone: 'amber',
  },
  {
    value: 'in-production',
    title: 'In Production',
    description: 'Build is underway. The package or slice is being implemented and wired, but it is not yet something operators or customers can run day to day.',
    icon: Hammer,
    tone: 'cyan',
  },
  {
    value: 'ready-to-use',
    title: 'Ready to Use',
    description: 'It is live. Operators or customers can use this as a package or as part of one. Remaining work is care and growth, not first delivery.',
    icon: CheckCircle2,
    tone: 'emerald',
  },
];

export const IDEA_MATURITY_LABEL: Record<IdeaMaturity, string> = {
  defining: 'Defining',
  'cooking-idea': 'Cooking Idea',
  'in-production': 'In Production',
  'ready-to-use': 'Ready to Use',
};

export const IDEA_IMPORTANCE_OPTIONS: readonly IdeaOptionCard[] = [
  {
    value: 'low',
    title: 'Low',
    description: 'Keep an eye on it. Do not stall other work.\nIt can wait if the board is already full.',
    icon: CircleDot,
    tone: 'slate',
  },
  {
    value: 'medium',
    title: 'Medium',
    description: 'Worth a dedicated slice this quarter.\nProtect a real slot, but do not drop other bets.',
    icon: Lightbulb,
    tone: 'cyan',
  },
  {
    value: 'high',
    title: 'High',
    description: 'Pulls people this cycle. Protect the time.\nOther work yields when this idea needs a hand.',
    icon: Flame,
    tone: 'amber',
  },
  {
    value: 'critical',
    title: 'Critical',
    description: 'Drop other work. This is the bet.\nIf it stalls, the rest of the board waits.',
    icon: Zap,
    tone: 'rose',
  },
];

export const IDEA_IMPORTANCE_LABEL: Record<IdeaImportance, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const IDEA_SCALE_OPTIONS: readonly IdeaOptionCard[] = [
  {
    value: 'spark',
    title: 'Spark',
    description: 'A thin slice. One person, a few days.\nEnough to prove the pitch, not a product line.',
    icon: Sparkles,
    tone: 'slate',
  },
  {
    value: 'small',
    title: 'Small',
    description: 'A contained slice a small team can finish.\nOne surface, a short path, a clear done.',
    icon: Leaf,
    tone: 'emerald',
  },
  {
    value: 'medium',
    title: 'Medium',
    description: 'A real package slice with several surfaces.\nFront office and back office both move.',
    icon: Mountain,
    tone: 'cyan',
  },
  {
    value: 'large',
    title: 'Large',
    description: 'A substantial package or a new vertical.\nSeveral teams will live in this idea.',
    icon: Rocket,
    tone: 'indigo',
  },
  {
    value: 'epic',
    title: 'Epic',
    description: 'A multi-team product line.\nThis is the bet that names a whole catalog row.',
    icon: Sun,
    tone: 'violet',
  },
];

export const IDEA_SCALE_LABEL: Record<IdeaScale, string> = {
  spark: 'Spark',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  epic: 'Epic',
};

export const IDEA_TARGET_KIND_OPTIONS: readonly IdeaOptionCard[] = [
  {
    value: 'new-package',
    title: 'New package',
    description: 'This idea is a package that does not exist yet.\nYou will name it later. Core Studio pages are out of scope — this is a vertical package of its own.',
    icon: Boxes,
    tone: 'indigo',
  },
  {
    value: 'existing-package',
    title: 'Existing package',
    description: 'This idea belongs to a package already in the catalog.\nPick that package below. The idea attaches to the whole package, not a Core Studio page.',
    icon: Package,
    tone: 'emerald',
  },
];

export const IDEA_TARGET_KIND_LABEL: Record<IdeaTargetKind, string> = {
  'existing-package': 'Existing package',
  'new-package': 'New package',
};

export const formatIdeaHomeLabel = (
  item: Pick<ProductIdeaListItem, 'targetKind' | 'packageTitle' | 'sectionKey' | 'sectionTitle'>,
): string => {
  if (item.targetKind !== 'existing-package') {
    return IDEA_TARGET_KIND_LABEL['new-package'];
  }
  const packageTitle = item.packageTitle?.trim() ?? '';
  const sectionTitle = item.sectionTitle?.trim() ?? '';
  const wholePackage = (item.sectionKey ?? '').trim() === IDEA_WHOLE_PACKAGE_SECTION_KEY
    || sectionTitle === 'Whole package';
  if (packageTitle && sectionTitle && !wholePackage) {
    return `${packageTitle} · ${sectionTitle}`;
  }
  return packageTitle || sectionTitle || IDEA_TARGET_KIND_LABEL['existing-package'];
};

export const homesFromPackageCatalog = (
  rows: ReadonlyArray<{ packageId: string; displayName: string }>,
): IdeaPackageHome[] => {
  const byId = new Map<string, IdeaPackageHome>();
  for (const row of rows) {
    const packageId = row.packageId.trim();
    if (!packageId || byId.has(packageId)) continue;
    byId.set(packageId, {
      packageId,
      displayName: row.displayName.trim() || packageId,
      icon: null,
      sections: [{ key: IDEA_WHOLE_PACKAGE_SECTION_KEY, title: 'Whole package' }],
    });
  }
  return [...byId.values()].sort((left, right) => left.displayName.localeCompare(right.displayName));
};

const IDEA_TONE_BAR_CLASS: Record<AppSurfaceBoxTone, string> = {
  slate: 'bg-slate-400',
  violet: 'bg-violet-500',
  cyan: 'bg-cyan-500',
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
};

export const ideaOptionTone = (
  options: readonly IdeaOptionCard[],
  value: string,
): AppSurfaceBoxTone => options.find((option) => option.value === value)?.tone ?? 'slate';

/** Chip chrome from the same tones as the wizard option cards. Visible at rest. */
export const ideaToneChipClass = (tone: AppSurfaceBoxTone): string => {
  const tokens = APP_SURFACE_BOX_TONE_CLASS[tone];
  return `border ${tokens.strip} ${tokens.title}`;
};

type MaturityChrome = {
  barClass: string;
  washClass: string;
  borderClass: string;
  badgeClass: string;
  titleClass: string;
};

/** Card body wash — one step lighter than option-card strip (`bg-*-50/70`). */
const IDEA_CARD_WASH_CLASS: Record<AppSurfaceBoxTone, string> = {
  slate: 'bg-slate-50/40',
  violet: 'bg-violet-50/35',
  cyan: 'bg-cyan-50/35',
  indigo: 'bg-indigo-50/35',
  emerald: 'bg-emerald-50/35',
  amber: 'bg-amber-50/35',
  rose: 'bg-rose-50/35',
};

const chromeFromTone = (tone: AppSurfaceBoxTone): MaturityChrome => {
  const tokens = APP_SURFACE_BOX_TONE_CLASS[tone];
  return {
    barClass: IDEA_TONE_BAR_CLASS[tone],
    washClass: IDEA_CARD_WASH_CLASS[tone],
    borderClass: tokens.shell,
    badgeClass: ideaToneChipClass(tone),
    titleClass: tokens.title,
  };
};

/** Hue follows stage. Large surfaces stay near-white; ink lives on the bar, badge, and border. */
export const IDEA_MATURITY_CHROME: Record<IdeaMaturity, MaturityChrome> = {
  defining: chromeFromTone('slate'),
  'cooking-idea': chromeFromTone('amber'),
  'in-production': chromeFromTone('cyan'),
  'ready-to-use': chromeFromTone('emerald'),
};

export type IdeaCardChrome = {
  barClass: string;
  barWidthClass: string;
  shellClass: string;
  titleClass: string;
  titleWeightClass: string;
  maturityChipClass: string;
  homeChipClass: string;
  importanceChipClass: string;
  scaleChipClass: string;
};

const CHIP_SIZE_CLASS = 'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider';

export const resolveIdeaCardChrome = (
  item: Pick<ProductIdeaListItem, 'maturity' | 'targetKind' | 'importance' | 'scale'>,
): IdeaCardChrome => {
  const maturityTone = ideaOptionTone(IDEA_MATURITY_OPTIONS, item.maturity);
  const homeTone = ideaOptionTone(IDEA_TARGET_KIND_OPTIONS, item.targetKind);
  const importanceTone = ideaOptionTone(IDEA_IMPORTANCE_OPTIONS, item.importance);
  const scaleTone = ideaOptionTone(IDEA_SCALE_OPTIONS, item.scale);
  const maturity = IDEA_MATURITY_CHROME[item.maturity] ?? chromeFromTone(maturityTone);
  return {
    barClass: maturity.barClass,
    barWidthClass: 'w-1',
    shellClass: `border ${maturity.borderClass} ${maturity.washClass}`.trim(),
    titleClass: maturity.titleClass,
    titleWeightClass: 'font-semibold',
    maturityChipClass: `${CHIP_SIZE_CLASS} ${ideaToneChipClass(maturityTone)}`,
    homeChipClass: `${CHIP_SIZE_CLASS} ${ideaToneChipClass(homeTone)}`,
    importanceChipClass: `${CHIP_SIZE_CLASS} ${ideaToneChipClass(importanceTone)}`,
    scaleChipClass: `${CHIP_SIZE_CLASS} ${ideaToneChipClass(scaleTone)}`,
  };
};

export const IDEA_SORT_VALUES = [
  'updatedAt',
  'title',
  'maturity',
  'importance',
  'scale',
  'createdAt',
] as const;
export type IdeaSortField = (typeof IDEA_SORT_VALUES)[number];
export type IdeaSortDirection = 'asc' | 'desc';

export const DEFAULT_IDEA_SORT: IdeaSortField = 'updatedAt';
export const DEFAULT_IDEA_SORT_DIRECTION: IdeaSortDirection = 'desc';

export const IDEA_SORT_OPTIONS: ReadonlyArray<{ value: IdeaSortField; label: string }> = [
  { value: 'updatedAt', label: 'Updated' },
  { value: 'title', label: 'Title' },
  { value: 'maturity', label: 'Stage' },
  { value: 'importance', label: 'Importance' },
  { value: 'scale', label: 'Scale' },
  { value: 'createdAt', label: 'Created' },
];

export const isIdeaSortField = (value: unknown): value is IdeaSortField =>
  typeof value === 'string' && (IDEA_SORT_VALUES as readonly string[]).includes(value);

export const isIdeaSortDirection = (value: unknown): value is IdeaSortDirection =>
  value === 'asc' || value === 'desc';

const IDEA_MATURITY_RANK: Record<IdeaMaturity, number> = {
  defining: 0,
  'cooking-idea': 1,
  'in-production': 2,
  'ready-to-use': 3,
};

const IDEA_IMPORTANCE_RANK: Record<IdeaImportance, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const IDEA_SCALE_RANK: Record<IdeaScale, number> = {
  spark: 0,
  small: 1,
  medium: 2,
  large: 3,
  epic: 4,
};

const compareBySortField = (
  left: ProductIdeaListItem,
  right: ProductIdeaListItem,
  sortBy: IdeaSortField,
): number => {
  switch (sortBy) {
    case 'title':
      return left.title.localeCompare(right.title);
    case 'maturity':
      return (IDEA_MATURITY_RANK[left.maturity] ?? 0) - (IDEA_MATURITY_RANK[right.maturity] ?? 0);
    case 'importance':
      return (IDEA_IMPORTANCE_RANK[left.importance] ?? 0) - (IDEA_IMPORTANCE_RANK[right.importance] ?? 0);
    case 'scale':
      return (IDEA_SCALE_RANK[left.scale] ?? 0) - (IDEA_SCALE_RANK[right.scale] ?? 0);
    case 'createdAt':
      return (left.createdAt ?? '').localeCompare(right.createdAt ?? '');
    default:
      return (left.updatedAt ?? '').localeCompare(right.updatedAt ?? '');
  }
};

export const compareIdeas = (
  left: ProductIdeaListItem,
  right: ProductIdeaListItem,
  sortBy: IdeaSortField,
  direction: IdeaSortDirection,
): number => {
  const ranked = compareBySortField(left, right, sortBy);
  if (ranked !== 0) {
    return direction === 'desc' ? -ranked : ranked;
  }
  const updated = (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '');
  if (updated !== 0) return updated;
  return left.title.localeCompare(right.title);
};

export const compareIdeasForHeatmap = (left: ProductIdeaListItem, right: ProductIdeaListItem): number => (
  compareIdeas(left, right, DEFAULT_IDEA_SORT, DEFAULT_IDEA_SORT_DIRECTION)
);

export type IdeaModelProviderChrome = {
  label: string;
  icon: LucideIcon;
  tone: AppSurfaceBoxTone;
};

const IDEA_PROVIDER_CHROME: Record<string, IdeaModelProviderChrome> = {
  'google-gemini': { label: 'Gemini', icon: Sparkles, tone: 'violet' },
  openai: { label: 'OpenAI', icon: Cpu, tone: 'emerald' },
  'azure-openai': { label: 'Azure OpenAI', icon: Cloud, tone: 'cyan' },
  anthropic: { label: 'Anthropic', icon: Brain, tone: 'amber' },
  ollama: { label: 'Ollama', icon: Bot, tone: 'slate' },
  'openai-compatible': { label: 'Compatible', icon: Workflow, tone: 'indigo' },
  openrouter: { label: 'OpenRouter', icon: Workflow, tone: 'indigo' },
};

/** First model is the lead. Promote `lead` to index 0; others keep order. */
export const withLeadModel = (
  models: readonly IdeaTeamModel[],
  lead: IdeaTeamModel,
): IdeaTeamModel[] => {
  const rest = models.filter((model) => model.id !== lead.id);
  return [lead, ...rest];
};

export const resolveIdeaModelProviderChrome = (
  model: Pick<IdeaTeamModel, 'provider' | 'providerLabel' | 'name'>,
): IdeaModelProviderChrome => {
  const provider = (model.provider ?? '').trim().toLowerCase();
  const known = IDEA_PROVIDER_CHROME[provider];
  const haystack = `${model.providerLabel ?? ''} ${model.name}`.toLowerCase();
  if (known) {
    return {
      ...known,
      label: model.providerLabel?.trim() || known.label,
    };
  }
  if (haystack.includes('gemini')) return IDEA_PROVIDER_CHROME['google-gemini'];
  if (haystack.includes('gpt') || haystack.includes('openai')) return IDEA_PROVIDER_CHROME.openai;
  if (haystack.includes('claude') || haystack.includes('anthropic')) return IDEA_PROVIDER_CHROME.anthropic;
  if (haystack.includes('llama') || haystack.includes('ollama')) return IDEA_PROVIDER_CHROME.ollama;
  return { label: model.providerLabel?.trim() || 'Model', icon: Bot, tone: 'slate' };
};

export const toIdeaWriteInput = (idea: ProductIdeaRecord): CreateProductIdeaInput | null => {
  if (!idea.decisionMaker || idea.models.length === 0) {
    return null;
  }
  return {
    title: idea.title,
    description: idea.description,
    icon: idea.icon,
    importance: idea.importance,
    scale: idea.scale,
    maturity: idea.maturity,
    targetKind: idea.targetKind,
    packageId: idea.packageId,
    packageTitle: idea.packageTitle,
    sectionKey: idea.sectionKey,
    sectionTitle: idea.sectionTitle,
    frontOffice: idea.frontOffice,
    backOffice: idea.backOffice,
    note: idea.note,
    decisionMaker: idea.decisionMaker,
    collaborators: idea.collaborators,
    models: idea.models,
  };
};
