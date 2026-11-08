import React from 'react';
import { EdgeModelRelationsPanel } from './EdgeModelRelationsPanel';
import type { EdgeModelRelationsManagerModel } from '../hooks/useEdgeModelRelationsManager';

type EdgeModelRelationsLayerProps = {
  manager: EdgeModelRelationsManagerModel;
};

export const EdgeModelRelationsLayer: React.FC<EdgeModelRelationsLayerProps> = ({ manager }) => (
  <>
    {manager.panels.map((panel) => (
      <EdgeModelRelationsPanel
        key={panel.id}
        panel={panel}
        onClose={() => manager.closeRelations(panel.id)}
        onFocus={() => manager.bringToFront(panel.id)}
      />
    ))}
  </>
);
