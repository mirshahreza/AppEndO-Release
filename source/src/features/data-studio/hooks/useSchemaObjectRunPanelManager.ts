import { useCallback, useRef, useState } from 'react';
import type { DataStudioExplorerObjectKind } from '../types';

export type SchemaObjectRunPanelContext = {
  dataSourceId: string;
  dataSourceName: string;
  dataSourceType: string;
  objectKind: DataStudioExplorerObjectKind;
  objectName: string;
  initialSql: string;
};

export type SchemaObjectRunPanelEntry = {
  id: string;
  context: SchemaObjectRunPanelContext;
  zOrder: number;
  cascadeIndex: number;
};

const BASE_Z_INDEX = 115;

export const buildSchemaObjectRunPanelId = (
  objectKind: DataStudioExplorerObjectKind,
  dataSourceId: string,
  objectName: string,
) => `run:${objectKind}:${dataSourceId}:${objectName}`;

export function useSchemaObjectRunPanelManager() {
  const [panels, setPanels] = useState<SchemaObjectRunPanelEntry[]>([]);
  const zOrderRef = useRef(BASE_Z_INDEX);

  const bringToFront = useCallback((panelId: string) => {
    zOrderRef.current += 1;
    const nextZ = zOrderRef.current;
    setPanels((current) => current.map((panel) => (
      panel.id === panelId ? { ...panel, zOrder: nextZ } : panel
    )));
  }, []);

  const openPanel = useCallback((context: SchemaObjectRunPanelContext) => {
    const panelId = buildSchemaObjectRunPanelId(
      context.objectKind,
      context.dataSourceId,
      context.objectName,
    );

    setPanels((current) => {
      const existing = current.find((panel) => panel.id === panelId);
      if (existing) {
        zOrderRef.current += 1;
        const nextZ = zOrderRef.current;
        return current.map((panel) => (
          panel.id === panelId
            ? { ...panel, context, zOrder: nextZ }
            : panel
        ));
      }

      zOrderRef.current += 1;
      return [
        ...current,
        {
          id: panelId,
          context,
          zOrder: zOrderRef.current,
          cascadeIndex: current.length % 12,
        },
      ];
    });
  }, []);

  const closePanel = useCallback((panelId: string) => {
    setPanels((current) => current.filter((panel) => panel.id !== panelId));
  }, []);

  return {
    panels,
    openPanel,
    closePanel,
    bringToFront,
  };
}

export type SchemaObjectRunPanelManagerModel = ReturnType<typeof useSchemaObjectRunPanelManager>;
