import type { IAiProvider } from '../IAiProvider';
import { logger } from '../../logging/Logger';
import type { TurnExecutionProfile } from './turnExecutionProfile';

export type PromptTaskDecomposition = {
  summary: string;
  workUnits: string[];
  assumptions?: string[];
  openQuestions?: string[];
};

export const PROMPT_TASK_DECOMPOSITION_SYSTEM = [
  'You are a senior software engineer and requirements analyst for the AppEndO admin platform.',
  'Decompose user requests into the smallest actionable, verifiable work units BEFORE any implementation.',
  'Respond with JSON only (no markdown fences):',
  '{',
  '  "summary": "one-sentence goal restatement",',
  '  "workUnits": ["ordered atomic task", "..."],',
  '  "assumptions": ["non-blocking assumptions"],',
  '  "openQuestions": ["blocking questions only; empty array if none"]',
  '}',
  'Rules:',
  '- Order units: understand → retrieve standards/code → design → draft → verify.',
  '- Each unit is one clear action; split backend, UI, and validation when needed.',
  '- Do not include implementation code.',
].join('\n');

/** English analyst wrapper — sent as the user turn to the decomposition model call. */
export const buildPromptDecompositionUserMessage = (userPrompt: string): string => (
  [
    'As a software engineer and analyst, review and analyze the following user prompt',
    'and break it down into the smallest actionable work units:',
    '',
    `"${userPrompt.trim()}"`,
  ].join('\n')
);

const stripJsonFence = (text: string): string => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fenced ? fenced[1].trim() : trimmed;
};

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
};

export const parsePromptTaskDecomposition = (text: string): PromptTaskDecomposition | null => {
  const cleaned = stripJsonFence(text);
  if (!cleaned) return null;

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const summary = String(parsed.summary ?? '').trim();
    const workUnits = parseStringArray(parsed.workUnits);
    if (!summary || workUnits.length === 0) return null;

    const assumptions = parseStringArray(parsed.assumptions);
    const openQuestions = parseStringArray(parsed.openQuestions);

    return {
      summary,
      workUnits,
      assumptions: assumptions.length ? assumptions : undefined,
      openQuestions: openQuestions.length ? openQuestions : undefined,
    };
  } catch {
    const numbered = cleaned
      .split('\n')
      .map((line) => line.replace(/^\s*\d+[\).\]]\s*/, '').trim())
      .filter(Boolean);
    if (numbered.length === 0) return null;
    return {
      summary: numbered[0],
      workUnits: numbered.slice(1).length ? numbered.slice(1) : [numbered[0]],
    };
  }
};

export const shouldRunPromptTaskDecomposition = (
  profile: TurnExecutionProfile,
  userIntent: string,
): boolean => (
  profile === 'agent_implement'
  && Boolean(userIntent.trim())
);

export const formatTaskDecompositionForSystemPrompt = (
  decomposition: PromptTaskDecomposition,
): string => {
  const lines = [
    '## Task decomposition (pre-implementation — execute work units in order)',
    decomposition.summary,
    '',
    'Work units:',
    ...decomposition.workUnits.map((unit, index) => `${index + 1}. ${unit}`),
  ];

  if (decomposition.assumptions?.length) {
    lines.push('', 'Assumptions:', ...decomposition.assumptions.map((item) => `- ${item}`));
  }
  if (decomposition.openQuestions?.length) {
    lines.push('', 'Open questions (resolve via retrieve tools before draft_*):', ...decomposition.openQuestions.map((item) => `- ${item}`));
  }

  lines.push(
    '',
    'Complete retrieve and standards work units before any draft_* tool.',
    'Do not skip units or jump straight to coding.',
  );

  return lines.join('\n');
};

export const runPromptTaskDecomposition = async (
  provider: IAiProvider,
  userPrompt: string,
): Promise<PromptTaskDecomposition | null> => {
  if (!userPrompt.trim()) return null;

  try {
    const raw = await provider.chat(
      [{ role: 'user', content: buildPromptDecompositionUserMessage(userPrompt) }],
      PROMPT_TASK_DECOMPOSITION_SYSTEM,
    );
    return parsePromptTaskDecomposition(raw);
  } catch (error) {
    logger.warn('promptTaskDecomposition', 'Decomposition call failed', { error });
    return null;
  }
};
