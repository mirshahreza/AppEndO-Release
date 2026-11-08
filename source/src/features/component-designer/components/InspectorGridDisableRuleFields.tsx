import * as React from 'react';
import {
  DESIGNER_GRID_ROW_DISABLE_PRESET_OPTIONS,
  type DesignerGridRowDisablePreset,
  type DesignerGridRowDisableRule,
} from '../../../domain/component-designer/designerGridRowDisableRules';
import { UiInput, UiSelect } from '../../../shared/ui';
import {
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';
import { InspectorMicroLabel } from './inspectorFieldPrimitives';

type InspectorGridDisableRuleFieldsProps = {
  label?: string;
  rule: DesignerGridRowDisableRule | undefined;
  onChange: (rule: DesignerGridRowDisableRule | undefined) => void;
  fieldKey: string;
};

const readRule = (rule: DesignerGridRowDisableRule | undefined): DesignerGridRowDisableRule => ({
  preset: rule?.preset ?? 'none',
  field: rule?.field,
  matchField: rule?.matchField,
  role: rule?.role,
  expression: rule?.expression,
});

export const InspectorGridDisableRuleFields: React.FC<InspectorGridDisableRuleFieldsProps> = ({
  label = 'Disabled when',
  rule,
  onChange,
  fieldKey,
}) => {
  const resolved = readRule(rule);

  const emitChange = (patch: Partial<DesignerGridRowDisableRule>) => {
    const next = { ...resolved, ...patch };
    if (next.preset === 'none') {
      onChange(undefined);
      return;
    }
    onChange({
      preset: next.preset,
      ...(next.field ? { field: next.field } : {}),
      ...(next.matchField ? { matchField: next.matchField } : {}),
      ...(next.role ? { role: next.role } : {}),
      ...(next.expression ? { expression: next.expression } : {}),
    });
  };

  return (
    <div className={`col-span-2 flex flex-col gap-2 rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-white p-2`}>
      <div className="flex flex-col gap-[2px]">
        <InspectorMicroLabel>{label}</InspectorMicroLabel>
        <UiSelect
          size="sm"
          nested
          className="w-full bg-white text-slate-700"
          value={resolved.preset}
          onChange={(event) => emitChange({
            preset: event.target.value as DesignerGridRowDisablePreset,
          })}
        >
          {DESIGNER_GRID_ROW_DISABLE_PRESET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </UiSelect>
      </div>

      {resolved.preset === 'builtin-field' ? (
        <div className="flex flex-col gap-[2px]">
          <InspectorMicroLabel>Boolean field</InspectorMicroLabel>
          <UiInput
            size="sm"
            nested
            className={`w-full bg-white font-mono ${INSPECTOR_TEXT_XS}`}
            value={resolved.field ?? 'is_builtin'}
            onChange={(event) => emitChange({ field: event.target.value })}
            ariaLabel={`${fieldKey}:disable-field`}
          />
        </div>
      ) : null}

      {resolved.preset === 'current-user-row' ? (
        <div className="flex flex-col gap-[2px]">
          <InspectorMicroLabel>Match row field</InspectorMicroLabel>
          <UiInput
            size="sm"
            nested
            className={`w-full bg-white font-mono ${INSPECTOR_TEXT_XS}`}
            value={resolved.matchField ?? resolved.field ?? 'id'}
            onChange={(event) => emitChange({ matchField: event.target.value, field: undefined })}
            ariaLabel={`${fieldKey}:disable-match-field`}
            autoDir={false}
          />
        </div>
      ) : null}

      {resolved.preset === 'has-role' ? (
        <div className="flex flex-col gap-[2px]">
          <InspectorMicroLabel>Role</InspectorMicroLabel>
          <UiInput
            size="sm"
            nested
            className={`w-full bg-white font-mono ${INSPECTOR_TEXT_XS}`}
            value={resolved.role ?? 'ADMIN'}
            onChange={(event) => emitChange({ role: event.target.value })}
            ariaLabel={`${fieldKey}:disable-role`}
            autoDir={false}
          />
        </div>
      ) : null}

      {resolved.preset === 'expression' ? (
        <div className="flex flex-col gap-[2px]">
          <InspectorMicroLabel>Expression</InspectorMicroLabel>
          <UiInput
            size="sm"
            nested
            className={`w-full bg-white font-mono ${INSPECTOR_TEXT_XS}`}
            placeholder="row.is_builtin || row.roles.includes('ADMIN')"
            value={resolved.expression ?? ''}
            onChange={(event) => emitChange({ expression: event.target.value })}
            ariaLabel={`${fieldKey}:disable-expression`}
            autoDir={false}
          />
        </div>
      ) : null}
    </div>
  );
};
