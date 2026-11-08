import React, { useMemo, useState } from 'react';
import { Check, Settings } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { useDashboardLayout } from '../../../contexts/DashboardLayoutContext';
import { cn } from '../../../lib/utils';
import {
  DASHBOARD_WIDGET_ACCENTS,
  DASHBOARD_WIDGET_HEADER_STYLES,
  isDashboardLayoutBlockId,
  isDashboardWidgetHeaderStyle,
} from '../../../shared/lib/userDashboardLayout';
import { FieldHintTooltip, FormField, NativeButton, UiRadioGroup, UiSwitch } from '../../../shared/ui';
import { ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_EDIT_CLASS } from '../../../shared/ui/surfaceClasses';
import { ShellResponsivePopover } from '../../../shared/ui/shell-foundation/ShellResponsivePopover';
import { resolveDashboardWidgetCatalogEntry } from '../dashboardWidgetCatalog';
import {
  DASHBOARD_WIDGET_ACCENT_SWATCH_CLASS,
  resolveDashboardWidgetChrome,
} from '../dashboardWidgetChrome';
import { resolveHomeWidgetRegistryEntry } from '../homeWidgetRegistry';
import { useOptionalDashboardSortableWidget } from './DashboardSortableWidgetContext';

const SWATCH_BUTTON_CLASS =
  'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 p-0 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2';

const SETTINGS_ROW_LABEL_CLASS = 'text-[11px] font-semibold leading-snug text-slate-700';

type WidgetSettingsSwitchRowProps = {
  label: string;
  hint?: string;
  isSelected: boolean;
  isDisabled?: boolean;
  onChange: (selected: boolean) => void;
};

const WidgetSettingsSwitchRow: React.FC<WidgetSettingsSwitchRowProps> = ({
  label,
  hint,
  isSelected,
  isDisabled,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex min-w-0 flex-1 items-center gap-0.5">
      <span className={SETTINGS_ROW_LABEL_CLASS}>{label}</span>
      {hint ? <FieldHintTooltip hint={hint} label={label} /> : null}
    </div>
    <UiSwitch
      aria-label={label}
      isSelected={isSelected}
      isDisabled={isDisabled}
      className="shrink-0"
      onChange={onChange}
    />
  </div>
);

type DashboardWidgetSettingsButtonProps = {
  className?: string;
  onOpenChange?: (open: boolean) => void;
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
};

export const DashboardWidgetSettingsButton: React.FC<DashboardWidgetSettingsButtonProps> = ({
  className,
  onOpenChange,
  onPointerDown,
}) => {
  const t = useCultureT();
  const sortable = useOptionalDashboardSortableWidget();
  const { widgetChrome, setWidgetChrome, homeWidgetRegistry } = useDashboardLayout();
  const [open, setOpen] = useState(false);
  const widgetId = sortable?.widgetId;

  const widgetTitle = useMemo(() => {
    if (!widgetId) {
      return '';
    }
    if (isDashboardLayoutBlockId(widgetId)) {
      const catalogEntry = resolveDashboardWidgetCatalogEntry(widgetId);
      if (catalogEntry) {
        return t(catalogEntry.labelKey);
      }
    }
    const registryEntry = resolveHomeWidgetRegistryEntry(homeWidgetRegistry, widgetId);
    return registryEntry?.catalog.title ?? widgetId;
  }, [homeWidgetRegistry, t, widgetId]);

  if (!sortable || !widgetId) {
    return null;
  }

  const chrome = resolveDashboardWidgetChrome(widgetId, widgetChrome);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const patchChrome = (patch: Parameters<typeof setWidgetChrome>[1]) => {
    setWidgetChrome(widgetId, patch);
  };

  return (
    <ShellResponsivePopover
      open={open}
      onOpenChange={handleOpenChange}
      placement="top-end"
      fallbackPlacement="bottom-end"
      portal
      dismissOnOutside
      dismissOnEscape
      ariaLabel={`${widgetTitle} — ${t('dashboard.layout.widgetSettings')}`}
      className="w-80 max-w-[calc(100vw-2rem)] max-h-[min(24rem,calc(100dvh-2rem))] !overflow-y-auto p-0"
      trigger={(
        <NativeButton
          type="button"
          className={cn(
            ICON_ACTION_BUTTON_SM_CLASS,
            ICON_ACTION_EDIT_CLASS,
            'cursor-pointer border-0 bg-transparent p-0',
            className,
          )}
          aria-label={t('dashboard.layout.widgetSettings')}
          aria-expanded={open}
          onPointerDown={onPointerDown}
        >
          <Settings className="h-3.5 w-3.5" strokeWidth={1.75} />
        </NativeButton>
      )}
    >
      <div className="flex flex-col">
        <div className="border-b border-divider px-3 py-2.5">
          <p className="truncate text-sm font-semibold text-slate-900">{widgetTitle}</p>
          <p className="text-[11px] font-medium text-slate-500">{t('dashboard.layout.widgetSettings')}</p>
        </div>
        <div className="flex flex-col gap-4 px-3 py-3">
          <FormField
            label={t('dashboard.layout.widgetSettings.color')}
            hint={t('dashboard.layout.widgetSettings.colorHint')}
            reserveHintSlot={false}
          >
            <div
              className="grid grid-cols-4 gap-2"
              role="radiogroup"
              aria-label={t('dashboard.layout.widgetSettings.color')}
            >
              <NativeButton
                type="button"
                role="radio"
                aria-checked={!chrome.accent}
                aria-label={t('dashboard.layout.widgetSettings.accent.default')}
                className={cn(
                  SWATCH_BUTTON_CLASS,
                  'border-dashed bg-white',
                  !chrome.accent
                    ? 'border-slate-700 bg-slate-50'
                    : 'border-slate-300',
                )}
                onClick={() => patchChrome({ accent: undefined })}
              >
                {!chrome.accent ? (
                  <Check className="h-3.5 w-3.5 text-slate-700" strokeWidth={2.5} aria-hidden />
                ) : null}
              </NativeButton>
              {DASHBOARD_WIDGET_ACCENTS.map((accent) => {
                const selected = chrome.accent === accent;
                return (
                  <NativeButton
                    key={accent}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={t(`dashboard.layout.widgetSettings.accent.${accent}`)}
                    className={cn(
                      SWATCH_BUTTON_CLASS,
                      DASHBOARD_WIDGET_ACCENT_SWATCH_CLASS[accent],
                      selected ? 'border-slate-800' : 'border-white ring-1 ring-slate-200',
                    )}
                    onClick={() => patchChrome({
                      accent: selected ? undefined : accent,
                    })}
                  >
                    {selected ? (
                      <Check className="h-3.5 w-3.5 text-white drop-shadow-sm" strokeWidth={2.5} aria-hidden />
                    ) : null}
                  </NativeButton>
                );
              })}
            </div>
          </FormField>

          <div className="space-y-3 border-t border-slate-100 pt-3">
            <WidgetSettingsSwitchRow
              label={t('dashboard.layout.widgetSettings.showHeader')}
              isSelected={chrome.showHeader}
              onChange={(selected) => patchChrome({ showHeader: selected })}
            />
            <div
              className={cn(
                'space-y-2 rounded-md bg-slate-50/80 px-2.5 py-2',
                !chrome.showHeader && 'pointer-events-none opacity-45',
              )}
              aria-hidden={!chrome.showHeader}
            >
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {t('dashboard.layout.widgetSettings.headerStyle')}
                </span>
                <FieldHintTooltip
                  hint={t('dashboard.layout.widgetSettings.headerStyleHint')}
                  label={t('dashboard.layout.widgetSettings.headerStyle')}
                />
              </div>
              <UiRadioGroup
                ariaLabel={t('dashboard.layout.widgetSettings.headerStyle')}
                orientation="vertical"
                isDisabled={!chrome.showHeader}
                value={chrome.headerStyle}
                onChange={(value) => {
                  if (isDashboardWidgetHeaderStyle(value)) {
                    patchChrome({ headerStyle: value });
                  }
                }}
                options={DASHBOARD_WIDGET_HEADER_STYLES.map((style) => ({
                  value: style,
                  label: t(`dashboard.layout.widgetSettings.headerStyle.${style}`),
                }))}
              />
            </div>
            <WidgetSettingsSwitchRow
              label={t('dashboard.layout.widgetSettings.lockSize')}
              isSelected={chrome.lockSize}
              onChange={(selected) => patchChrome({ lockSize: selected })}
            />
            <WidgetSettingsSwitchRow
              label={t('dashboard.layout.widgetSettings.hideWhenEmpty')}
              hint={t('dashboard.layout.widgetSettings.hideWhenEmptyHint')}
              isSelected={chrome.hideWhenEmpty}
              onChange={(selected) => patchChrome({ hideWhenEmpty: selected })}
            />
          </div>
        </div>
      </div>
    </ShellResponsivePopover>
  );
};
