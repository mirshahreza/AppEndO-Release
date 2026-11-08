import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { CultureCalendarId, CultureTypography } from '../../shared/api/contracts/systemExtensions/types';
import { loadCultureFonts, loadCultureFontWeights, resolveCultureFontFamily } from './cultureFontLoader';
import { resolveCultureById } from './MountCultureResolver';
import { syncAdminShellDirectionalThemeTokens } from '../../shared/theme/accentColorUtils';
import { getDefaultCulturePackId, resolveCulturePackAdapter } from './CultureRegistry';
import {
  createTranslationRuntime,
  loadMasterTranslationBundle,
  type TranslationFn,
} from './TranslationRuntime';
import { getCultureTranslationOverridesRevision } from './CultureTranslationOverrides';
import { CULTURE_PUBLIC_FALLBACK_LABELS } from './cultureFallbackLabels';
import {
  EMBEDDED_ENGLISH_BUNDLE,
  createEmbeddedPublicCultureTranslationRuntime,
  loadEmbeddedCultureBundle,
  lookupEmbeddedEnglish,
} from './embeddedTranslationBundles';
import { MASTER_TRANSLATION_BUNDLE_ID } from '../../shared/api/contracts/platform/cultureTranslations';
import { DEFAULT_BUILTIN_CULTURE_PACKS } from '../../shared/api/contracts/platform/cultures';
import { mergeTranslationBundle } from './CultureTranslationOverrides';
import {
  isInlineTranslationCaptureActive,
  noteInlineTranslationKey,
  subscribeInlineTranslationCapture,
} from './inlineTranslationCapture';

const bootEnglishRuntime = createTranslationRuntime(
  { ...EMBEDDED_ENGLISH_BUNDLE },
  { ...EMBEDDED_ENGLISH_BUNDLE },
);

export type CultureContextValue = {
  cultureId: string;
  locale: string;
  language: string;
  calendar: CultureCalendarId;
  direction: 'ltr' | 'rtl';
  timezone?: string;
  typography?: CultureTypography;
  fontFamily?: string;
  t: TranslationFn;
  ready: boolean;
};

const CultureContext = createContext<CultureContextValue | null>(null);

export { CultureContext };

const resolvePublicTranslation: TranslationFn = (key) => (
  CULTURE_PUBLIC_FALLBACK_LABELS[key] ?? lookupEmbeddedEnglish(key)
);

/** Public embedded bundles load before `/api/boot` — resolve bundle id without adapter registry. */
const resolveEmbeddedTranslationBundleId = (cultureId: string): string => {
  const normalized = cultureId.trim();
  const adapter = resolveCulturePackAdapter(normalized);
  const fromAdapter = adapter?.extension.translationBundleId?.trim();
  if (fromAdapter) {
    return fromAdapter;
  }

  const fromBuiltin = DEFAULT_BUILTIN_CULTURE_PACKS.find((pack) => pack.id === normalized)
    ?.translationBundleId?.trim();
  if (fromBuiltin) {
    return fromBuiltin;
  }

  return normalized || MASTER_TRANSLATION_BUNDLE_ID;
};

export const CultureProvider: React.FC<{
  cultureId: string;
  timezoneOverride?: string;
  /** Public auth surfaces use embedded bundles only — no authenticated API fetch. */
  translationBundleSource?: 'remote' | 'embedded';
  children: React.ReactNode;
}> = ({ cultureId, timezoneOverride, translationBundleSource = 'remote', children }) => {
  const resolved = useMemo(
    () => resolveCultureById(cultureId, timezoneOverride),
    [cultureId, timezoneOverride],
  );
  const [runtimeState, setRuntimeState] = useState<{
    t: TranslationFn;
    ready: boolean;
  }>(() => {
    if (translationBundleSource === 'embedded') {
      const embeddedRuntime = createEmbeddedPublicCultureTranslationRuntime(cultureId);
      return { t: embeddedRuntime.t, ready: false };
    }
    return { t: bootEnglishRuntime.t, ready: false };
  });
  const [translationRevision, setTranslationRevision] = useState(
    () => getCultureTranslationOverridesRevision(),
  );
  const [inlineTranslationCapture, setInlineTranslationCapture] = useState(
    () => isInlineTranslationCaptureActive(),
  );

  useEffect(() => subscribeInlineTranslationCapture(() => {
    setInlineTranslationCapture(isInlineTranslationCaptureActive());
  }), []);

  useLayoutEffect(() => {
    const direction = resolved.direction;
    const previousFontFamily = document.documentElement.style.getPropertyValue('--culture-font-sans');
    document.documentElement.setAttribute('dir', direction);
    document.documentElement.setAttribute('lang', resolved.language);
    syncAdminShellDirectionalThemeTokens(document.documentElement, direction);

    const fontFamily = resolveCultureFontFamily(resolved.extension.typography);
    if (fontFamily) {
      document.documentElement.style.setProperty('--culture-font-sans', fontFamily);
    } else {
      document.documentElement.style.removeProperty('--culture-font-sans');
    }

    void loadCultureFonts(resolved.extension.typography);
    void loadCultureFontWeights(resolved.extension.typography);

    return () => {
      // Do not revert `dir` / `lang` here. Strict Mode and Vite HMR briefly unmount
      // CultureProvider; stripping `dir` flips the admin shell to LTR until a full reload.
      // The next mounted CultureProvider overwrites locale on `<html>`.
      if (previousFontFamily) {
        document.documentElement.style.setProperty('--culture-font-sans', previousFontFamily);
      } else {
        document.documentElement.style.removeProperty('--culture-font-sans');
      }
    };
  }, [resolved.direction, resolved.extension.typography, resolved.language]);

  useEffect(() => {
    const syncRevision = () => {
      setTranslationRevision(getCultureTranslationOverridesRevision());
    };

    window.addEventListener('appendo:culture-translations-updated', syncRevision);
    return () => {
      window.removeEventListener('appendo:culture-translations-updated', syncRevision);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRuntime = async () => {
      const adapter = resolveCulturePackAdapter(resolved.cultureId);
      if (!adapter && translationBundleSource !== 'embedded') {
        if (!cancelled) {
          setRuntimeState({ t: bootEnglishRuntime.t, ready: true });
        }
        return;
      }

      const loadCultureBundle = async () => {
        if (translationBundleSource === 'embedded') {
          const bundleId = resolveEmbeddedTranslationBundleId(resolved.cultureId);
          const base = await loadEmbeddedCultureBundle(bundleId);
          return mergeTranslationBundle(base, resolved.cultureId);
        }

        return adapter!.loadTranslationBundle();
      };

      const loadFallbackBundle = async () => {
        if (translationBundleSource === 'embedded') {
          return loadEmbeddedCultureBundle(MASTER_TRANSLATION_BUNDLE_ID);
        }

        return loadMasterTranslationBundle();
      };

      const [bundleResult, fallbackResult] = await Promise.allSettled([
        loadCultureBundle(),
        loadFallbackBundle(),
      ]);

      if (cancelled) {
        return;
      }

      const bundle = bundleResult.status === 'fulfilled'
        ? bundleResult.value
        : { ...EMBEDDED_ENGLISH_BUNDLE };
      const fallbackBundle = fallbackResult.status === 'fulfilled'
        ? fallbackResult.value
        : { ...EMBEDDED_ENGLISH_BUNDLE };

      const runtime = createTranslationRuntime(
        bundle,
        resolved.cultureId === getDefaultCulturePackId() ? bundle : fallbackBundle,
      );
      setRuntimeState({ t: runtime.t, ready: true });
    };

    if (translationBundleSource === 'embedded') {
      const embeddedRuntime = createEmbeddedPublicCultureTranslationRuntime(cultureId);
      setRuntimeState({ t: embeddedRuntime.t, ready: false });
    } else {
      setRuntimeState({ t: bootEnglishRuntime.t, ready: false });
    }
    void loadRuntime();

    return () => {
      cancelled = true;
    };
  }, [resolved.cultureId, translationBundleSource, translationRevision]);

  const t = useCallback<TranslationFn>((key, options) => {
    const value = runtimeState.t(key, options);
    if (inlineTranslationCapture) {
      noteInlineTranslationKey(key, value);
    }
    return value;
  }, [inlineTranslationCapture, runtimeState.t]);

  const value = useMemo<CultureContextValue>(
    () => ({
      cultureId: resolved.cultureId,
      locale: resolved.locale,
      language: resolved.language,
      calendar: resolved.calendar,
      direction: resolved.direction,
      timezone: resolved.timezone,
      typography: resolved.extension.typography,
      fontFamily: resolveCultureFontFamily(resolved.extension.typography),
      t,
      ready: runtimeState.ready,
    }),
    [resolved, runtimeState.ready, t],
  );

  return <CultureContext.Provider value={value}>{children}</CultureContext.Provider>;
};

export function useOptionalCulture(): CultureContextValue | null {
  return useContext(CultureContext);
}

export function useCulture(): CultureContextValue {
  const context = useContext(CultureContext);
  if (!context) {
    throw new Error('useCulture must be used within CultureProvider.');
  }

  return context;
}

/** Translation lookup that works outside CultureProvider (public routes, early boot). */
export function useOptionalCultureT(): TranslationFn {
  const culture = useOptionalCulture();
  return culture?.t ?? resolvePublicTranslation;
}

/** Shorthand for `useCulture().t` when only translation lookup is needed. */
export function useCultureT(): CultureContextValue['t'] {
  return useCulture().t;
}
