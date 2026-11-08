import { useCallback, useRef, useState } from 'react';
import type { DataStudioExplorerObjectRow } from '../types';

export type EdgeModelRelationsLaunchContext = {
  row: DataStudioExplorerObjectRow;
  dataSourceId: string;
  dataSourceName: string;
};

export type EdgeModelRelationsPanelEntry = {
  id: string;
  context: EdgeModelRelationsLaunchContext;
  zOrder: number;
  cascadeIndex: number;
};

const BASE_Z_INDEX = 110;

export function useEdgeModelRelationsManager() {
  const [panels, setPanels] = useState<EdgeModelRelationsPanelEntry[]>([]);
  const zOrderRef = useRef(BASE_Z_INDEX);

  const bringToFront = useCallback((panelId: string) => {
    zOrderRef.current += 1;
    const nextZ = zOrderRef.current;
    setPanels((current) => current.map((panel) => (
      panel.id === panelId ? { ...panel, zOrder: nextZ } : panel
    )));
  }, []);

  const openRelations = useCallback((context: EdgeModelRelationsLaunchContext) => {
    if (context.row.objectKind !== 'TABLE' && context.row.objectKind !== 'VIEW') {
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

  const closeRelations = useCallback((panelId: string) => {
    setPanels((current) => current.filter((panel) => panel.id !== panelId));
  }, []);

  return {
    panels,
    openRelations,
    closeRelations,
    bringToFront,
  };
}

export type EdgeModelRelationsManagerModel = ReturnType<typeof useEdgeModelRelationsManager>;
