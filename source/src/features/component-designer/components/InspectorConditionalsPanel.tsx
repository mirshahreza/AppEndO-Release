import * as React from 'react';
import type { DesignerAction } from '../../../domain/component-designer/types';
import type { DesignerNode } from '../../../domain/component-designer/types';
import { resolveNodeVisibilityAccess, formatNodeVisibilityAccessLabel } from '../../../domain/component-designer/designerNodeVisibilityAccess';
import { readNodeVisibleCondition } from '../../../domain/component-designer/visibilityConditionEngine';
import { type FunctionAccessControl } from '../../../shared/api/contracts/server-functions/accessControl';
import {
  ACCESS_CONTROL_ACTION_ARIA_LABEL,
  AccessControlActionIcon,
  AccessControlModal,
  AppButton,
  DesignerCodeEditorField,
  UiSelect,
} from '../../../shared/ui';
import { GRID_ACTION_ACCESS_CLASS } from '../../../shared/ui/surfaceClasses';
import { DesignerFieldRow } from './DesignerFieldRow';
import {
  INSPECTOR_TEXT_SM,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';

type InspectorConditionalsPanelProps = {
  node: DesignerNode;
  dispatch: React.Dispatch<DesignerAction>;
};

export const InspectorConditionalsPanel: React.FC<InspectorConditionalsPanelProps> = ({
  node,
  dispatch,
}) => {
  const [accessModalOpen, setAccessModalOpen] = React.useState(false);
  const [draftAccess, setDraftAccess] = React.useState<FunctionAccessControl>(() => (
    resolveNodeVisibilityAccess(node)
  ));
  const visibleCondition = readNodeVisibleCondition(node);
  const accessLabel = formatNodeVisibilityAccessLabel(node);

  React.useEffect(() => {
    if (!accessModalOpen) {
      setDraftAccess(resolveNodeVisibilityAccess(node));
    }
  }, [accessModalOpen, node]);

  return (
    <div className="space-y-2">
      <DesignerFieldRow label="Visible">
        <UiSelect
          size="sm"
          value={node.layout.visible !== false ? 'yes' : 'no'}
          onChange={(event) => dispatch({
            type: 'set-node-visibility',
            nodeId: node.id,
            visible: event.target.value === 'yes',
          })}
          ariaLabel="Render node on canvas"
        >
          <option value="yes">yes</option>
          <option value="no">no</option>
        </UiSelect>
      </DesignerFieldRow>

      <DesignerFieldRow label="Access">
        <div className="flex items-center gap-1.5">
          <div className={`min-w-0 flex-1 truncate rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white px-2 py-1.5 ${INSPECTOR_TEXT_SM} text-slate-700`}>
            {accessLabel}
          </div>
          <AppButton
            size="icon-sm"
            intent="utility"
            className={GRID_ACTION_ACCESS_CLASS}
            aria-label={ACCESS_CONTROL_ACTION_ARIA_LABEL}
            title={`${ACCESS_CONTROL_ACTION_ARIA_LABEL} — ${accessLabel}`}
            onClick={() => setAccessModalOpen(true)}
          >
            <AccessControlActionIcon />
          </AppButton>
        </div>
      </DesignerFieldRow>

      <DesignerFieldRow
        label="Custom expression"
        layout="stack"
        hint="Optional advanced rule using store.*, data.*, or dataContext.*. Overrides access rules above when edited."
      >
        <DesignerCodeEditorField
          ariaLabel="Visible when expression"
          language="javascript"
          editorHeight={96}
          lineNumbers={false}
          minimap={false}
          fontSize={12}
          placeholder="store.filters.countryId === 'US'"
          value={visibleCondition}
          onChange={(nextValue) =>
            dispatch({
              type: 'set-node-visible-condition',
              nodeId: node.id,
              visibleCondition: nextValue.trim().length > 0 ? nextValue : undefined,
            })
          }
        />
      </DesignerFieldRow>

      <AccessControlModal
        open={accessModalOpen}
        titlePath={node.type}
        accessControl={draftAccess}
        onChange={setDraftAccess}
        onClose={() => setAccessModalOpen(false)}
        onSave={() => {
          dispatch({
            type: 'set-node-visibility-access',
            nodeId: node.id,
            visibilityAccess: draftAccess,
          });
          setAccessModalOpen(false);
        }}
      />
    </div>
  );
};
