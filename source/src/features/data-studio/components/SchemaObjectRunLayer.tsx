import React from 'react';
import type { ExecuteDataSourceQueryResult } from '../../../shared/api/contracts/data-sources/executeQuery';
import { SchemaObjectRunPanel } from './SchemaObjectRunPanel';
import type { SchemaObjectRunPanelManagerModel } from '../hooks/useSchemaObjectRunPanelManager';

type SchemaObjectRunLayerProps = {
  manager: SchemaObjectRunPanelManagerModel;
  isSubmitting: boolean;
  onRun: (
    sql: string,
    panelId: string,
    dataSourceId: string,
  ) => Promise<ExecuteDataSourceQueryResult>;
};

export const SchemaObjectRunLayer: React.FC<SchemaObjectRunLayerProps> = ({
  manager,
  isSubmitting,
  onRun,
}) => {
  const frontmostZOrder = manager.panels.reduce(
    (highest, panel) => Math.max(highest, panel.zOrder),
    0,
  );

  return (
    <>
      {manager.panels.map((panel) => (
        <SchemaObjectRunPanel
          key={panel.id}
          panel={panel}
          isFrontmost={panel.zOrder === frontmostZOrder}
          isSubmitting={isSubmitting}
          onClose={() => manager.closePanel(panel.id)}
          onFocus={() => manager.bringToFront(panel.id)}
          onRun={(sql) => onRun(sql, panel.id, panel.context.dataSourceId)}
        />
      ))}
    </>
  );
};
