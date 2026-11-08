import { useEffect, useRef, useState } from 'react';
import type {
  EuaAssistSurface,
  EuaContextNeighborField,
  EuaFieldKind,
} from '../../api/contracts/ai/euaFieldAssist';
import { suggestFieldContext } from '../../api/queries/euaFieldAssist';

type UseAiContextPlaceholderOptions = {
  enabled: boolean;
  fieldLabel?: string;
  fieldKind?: EuaFieldKind;
  sectionTitle?: string;
  sectionDescription?: string;
  neighborFields?: EuaContextNeighborField[];
  currentValue?: string;
  hasExplicitPlaceholder: boolean;
  modelId?: string;
  surface?: EuaAssistSurface;
};

export function useAiContextPlaceholder({
  enabled,
  fieldLabel,
  fieldKind,
  sectionTitle,
  sectionDescription,
  neighborFields,
  currentValue,
  hasExplicitPlaceholder,
  modelId,
  surface = 'admin',
}: UseAiContextPlaceholderOptions) {
  const [placeholder, setPlaceholder] = useState<string | undefined>(undefined);
  const requestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || hasExplicitPlaceholder || currentValue?.trim()) {
      setPlaceholder(undefined);
      requestKeyRef.current = null;
      return;
    }

    const requestKey = JSON.stringify({
      fieldLabel,
      fieldKind,
      sectionTitle,
      sectionDescription,
      neighborFields,
      modelId,
      surface,
    });

    if (requestKeyRef.current === requestKey) {
      return;
    }

    const controller = new AbortController();
    requestKeyRef.current = requestKey;

    void suggestFieldContext({
      mode: 'placeholder',
      fieldLabel,
      fieldKind,
      sectionTitle,
      sectionDescription,
      neighborFields,
      currentValue,
      modelId,
      surface,
    }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setPlaceholder(result.suggestion);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPlaceholder(undefined);
          requestKeyRef.current = null;
        }
      });

    return () => {
      controller.abort();
    };
  }, [
    currentValue,
    enabled,
    fieldKind,
    fieldLabel,
    hasExplicitPlaceholder,
    modelId,
    neighborFields,
    sectionDescription,
    sectionTitle,
    surface,
  ]);

  return placeholder;
}
