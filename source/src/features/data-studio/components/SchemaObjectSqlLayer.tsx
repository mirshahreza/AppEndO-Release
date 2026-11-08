import React from 'react';
import type { SchemaObjectDependencyItem } from '../../../shared/api/contracts/data-sources/schemaObjectDependencies';
import { SchemaObjectSqlPanel } from './SchemaObjectSqlPanel';
import type { DataStudioExplorerObjectKind } from '../types';
import type { SchemaObjectSqlPanelManagerModel } from '../hooks/useSchemaObjectSqlPanelManager';

type SchemaObjectSqlLayerProps = {
  manager: SchemaObjectSqlPanelManagerModel;
  isSubmitting: boolean;
  onExecute: (
    sql: string,
    mode: 'create' | 'alter',
    objectKind: DataStudioExplorerObjectKind,
    objectName: string,
    panelId: string,
  ) => Promise<void>;
  onOpenObject: (item: SchemaObjectDependencyItem) => void;
  resolveObjectHref: (item: SchemaObjectDependencyItem) => string;
  onImportantMessage?: (message: string) => void;
};

export const SchemaObjectSqlLayer: React.FC<SchemaObjectSqlLayerProps> = ({
  manager,
  isSubmitting,
  onExecute,
  onOpenObject,
  resolveObjectHref,
  onImportantMessage,
}) => (
  <>
    {manager.panels.map((panel) => (
      <SchemaObjectSqlPanel
        key={panel.id}
        panel={panel}
        isSubmitting={isSubmitting}
        onClose={() => manager.closePanel(panel.id)}
        onFocus={() => manager.bringToFront(panel.id)}
        onExecute={(sql) => onExecute(
          sql,
          panel.context.mode,
          panel.context.objectKind,
          panel.context.objectName,
          panel.id,
        )}
        onOpenObject={onOpenObject}
        resolveObjectHref={resolveObjectHref}
        onImportantMessage={onImportantMessage}
      />
    ))}
  </>
);
