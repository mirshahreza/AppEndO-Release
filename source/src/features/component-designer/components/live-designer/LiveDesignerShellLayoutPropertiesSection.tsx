import * as React from 'react';
import type { DesignerAction, DesignerDocument } from '../../../../domain/component-designer/types';
import { LiveDesignerShellLayoutControl } from './LiveDesignerShellLayoutControl';

export type LiveDesignerShellLayoutPropertiesSectionProps = {
  document: DesignerDocument;
  dispatch: React.Dispatch<DesignerAction>;
};

export const LiveDesignerShellLayoutPropertiesSection: React.FC<
  LiveDesignerShellLayoutPropertiesSectionProps
> = ({ document, dispatch }) => (
  <div className="space-y-3" data-testid="live-designer-shell-layout-properties">
    <p className="text-xs leading-relaxed text-slate-500">
      Default page width for visitors. When bounded, they can temporarily expand to full width from the header
      (same area as fullscreen) without leaving the app chrome.
    </p>
    <LiveDesignerShellLayoutControl
      document={document}
      dispatch={dispatch}
      variant="properties"
    />
  </div>
);
