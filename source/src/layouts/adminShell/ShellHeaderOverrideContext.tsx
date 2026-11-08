import React, { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react';
import type { ShellHeaderOverride } from './mergeShellHeaderModule';

type ShellHeaderOverrideContextValue = {
  override: ShellHeaderOverride | null;
  setOverride: (override: ShellHeaderOverride | null) => void;
};

const ShellHeaderOverrideContext = createContext<ShellHeaderOverrideContextValue | null>(null);

export const ShellHeaderOverrideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [override, setOverride] = useState<ShellHeaderOverride | null>(null);
  const value = useMemo(
    () => ({ override, setOverride }),
    [override],
  );

  return (
    <ShellHeaderOverrideContext.Provider value={value}>
      {children}
    </ShellHeaderOverrideContext.Provider>
  );
};

export function useShellHeaderOverrideContext(): ShellHeaderOverrideContextValue {
  const context = useContext(ShellHeaderOverrideContext);
  if (!context) {
    throw new Error('useShellHeaderOverride must be used within ShellHeaderOverrideProvider');
  }
  return context;
}

export function useShellHeaderOverrideState(): ShellHeaderOverride | null {
  return useShellHeaderOverrideContext().override;
}

export function applyShellHeaderOverrideEffect(
  setOverride: ShellHeaderOverrideContextValue['setOverride'],
  override: ShellHeaderOverride | null,
): void | (() => void) {
  if (!override) {
    setOverride(null);
    return;
  }

  const { label, description, icon, groupLabel, titleTrail, breadcrumbTrail } = override;
  setOverride({
    label,
    description,
    icon,
    groupLabel,
    titleTrail,
    breadcrumbTrail,
  });

  return () => setOverride(null);
}

/** Let a mounted page replace shell header title/description until it unmounts. */
export function useShellHeaderOverride(override: ShellHeaderOverride | null): void {
  const { setOverride } = useShellHeaderOverrideContext();
  const label = override?.label;
  const description = override?.description;
  const icon = override?.icon;
  const groupLabel = override?.groupLabel;
  const titleTrail = override?.titleTrail;
  const breadcrumbTrail = override?.breadcrumbTrail;

  useLayoutEffect(() => {
    const normalized = override
      ? { label, description, icon, groupLabel, titleTrail, breadcrumbTrail }
      : null;
    return applyShellHeaderOverrideEffect(setOverride, normalized);
  }, [breadcrumbTrail, description, groupLabel, icon, label, override, setOverride, titleTrail]);
}

/**
 * Same as {@link useShellHeaderOverride} when `ShellHeaderOverrideProvider` is mounted;
 * no-op on designer portal shells and other surfaces without the provider.
 */
export function useOptionalShellHeaderOverride(override: ShellHeaderOverride | null): void {
  const context = useContext(ShellHeaderOverrideContext);
  const label = override?.label;
  const description = override?.description;
  const icon = override?.icon;
  const groupLabel = override?.groupLabel;
  const titleTrail = override?.titleTrail;
  const breadcrumbTrail = override?.breadcrumbTrail;

  useLayoutEffect(() => {
    if (!context) {
      return;
    }
    const normalized = override
      ? { label, description, icon, groupLabel, titleTrail, breadcrumbTrail }
      : null;
    return applyShellHeaderOverrideEffect(context.setOverride, normalized);
  }, [breadcrumbTrail, context, description, groupLabel, icon, label, override, titleTrail]);
}
