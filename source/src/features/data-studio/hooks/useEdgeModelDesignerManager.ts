import { useCallback, useRef, useState } from 'react';
import type { DataStudioExplorerObjectRow } from '../types';

export type EdgeModelDesignerLaunchContext = {
  row: DataStudioExplorerObjectRow;
  dataSourceId: string;
  dataSourceName: string;
  dataSourceType: string;
};

export type EdgeModelDesignerPanelEntry = {
  id: string;
  context: EdgeModelDesignerLaunchContext;
  zOrder: number;
  cascadeIndex: number;
};

const BASE_Z_INDEX = 120;

export function useEdgeModelDesignerManager() {
  const [panels, setPanels] = useState<EdgeModelDesignerPanelEntry[]>([]);
  const zOrderRef = useRef(BASE_Z_INDEX);

  const bringToFront = useCallback((panelId: string) => {
    zOrderRef.current += 1;
    const nextZ = zOrderRef.current;
    setPanels((current) => current.map((panel) => (
      panel.id === panelId ? { ...panel, zOrder: nextZ } : panel
    )));
  }, []);

  const openDesigner = useCallback((context: EdgeModelDesignerLaunchContext) => {
    if (!context.row.supportsEdgeModel) {
      return;
    }

    setPanels((current) => {
      const existing = current.find((panel) => panel.id === context.row.id);
      if (existing) {
        zOrderRef.current += 1;
        const nextZ = zOrderRef.current;
        return current.map((panel) => (
          panel.id === context.row.id
            ? { ...panel, context, zOrder: nextZ }
            : panel
        ));
      }

      zOrderRef.current += 1;
      return [
        ...current,
        {
          id: context.row.id,
          context,
          zOrder: zOrderRef.current,
          cascadeIndex: current.length % 12,
        },
      ];
    });
  }, []);

  const closeDesigner = useCallback((panelId: string) => {
    setPanels((current) => current.filter((panel) => panel.id !== panelId));
  }, []);

  return {
    panels,
    openDesigner,
    closeDesigner,
    bringToFront,
  };
}

export type EdgeModelDesignerManagerModel = ReturnType<typeof useEdgeModelDesignerManager>;
