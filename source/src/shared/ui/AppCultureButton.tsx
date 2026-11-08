import React from 'react';
import { useOptionalCulture } from '../../core/culture/CultureContext';
import {
  CULTURE_ACTION_FALLBACK_LABELS,
  CULTURE_ACTION_INTENT_KEYS,
} from '../../core/culture/cultureShellKeys';
import type { ButtonIntent } from './buttonSemantics';
import { AppButton, type AppButtonProps } from './AppButton';

export type AppCultureButtonProps = AppButtonProps & {
  labelKey?: string;
};

function resolveCultureButtonLabel(
  intent: ButtonIntent | undefined,
  labelKey: string | undefined,
  t: (key: string) => string,
): string | undefined {
  if (labelKey) {
    return t(labelKey);
  }

  if (!intent) {
    return undefined;
  }

  const key = CULTURE_ACTION_INTENT_KEYS[intent];
  return key ? t(key) : undefined;
}

export const AppCultureButton = React.forwardRef<HTMLButtonElement, AppCultureButtonProps>(
  function AppCultureButton({ intent, labelKey, children, ...props }, ref) {
    const culture = useOptionalCulture();

    if (children != null) {
      return (
        <AppButton ref={ref} intent={intent} {...props}>
          {children}
        </AppButton>
      );
    }

    const fallbackKey = labelKey ?? (intent ? CULTURE_ACTION_INTENT_KEYS[intent] : undefined);
    const fallbackLabel = fallbackKey ? CULTURE_ACTION_FALLBACK_LABELS[fallbackKey] : undefined;
    const label = culture?.ready
      ? resolveCultureButtonLabel(intent, labelKey, culture.t)
      : fallbackLabel;

    return (
      <AppButton ref={ref} intent={intent} {...props}>
        {label}
      </AppButton>
    );
  },
);
