import React from 'react';
import { EdgeModelDatasheetPanel } from './EdgeModelDatasheetPanel';
import type { EdgeModelDatasheetManagerModel } from '../hooks/useEdgeModelDatasheetManager';

type EdgeModelDatasheetLayerProps = {
  manager: EdgeModelDatasheetManagerModel;
};

export const EdgeModelDatasheetLayer: React.FC<EdgeModelDatasheetLayerProps> = ({ manager }) => (
  <>
    {manager.panels.map((panel) => (
      <EdgeModelDatasheetPanel
        key={panel.id}
        panel={panel}
        onClose={() => manager.closeDatasheet(panel.id)}
        onFocus={() => manager.bringToFront(panel.id)}
      />
    ))}
  </>
);
