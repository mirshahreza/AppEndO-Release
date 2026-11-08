import React, { useCallback, useContext, useEffect } from 'react';

import type { HwyGeoResponsibilityLevel } from '../../../domain/hwy/hwyGeoResponsibilityCatalog';

export type HwyGeoResponsibilityInlineListDialogRequest = {
  level: HwyGeoResponsibilityLevel;
  search: string;
  /** Member electoral path — disambiguates geo nodes (same segment name in different provinces). */
  electoralPath?: string | null;
  /** Clicked segment index in `splitHwyGeoPathDisplaySegments(electoralPath)`. */
  segmentIndex?: number;
};

type OpenFn = (request: HwyGeoResponsibilityInlineListDialogRequest) => void;

const noopOpen: OpenFn = () => {};

const HWY_GEO_INLINE_LIST_DIALOG_GLOBAL_KEY = '__APPENDO_HWY_GEO_INLINE_LIST_DIALOG__';

type HwyGeoInlineListDialogGlobal = {
  context: React.Context<OpenFn>;
  open: OpenFn | null;
};

const getHwyGeoInlineListDialogGlobal = (): HwyGeoInlineListDialogGlobal => {
  const root = globalThis as typeof globalThis & {
    [HWY_GEO_INLINE_LIST_DIALOG_GLOBAL_KEY]?: HwyGeoInlineListDialogGlobal;
  };
  if (!root[HWY_GEO_INLINE_LIST_DIALOG_GLOBAL_KEY]) {
    root[HWY_GEO_INLINE_LIST_DIALOG_GLOBAL_KEY] = {
      context: React.createContext<OpenFn>(noopOpen),
      open: null,
    };
  }
  return root[HWY_GEO_INLINE_LIST_DIALOG_GLOBAL_KEY]!;
};

export const HwyGeoResponsibilityInlineListDialogProvider: React.FC<{
  open: OpenFn;
  children: React.ReactNode;
}> = ({ open, children }) => {
  const bridge = getHwyGeoInlineListDialogGlobal();

  useEffect(() => {
    bridge.open = open;
    return () => {
      if (bridge.open === open) {
        bridge.open = null;
      }
    };
  }, [bridge, open]);

  return (
    <bridge.context.Provider value={open}>
      {children}
    </bridge.context.Provider>
  );
};

export const useOpenHwyGeoResponsibilityInlineListDialog = (): OpenFn => {
  const fromContext = useContext(getHwyGeoInlineListDialogGlobal().context);
  return useCallback(
    (request: HwyGeoResponsibilityInlineListDialogRequest) => {
      const bridge = getHwyGeoInlineListDialogGlobal();
      const open = bridge.open ?? fromContext;
      open(request);
    },
    [fromContext],
  );
};
