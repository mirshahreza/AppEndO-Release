import type { AiPageContext } from '../../api/contracts/ai/pageContext';
import { listManagedFunctionsFromStore } from '../../../core/functions/FunctionFileStore';
import {
  detectServerFunctionIntent,
  detectUIIntent,
} from '../detectCodingIntent';

export type PromptEngineeringTargets = {
  functionId?: string;
  functionName?: string;
  layoutId?: string;
  apiPath?: string;
};

const FUNCTION_ID_PATTERN = /\b([a-z][a-z0-9_-]*)\.([a-z][a-z0-9_-]+)\b/gi;
const API_PATH_PATTERN = /\/api\/([a-z0-9_-]+)\/([a-z0-9_-]+)/i;
const ROUTE_PATH_PATTERN = /\b([a-z][a-z0-9_-]*)\/([a-z][a-z0-9_-]+)\b/i;
const KEBAB_NAME_PATTERN = /\b([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\b/i;
const LAYOUT_PATH_PATTERN = /\b(?:layout|component|client-components|designer)\s+([a-z0-9_-]+\/[a-z0-9_-]+)\b/i;

const isLikelyFunctionId = (folder: string, name: string): boolean => {
  const lowerName = name.toLowerCase();
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'md', 'css'].includes(lowerName)) {
    return false;
  }
  if (folder.toLowerCase() === 'src') {
    return false;
  }
  return true;
};

/** Extract explicit server-function / designer targets named in the user message. */
export const extractPromptEngineeringTargets = (text: string): PromptEngineeringTargets => {
  const trimmed = text.trim();
  if (!trimmed) return {};

  const targets: PromptEngineeringTargets = {};

  const apiMatch = trimmed.match(API_PATH_PATTERN);
  if (apiMatch) {
    targets.functionId = `${apiMatch[1]}.${apiMatch[2]}`;
    targets.functionName = apiMatch[2];
    targets.apiPath = `/api/${apiMatch[1]}/${apiMatch[2]}`;
    return targets;
  }

  for (const match of trimmed.matchAll(FUNCTION_ID_PATTERN)) {
    const folder = match[1];
    const name = match[2];
    if (!isLikelyFunctionId(folder, name)) continue;
    targets.functionId = `${folder}.${name}`;
    targets.functionName = name;
    return targets;
  }

  const routeContext = /(server[\s-]*function|endpoint|api|math|users|sum)/i.test(trimmed);
  if (routeContext) {
    const routeMatch = trimmed.match(ROUTE_PATH_PATTERN);
    if (routeMatch && isLikelyFunctionId(routeMatch[1], routeMatch[2])) {
      targets.functionId = `${routeMatch[1]}.${routeMatch[2]}`;
      targets.functionName = routeMatch[2];
    }
  }

  const layoutMatch = trimmed.match(LAYOUT_PATH_PATTERN);
  if (layoutMatch) {
    targets.layoutId = layoutMatch[1];
  }

  if (!targets.functionId && (detectUIIntent(trimmed) || detectServerFunctionIntent(trimmed))) {
    const nameMatch = trimmed.match(KEBAB_NAME_PATTERN);
    if (nameMatch) {
      targets.functionName = nameMatch[1];
    }
  }

  return targets;
};

/** Resolve kebab-case function names to canonical folder.name ids when possible. */
export const resolvePromptEngineeringTargets = (
  extracted: PromptEngineeringTargets,
): PromptEngineeringTargets => {
  if (extracted.functionId || !extracted.functionName?.trim()) {
    return extracted;
  }

  const name = extracted.functionName.trim().toLowerCase();
  try {
    const functions = listManagedFunctionsFromStore();
    const match = functions.find((fn) => (
      fn.name.toLowerCase() === name
      || fn.id.toLowerCase() === name
      || fn.id.toLowerCase().endsWith(`.${name}`)
    ));
    if (match) {
      return {
        ...extracted,
        functionId: match.id,
        functionName: match.name,
      };
    }
  } catch {
    // Best-effort resolution.
  }

  return extracted;
};

export const hasPromptEngineeringTargets = (
  targets: PromptEngineeringTargets,
): boolean => Boolean(targets.functionId?.trim() || targets.layoutId?.trim());

/** Overlay prompt-named targets onto page context — prompt wins over unrelated open editor state. */
export const mergePromptTargetsIntoPageContext = (
  pageContext: AiPageContext | null | undefined,
  targets: PromptEngineeringTargets,
): AiPageContext | undefined => {
  if (!hasPromptEngineeringTargets(targets)) {
    return pageContext ?? undefined;
  }

  const base: AiPageContext = pageContext?.path
    ? pageContext
    : {
      path: pageContext?.path ?? '',
      pageLabel: pageContext?.pageLabel?.trim() || 'AppEndO',
      ...pageContext,
    };

  const next: AiPageContext = { ...base };

  if (targets.functionId?.trim()) {
    next.functionId = targets.functionId.trim();
    next.functionName = targets.functionName?.trim() || targets.functionId.split('.').pop();
  }

  if (targets.layoutId?.trim()) {
    next.layoutId = targets.layoutId.trim();
  }

  return next;
};

export const promptTargetsConflictWithPage = (
  pageContext: AiPageContext | null | undefined,
  targets: PromptEngineeringTargets,
): boolean => {
  if (!hasPromptEngineeringTargets(targets)) return false;

  const pageFunctionId = pageContext?.functionId?.trim();
  if (
    targets.functionId?.trim()
    && pageFunctionId
    && pageFunctionId !== targets.functionId.trim()
  ) {
    return true;
  }

  const pageLayoutId = pageContext?.layoutId?.trim();
  if (
    targets.layoutId?.trim()
    && pageLayoutId
    && pageLayoutId !== targets.layoutId.trim()
  ) {
    return true;
  }

  return Boolean(
    hasPromptEngineeringTargets(targets)
    && pageContext?.pageKey?.trim()
    && !pageContext.functionId?.trim()
    && !pageContext.layoutId?.trim(),
  );
};

export const resolvePromptDrivenSearchScopePaths = (
  targets: PromptEngineeringTargets,
): string[] | undefined => {
  if (targets.layoutId?.trim()) {
    return ['workspace/designer', 'src/features/component-designer'];
  }
  if (targets.functionId?.trim()) {
    return ['workspace/server-functions', 'workspace/designer', 'src/features/server-functions'];
  }
  return undefined;
};
