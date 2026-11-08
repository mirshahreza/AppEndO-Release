import React from 'react';
import { EdgeModelDesignerPanel } from './EdgeModelDesignerPanel';
import type { EdgeModelDesignerManagerModel } from '../hooks/useEdgeModelDesignerManager';

type EdgeModelDesignerLayerProps = {
  manager: EdgeModelDesignerManagerModel;
};

export const EdgeModelDesignerLayer: React.FC<EdgeModelDesignerLayerProps> = ({ manager }) => (
  <>
    {manager.panels.map((panel) => (
      <EdgeModelDesignerPanel
        key={panel.id}
        panel={panel}
        onClose={() => manager.closeDesigner(panel.id)}
        onFocus={() => manager.bringToFront(panel.id)}
      />
    ))}
  </>
);
