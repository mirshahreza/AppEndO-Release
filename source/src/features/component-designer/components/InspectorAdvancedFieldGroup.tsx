import * as React from 'react';
import { InspectorMoreButton } from './InspectorMoreButton';
import { InspectorSectionValueBadge } from './inspectorFieldPrimitives';

export type InspectorAdvancedFieldGroupProps = {
  primary: React.ReactNode;
  advanced: React.ReactNode;
  hasAdvanced?: boolean;
  defaultShowAdvanced?: boolean;
  /** Force-expand (e.g. inspector field search hit) without fighting the toggle. */
  forceShowAdvanced?: boolean;
  /** When true and advanced is collapsed, show a non-default value cue (Phase 3). */
  hasAdvancedValues?: boolean;
};

export const InspectorAdvancedFieldGroup: React.FC<InspectorAdvancedFieldGroupProps> = ({
  primary,
  advanced,
  hasAdvanced = true,
  defaultShowAdvanced = false,
  forceShowAdvanced = false,
  hasAdvancedValues = false,
}) => {
  const [showAdvanced, setShowAdvanced] = React.useState(defaultShowAdvanced);

  React.useEffect(() => {
    setShowAdvanced(defaultShowAdvanced);
  }, [defaultShowAdvanced]);

  const revealAdvanced = showAdvanced || forceShowAdvanced;

  return (
    <div className="space-y-2">
      {primary}
      {hasAdvanced && revealAdvanced ? advanced : null}
      {hasAdvanced ? (
        <div className="flex items-center justify-center gap-1.5 pt-0.5">
          {!revealAdvanced && hasAdvancedValues ? (
            <InspectorSectionValueBadge active />
          ) : null}
          <InspectorMoreButton expanded={revealAdvanced} onToggle={() => setShowAdvanced((previous) => !previous)} />
        </div>
      ) : null}
    </div>
  );
};
