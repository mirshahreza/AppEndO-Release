import * as React from 'react';
import type { DesignerAction, DesignerBindingDefinitions, DesignerDocument } from '../../../domain/component-designer/types';
import type { DesignerNode } from '../../../domain/component-designer/types';
import {
  countActiveNodeEventBindings,
  resolveNodeEventBindingTargets,
} from '../../../domain/component-designer/bindingEngine';
import { INSPECTOR_FIELD_HIGHLIGHT_CLASS } from '../../../domain/component-designer/inspectorFieldSearch';
import { InspectorEventBindingPanel } from './InspectorEventBindingPanel';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { INSPECTOR_TONE_TO_SURFACE_TONE } from './inspectorDesignTokens';

type InspectorInteractionsSectionProps = {
  node: DesignerNode;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
  /** Temporarily expand Behavior when field search hits this tier (T1-11b). */
  forceExpanded?: boolean;
  highlightedKeys?: ReadonlySet<string>;
  /**
   * When true, render event panels only (no AppSurfaceBox).
   * Live Designer Properties owns accordion chrome.
   */
  embedded?: boolean;
};

export const InspectorInteractionsSection: React.FC<InspectorInteractionsSectionProps> = ({
  node,
  document,
  bindingDefinitions,
  dispatch,
  forceExpanded = false,
  highlightedKeys,
  embedded = false,
}) => {
  const eventTargets = React.useMemo(() => resolveNodeEventBindingTargets(node), [node]);
  const activeEventCount = React.useMemo(() => countActiveNodeEventBindings(node), [node]);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setOpen(false);
  }, [node.id]);

  React.useEffect(() => {
    if (forceExpanded) {
      setOpen(true);
    }
  }, [forceExpanded, node.id]);

  if (eventTargets.length === 0) {
    return null;
  }

  const behaviorHighlighted = highlightedKeys?.has('behavior') === true;

  const eventPanels = eventTargets.map((targetEvent, index) => {
    const eventKey = `event:${targetEvent}`;
    const isHighlighted = highlightedKeys?.has(eventKey) === true;
    return (
      <div
        key={targetEvent}
        data-inspector-field={eventKey}
        data-inspector-field-match={isHighlighted ? 'true' : undefined}
        className={isHighlighted ? INSPECTOR_FIELD_HIGHLIGHT_CLASS : undefined}
      >
        {index > 0 ? <div className="border-t border-slate-100" /> : null}
        <InspectorEventBindingPanel
          node={node}
          document={document}
          bindingDefinitions={bindingDefinitions}
          targetEvent={targetEvent}
          dispatch={dispatch}
        />
      </div>
    );
  });

  return (
    <div
      className={behaviorHighlighted ? INSPECTOR_FIELD_HIGHLIGHT_CLASS : undefined}
      data-inspector-tier="behavior"
      data-inspector-field="behavior"
      data-inspector-field-match={behaviorHighlighted ? 'true' : undefined}
    >
      {embedded ? (
        <div className="space-y-4">{eventPanels}</div>
      ) : (
        <AppSurfaceBox
          layout="panel"
          tone={INSPECTOR_TONE_TO_SURFACE_TONE.neutral}
          collapsible
          open={open}
          onOpenChange={setOpen}
          title={(
            <span className="inline-flex items-center gap-2">
              Behavior
              {activeEventCount > 0 ? (
                <span
                  className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-100 px-1 text-[9px] font-bold normal-case tracking-normal text-indigo-700"
                  aria-label={`${activeEventCount} active event${activeEventCount === 1 ? '' : 's'}`}
                >
                  {activeEventCount}
                </span>
              ) : null}
            </span>
          )}
          bodyClassName="space-y-4"
        >
          {eventPanels}
        </AppSurfaceBox>
      )}
    </div>
  );
};
