import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { lookupEmbeddedEnglish } from '../../core/culture/embeddedTranslationBundles';
import type { AiModelCapabilities } from '../../shared/api/contracts/ai/types';
import {
  ATTRIBUTE_USER_EDIT_POLICIES,
  type AttributeUserEditPolicy,
} from '../../shared/api/contracts/attributes/editPolicy';

export function getAiCapabilityLabel(
  t: TranslationFn | undefined,
  key: keyof AiModelCapabilities,
): string {
  const translationKey = `settings.ai.capability.${key}`;
  return t ? t(translationKey) : lookupEmbeddedEnglish(translationKey);
}

export function getUserEditPolicyLabel(
  t: TranslationFn | undefined,
  policy: AttributeUserEditPolicy,
): string {
  const suffix = policy === 'WHEN_EMPTY' ? 'whenEmpty' : policy === 'ALWAYS' ? 'always' : 'none';
  const translationKey = `settings.attributes.editPolicy.${suffix}`;
  return t ? t(translationKey) : lookupEmbeddedEnglish(translationKey);
}

export function getUserEditPolicyOptions(t: TranslationFn): Array<{
  value: AttributeUserEditPolicy;
  label: string;
}> {
  return ATTRIBUTE_USER_EDIT_POLICIES.map((value) => ({
    value,
    label: getUserEditPolicyLabel(t, value),
  }));
}
