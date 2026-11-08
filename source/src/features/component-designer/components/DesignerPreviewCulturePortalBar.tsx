import * as React from 'react';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { ExperienceManifestPortal } from '../../../shared/api/contracts/platform/experienceManifest';
import { AppButton } from '../../../shared/ui';
import {
  SPLIT_BUTTON_MENU_ITEM_CLASS,
  SPLIT_BUTTON_MENU_PANEL_CLASS,
  useSplitButtonMenu,
} from '../../../shared/ui/AppSplitButton';

const PREVIEW_BAR_LABEL_CLASS = 'ps-[4px] text-[10px] font-semibold text-slate-600';

type PreviewBarDropdownOption = {
  value: string;
  label: string;
};

type PreviewBarDropdownProps = {
  options: PreviewBarDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
};

const PreviewBarDropdown: React.FC<PreviewBarDropdownProps> = ({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = useSplitButtonMenu(isOpen, setIsOpen);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const displayLabel = selectedOption?.label ?? value;

  return (
    <div ref={menuRef} className="relative min-w-0 flex-1" data-preview-bar-dropdown>
      <button
        type="button"
        className={cn(
          'flex h-6 w-full min-w-0 items-center gap-0.5 rounded px-1 text-[11px] text-slate-700 transition-colors',
          disabled
            ? 'cursor-not-allowed opacity-60'
            : 'hover:bg-white/80 hover:text-slate-900',
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${ariaLabel}: ${displayLabel}`}
        title={displayLabel}
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => {
          if (!disabled) {
            setIsOpen((open) => !open);
          }
        }}
      >
        <span className="min-w-0 flex-1 truncate text-right font-medium">{displayLabel}</span>
        <ChevronDown
          className={cn('h-3 w-3 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')}
          aria-hidden
        />
      </button>

      {isOpen ? (
        <div
          className={cn(
            SPLIT_BUTTON_MENU_PANEL_CLASS,
            'left-0 right-0 top-[calc(100%+2px)] z-50 max-h-48 overflow-y-auto py-1',
          )}
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value || '__default__'}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={cn(
                  SPLIT_BUTTON_MENU_ITEM_CLASS,
                  'gap-2',
                  isSelected && 'bg-indigo-50 text-indigo-700',
                )}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{option.label}</span>
                {isSelected ? <Check className="h-3 w-3 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export type DesignerPreviewCulturePortalBarProps = {
  cultureOptions: string[];
  portalOptions: ExperienceManifestPortal[];
  selectedCultureId: string;
  selectedPortalSegment: string;
  componentName: string;
  onCultureChange: (cultureId: string) => void;
  onPortalChange: (portalSegment: string) => void;
  previewRtlEnabled?: boolean;
  onPreviewRtlToggle?: () => void;
  disabled?: boolean;
};

export const DesignerPreviewCulturePortalBar: React.FC<DesignerPreviewCulturePortalBarProps> = ({
  cultureOptions,
  portalOptions,
  selectedCultureId,
  selectedPortalSegment,
  componentName,
  onCultureChange,
  onPortalChange,
  previewRtlEnabled = false,
  onPreviewRtlToggle,
  disabled = false,
}) => {
  const cultureDropdownOptions = React.useMemo<PreviewBarDropdownOption[]>(
    () => [
      { value: '', label: 'Default (us)' },
      ...cultureOptions.map((cultureId) => ({ value: cultureId, label: cultureId })),
    ],
    [cultureOptions],
  );

  const portalDropdownOptions = React.useMemo<PreviewBarDropdownOption[]>(
    () => portalOptions.map((portal) => ({ value: portal.segment, label: portal.name })),
    [portalOptions],
  );

  return (
    <div className="grid h-[34px] shrink-0 grid-cols-[1fr_1fr_1fr_auto] border-b border-border-subtle bg-slate-50/80">
      <div className="flex min-w-0 items-center gap-[2px] border-r border-border-subtle px-2">
        <span className={`${PREVIEW_BAR_LABEL_CLASS} shrink-0`}>Culture</span>
        <PreviewBarDropdown
          options={cultureDropdownOptions}
          value={selectedCultureId}
          onChange={onCultureChange}
          ariaLabel="Culture"
          disabled={disabled}
        />
      </div>

      <div className="flex min-w-0 items-center gap-[2px] border-r border-border-subtle px-2">
        <span className={`${PREVIEW_BAR_LABEL_CLASS} shrink-0`}>Portal</span>
        <PreviewBarDropdown
          options={portalDropdownOptions}
          value={selectedPortalSegment}
          onChange={onPortalChange}
          ariaLabel="Portal"
          disabled={disabled}
        />
      </div>

      <div className="flex min-w-0 items-center gap-[2px] px-2">
        <span className={`${PREVIEW_BAR_LABEL_CLASS} shrink-0`}>Component</span>
        <span
          className="min-w-0 flex-1 truncate text-right text-[11px] font-medium text-slate-700"
          title={componentName}
        >
          {componentName}
        </span>
      </div>

      <div className="flex items-center border-l border-border-subtle px-2">
        <AppButton
          type="button"
          intent={previewRtlEnabled ? 'primary' : 'secondary'}
          size="sm"
          className="h-6 px-2 text-[10px] font-semibold"
          aria-pressed={previewRtlEnabled}
          aria-label="Toggle RTL preview layout"
          title="Toggle RTL preview layout"
          disabled={disabled || !onPreviewRtlToggle}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onPreviewRtlToggle}
        >
          <Languages className="h-3.5 w-3.5" />
          RTL
        </AppButton>
      </div>
    </div>
  );
};
