import { useCallback, useRef, useState } from 'react';
import type { DataStudioExplorerObjectKind } from '../types';

export type SchemaObjectSqlPanelMode = 'create' | 'alter';

export type SchemaObjectSqlPanelContext = {
  mode: SchemaObjectSqlPanelMode;
  dataSourceId: string;
  dataSourceName: string;
  dataSourceType: string;
  objectKind: DataStudioExplorerObjectKind;
  objectName: string;
  initialSql: string;
  readOnly?: boolean;
};

export type SchemaObjectSqlPanelEntry = {
  id: string;
  context: SchemaObjectSqlPanelContext;
  zOrder: number;
  cascadeIndex: number;
};

const BASE_Z_INDEX = 110;

export const buildSchemaObjectSqlPanelId = (
  objectKind: DataStudioExplorerObjectKind,
  dataSourceId: string,
  objectName: string,
) => `sql:${objectKind}:${dataSourceId}:${objectName}`;

export function useSchemaObjectSqlPanelManager() {
  const [panels, setPanels] = useState<SchemaObjectSqlPanelEntry[]>([]);
  const zOrderRef = useRef(BASE_Z_INDEX);

  const bringToFront = useCallback((panelId: string) => {
    zOrderRef.current += 1;
    const nextZ = zOrderRef.current;
    setPanels((current) => current.map((panel) => (
      panel.id === panelId ? { ...panel, zOrder: nextZ } : panel
    )));
  }, []);

  const openPanel = useCallback((context: SchemaObjectSqlPanelContext) => {
    const panelId = buildSchemaObjectSqlPanelId(
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

  const updatePanelContext = useCallback((
    panelId: string,
    patch: Partial<SchemaObjectSqlPanelContext>,
  ) => {
    setPanels((current) => current.map((panel) => (
      panel.id === panelId
        ? { ...panel, context: { ...panel.context, ...patch } }
        : panel
    )));
  }, []);

  return {
    panels,
    openPanel,
    closePanel,
    bringToFront,
    updatePanelContext,
  };
}

export type SchemaObjectSqlPanelManagerModel = ReturnType<typeof useSchemaObjectSqlPanelManager>;
