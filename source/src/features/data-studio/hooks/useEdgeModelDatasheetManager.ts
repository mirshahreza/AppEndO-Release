import { useCallback, useRef, useState } from 'react';
import type { DataStudioExplorerObjectRow } from '../types';

export type EdgeModelDatasheetLaunchContext = {
  row: DataStudioExplorerObjectRow;
  modelId: string;
  dataSourceId: string;
  dataSourceName: string;
};

export type EdgeModelDatasheetPanelEntry = {
  id: string;
  context: EdgeModelDatasheetLaunchContext;
  zOrder: number;
  cascadeIndex: number;
};

const BASE_Z_INDEX = 122;

export function useEdgeModelDatasheetManager() {
  const [panels, setPanels] = useState<EdgeModelDatasheetPanelEntry[]>([]);
  const zOrderRef = useRef(BASE_Z_INDEX);

  const bringToFront = useCallback((panelId: string) => {
    zOrderRef.current += 1;
    const nextZ = zOrderRef.current;
    setPanels((current) => current.map((panel) => (
      panel.id === panelId ? { ...panel, zOrder: nextZ } : panel
    )));
  }, []);

  const openDatasheet = useCallback((context: EdgeModelDatasheetLaunchContext) => {
    setPanels((current) => {
      const existing = current.find((panel) => panel.id === context.modelId);
      if (existing) {
        zOrderRef.current += 1;
        const nextZ = zOrderRef.current;
        return current.map((panel) => (
          panel.id === context.modelId ? { ...panel, context, zOrder: nextZ } : panel
        ));
      }
      zOrderRef.current += 1;
      return [
        ...current,
        {
          id: context.modelId,
          context,
          zOrder: zOrderRef.current,
          cascadeIndex: current.length % 12,
        },
      ];
    });
  }, []);

  const closeDatasheet = useCallback((panelId: string) => {
    setPanels((current) => current.filter((panel) => panel.id !== panelId));
  }, []);

  return {
    panels,
    openDatasheet,
    closeDatasheet,
    bringToFront,
  };
}

export type EdgeModelDatasheetManagerModel = ReturnType<typeof useEdgeModelDatasheetManager>;
