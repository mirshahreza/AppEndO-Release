import * as React from 'react';
import { ImageIcon, X } from 'lucide-react';
import { toLucidePascalCase } from '../../../shared/lib/lucideIconRegistry';
import {
  formatNavigationIconRef,
  parseNavigationIconRef,
} from '../../../shared/lib/navigationIcons/navigationIconRef';
import { resolveDesignerGridActionIcon } from '../../../domain/component-designer/designerGridActionColumns';
import { AppButton } from '../../../shared/ui/AppButton';
import { NavigationIconPickerDialog } from '../../platform-navigations/components/dialogs/NavigationIconPickerDialog';
import {
  INSPECTOR_TEXT_XS,
  NESTED_LAYER_DIVIDER_CLASS,
} from './inspectorDesignTokens';
import { InspectorMicroLabel } from './inspectorFieldPrimitives';

type InspectorLucideIconPickerFieldProps = {
  label?: string;
  value?: string;
  onChange: (iconName: string) => void;
  ariaLabel?: string;
  fallbackIcon?: string;
  /** Icon-only trigger — hides the wide name button. */
  compact?: boolean;
  /** Show a tiny clear control when an icon is set. */
  clearable?: boolean;
};

const toStoredLucideIconName = (iconRef: string): string => {
  const parsed = parseNavigationIconRef(iconRef);
  if (!parsed) {
    return 'Settings2';
  }
  return toLucidePascalCase(parsed.iconName);
};

const toPickerIconRef = (iconName?: string): string | undefined => {
  const trimmed = iconName?.trim();
  if (!trimmed) {
    return undefined;
  }
  const kebab = trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
  return formatNavigationIconRef('lucide', kebab);
};

export const InspectorLucideIconPickerField: React.FC<InspectorLucideIconPickerFieldProps> = ({
  label = 'Icon',
  value,
  onChange,
  ariaLabel,
  fallbackIcon = 'Settings2',
  compact = false,
  clearable = false,
}) => {
  const [open, setOpen] = React.useState(false);
  const hasValue = Boolean(value?.trim());
  const resolvedIconName = hasValue ? value!.trim() : fallbackIcon;
  const Icon = hasValue ? resolveDesignerGridActionIcon(resolvedIconName) : ImageIcon;
  const chooseLabel = ariaLabel ?? (label.trim() ? `Choose ${label.toLowerCase()}` : 'Choose icon');

  const clearControl = clearable && hasValue ? (
    <button
      type="button"
      aria-label="Remove icon"
      title="Remove icon"
      className="absolute -end-1 -top-1 z-[1] inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:border-rose-200 hover:text-rose-600"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onChange('');
      }}
    >
      <X className="h-2 w-2" strokeWidth={2.5} aria-hidden="true" />
    </button>
  ) : null;

  return (
    <div className="flex flex-col gap-[2px]">
      {label.trim() ? <InspectorMicroLabel>{label}</InspectorMicroLabel> : null}
      {compact ? (
        <div className="relative inline-flex shrink-0">
          <AppButton
            type="button"
            size="sm"
            intent="secondary"
            className="!h-8 !w-8 !min-w-8 !px-0"
            aria-label={chooseLabel}
            title={hasValue ? resolvedIconName : 'No icon'}
            onClick={() => setOpen(true)}
          >
            <Icon className={`h-4 w-4 ${hasValue ? '' : 'text-slate-400'}`} aria-hidden="true" />
          </AppButton>
          {clearControl}
        </div>
      ) : (
        <div className="relative flex items-center gap-2">
          <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${NESTED_LAYER_DIVIDER_CLASS} bg-slate-50 text-slate-600`}>
            <Icon className={`h-4 w-4 ${hasValue ? '' : 'text-slate-400'}`} aria-hidden="true" />
          </span>
          <AppButton
            type="button"
            size="sm"
            intent="secondary"
            className="min-w-0 flex-1 justify-start"
            aria-label={chooseLabel}
            onClick={() => setOpen(true)}
          >
            <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className={`truncate font-mono ${INSPECTOR_TEXT_XS}`}>
              {hasValue ? resolvedIconName : 'No icon'}
            </span>
          </AppButton>
          {clearControl}
        </div>
      )}
      <NavigationIconPickerDialog
        open={open}
        selectedIcon={toPickerIconRef(hasValue ? resolvedIconName : undefined)}
        onClose={() => setOpen(false)}
        onSelect={(iconRef) => onChange(toStoredLucideIconName(iconRef))}
      />
    </div>
  );
};
