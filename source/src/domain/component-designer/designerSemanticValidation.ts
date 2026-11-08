import type { SemanticValidationPolicy } from '../../shared/api/contracts/ai/euaSemanticValidation';
import type { DesignerNode } from './types';
import { readString } from './runtimeShared';

export const DESIGNER_SEMANTIC_VALIDATION_PROP_KEYS = [
  'semanticRubricKind',
  'semanticRubricStatic',
  'semanticRubricCultureKey',
  'semanticUserGuidance',
  'semanticReasonsLanguage',
] as const;

export type DesignerSemanticRubricKind = '' | 'off' | 'static' | 'cultureKey';

const readSemanticRubricKind = (node: DesignerNode): DesignerSemanticRubricKind => {
  const kind = readString(node.props.semanticRubricKind).trim().toLowerCase();
  if (kind === 'static' || kind === 'culturekey') {
    return kind === 'culturekey' ? 'cultureKey' : 'static';
  }
  if (kind === 'off') {
    return 'off';
  }
  return '';
};

export const nodeHasSemanticValidation = (node: DesignerNode): boolean =>
  resolveDesignerSemanticValidationPolicy(node) !== null;

export const resolveDesignerSemanticValidationPolicy = (
  node: DesignerNode,
): SemanticValidationPolicy | null => {
  const kind = readSemanticRubricKind(node);
  if (!kind || kind === 'off') {
    return null;
  }

  if (kind === 'static') {
    const text = readString(node.props.semanticRubricStatic).trim();
    if (!text) {
      return null;
    }
    return {
      rubric: { kind: 'static', text },
      triggers: ['blur', 'submit'],
    };
  }

  if (kind === 'cultureKey') {
    const key = readString(node.props.semanticRubricCultureKey).trim();
    if (!key) {
      return null;
    }
    return {
      rubric: { kind: 'cultureKey', key },
      triggers: ['blur', 'submit'],
    };
  }

  return null;
};

export const resolveDesignerSemanticUserGuidance = (node: DesignerNode): string =>
  readString(node.props.semanticUserGuidance).trim();

export const resolveDesignerSemanticReasonsLanguage = (node: DesignerNode): string | undefined => {
  const lang = readString(node.props.semanticReasonsLanguage).trim();
  return lang || undefined;
};

/** Extra JSX attrs for TSX export when semantic validation is configured on a textarea. */
export const renderDesignerSemanticValidationJsxAttrs = (node: DesignerNode): string => {
  const policy = resolveDesignerSemanticValidationPolicy(node);
  if (!policy) {
    return '';
  }

  const chunks: string[] = [` semanticValidation={${JSON.stringify(policy)}}`];
  const guidance = resolveDesignerSemanticUserGuidance(node);
  if (guidance) {
    chunks.push(` userGuidance={${JSON.stringify(guidance)}}`);
  }
  const reasonsLanguage = resolveDesignerSemanticReasonsLanguage(node);
  if (reasonsLanguage) {
    chunks.push(` reasonsLanguage={${JSON.stringify(reasonsLanguage)}}`);
  }
  return chunks.join('');
};

export const DESIGNER_SEMANTIC_VALIDATION_EXCLUDE_KEYS = new Set<string>([
  ...DESIGNER_SEMANTIC_VALIDATION_PROP_KEYS,
]);
