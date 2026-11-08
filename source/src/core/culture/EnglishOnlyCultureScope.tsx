import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  CultureContext,
  type CultureContextValue,
  useOptionalCulture,
} from './CultureContext';
import { createEmbeddedEnglishTranslationRuntime } from './embeddedTranslationBundles';
import { TECHNICAL_LTR_CLASS } from './technicalCultureLabels';

const englishRuntime = createEmbeddedEnglishTranslationRuntime();

export type EnglishOnlyCultureScopeProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Forces English copy and LTR layout for developer-facing surfaces (sandbox, builders, editors)
 * regardless of the active culture pack.
 */
export const EnglishOnlyCultureScope: React.FC<EnglishOnlyCultureScopeProps> = ({
  children,
  className,
}) => {
  const parent = useOptionalCulture();

  const value = useMemo<CultureContextValue>(
    () => ({
      cultureId: 'us',
      locale: 'en-US',
      language: 'en',
      calendar: 'gregorian',
      direction: 'ltr',
      timezone: parent?.timezone,
      typography: parent?.typography,
      fontFamily: parent?.fontFamily,
      t: englishRuntime.t,
      ready: true,
    }),
    [parent?.fontFamily, parent?.timezone, parent?.typography],
  );

  return (
    <CultureContext.Provider value={value}>
      <div dir="ltr" lang="en" className={cn(TECHNICAL_LTR_CLASS, className)}>
        {children}
      </div>
    </CultureContext.Provider>
  );
};
