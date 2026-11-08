import React, { useEffect, useState } from 'react';
import { Search, Trash2, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  NAVIGATION_ITEM_REGIONS,
  type NavigationItemRegion,
  type NavigationManifestItem,
} from '../../../shared/api/contracts/platform/navigation';
import {
  parsePlatformRouteBindingAuth,
  platformAuthFromAccessControl,
} from '../../../shared/api/contracts/platform/platformAccessControl';
import { formatAccessControlLabel } from '../../../shared/api/contracts/server-functions/accessControl';
import type { FunctionAccessControl } from '../../../shared/api/contracts/server-functions/accessControl';
import { resolveNavigationRoutePatternForPageKey } from '../../../shared/lib/navigationItemTargets';
import {
  ACCESS_CONTROL_ACTION_ARIA_LABEL,
  AccessControlActionIcon,
  AccessControlModal,
  AppButton,
  UiInput,
  UiSelect,
} from '../../../shared/ui';
import { GRID_ACTION_ACCESS_CLASS } from '../../../shared/ui/surfaceClasses';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import { formatNavigationIconRefLabel } from '../../../shared/lib/navigationIcons/navigationIconRef';
import {
  findNavigationComponentOption,
  isNavigationRedirectPortal,
  NAVIGATION_DEFAULT_OPTION_LABEL,
  NAVIGATION_DEFAULT_OPTION_VALUE,
  navigationSelectValueToNullable,
  useNavigationEditorOptions,
} from '../hooks/useNavigationEditorOptions';
import type { NavigationManifestEditorModel } from '../hooks/useNavigationManifestEditor';
import {
  NAV_DEFAULT_ICON_COLOR,
  NAV_DEFAULT_LABEL_COLOR,
} from '../constants';
import { resolveNavColor } from '../lib/navigationTailwindColorOptions';
import { NavigationComponentPickerDialog } from './dialogs/NavigationComponentPickerDialog';
import { NavigationIconPickerDialog } from './dialogs/NavigationIconPickerDialog';
import {
  NavigationGroupedField,
  NavigationGroupedPickerButton,
  NAVIGATION_GROUPED_FIELD_DISPLAY_CLASS,
  NAVIGATION_GROUPED_FIELD_INPUT_CLASS,
} from './NavigationGroupedField';
import { NavigationTailwindColorPicker } from './NavigationTailwindColorPicker';

const FIELD_CLASS = 'flex flex-col gap-[2px]';
const LABEL_CLASS = 'ps-[4px] text-xs font-semibold text-slate-600';

const NAVIGATION_ITEM_REGION_LABELS: Record<NavigationItemRegion, string> = {
  side: 'Side (main sidebar)',
  'sidebar-footer': 'Sidebar footer',
  header: 'Header utilities',
};

type NavigationItemEditorPanelProps = {
  page: NavigationManifestEditorModel;
  groupIndex: number;
  itemPath: number[];
  item: NavigationManifestItem;
};

export const NavigationItemEditorPanel: React.FC<NavigationItemEditorPanelProps> = ({
  page,
  groupIndex,
  itemPath,
  item,
}) => {
  const editorOptions = useNavigationEditorOptions(Boolean(page.editorId));
  const [componentPickerOpen, setComponentPickerOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [draftAccess, setDraftAccess] = useState<FunctionAccessControl>(() => (
    parsePlatformRouteBindingAuth(item.auth)
  ));

  useEffect(() => {
    if (!accessModalOpen) {
      return;
    }
    setDraftAccess(parsePlatformRouteBindingAuth(item.auth));
  }, [accessModalOpen, item.auth]);

  const selectedComponent = findNavigationComponentOption(
    item.pageKey,
    editorOptions.componentOptions,
    editorOptions.designerDrafts,
  );
  const iconLabel = formatNavigationIconRefLabel(item.icon);
  const labelColor = resolveNavColor(item.labelColor, NAV_DEFAULT_LABEL_COLOR);
  const iconColor = resolveNavColor(item.iconColor, NAV_DEFAULT_ICON_COLOR);
  const isRedirectPortal = isNavigationRedirectPortal(
    item.portalSegment,
    editorOptions.portalOptions,
  );

  const updateItem = (patch: Partial<NavigationManifestItem>) => {
    page.updateDraftItem(groupIndex, itemPath, patch);
  };

  const handleCultureChange = (value: string) => {
    updateItem({ cultureId: navigationSelectValueToNullable(value) });
  };

  const handleRegionChange = (value: string) => {
    updateItem({
      region: value === 'side' ? undefined : value as NavigationItemRegion,
    });
  };

  const handlePortalChange = (value: string) => {
    const portalSegment = navigationSelectValueToNullable(value);
    const nextPatch: Partial<NavigationManifestItem> = { portalSegment };

    if (isNavigationRedirectPortal(portalSegment, editorOptions.portalOptions)) {
      nextPatch.pageKey = undefined;
      nextPatch.routePattern = undefined;
    } else if (item.pageKey?.trim() && editorOptions.runtimeConfig) {
      nextPatch.routePattern = resolveNavigationRoutePatternForPageKey(
        editorOptions.runtimeConfig,
        item.pageKey,
        portalSegment,
        editorOptions.designerDrafts,
      );
    }

    updateItem(nextPatch);
  };

  const handleComponentClear = () => {
    updateItem({ pageKey: undefined, routePattern: undefined });
  };

  const handleComponentSelect = (pageKey: string) => {
    if (!editorOptions.runtimeConfig) {
      updateItem({ pageKey });
      return;
    }

    updateItem({
      pageKey,
      routePattern: resolveNavigationRoutePatternForPageKey(
        editorOptions.runtimeConfig,
        pageKey,
        item.portalSegment,
        editorOptions.designerDrafts,
      ),
    });
  };

  return (
    <>
      <div className={FIELD_CLASS}>
        <label className={LABEL_CLASS}>Label</label>
        <NavigationGroupedField
          leading={(
            <NavigationTailwindColorPicker
              value={labelColor}
              defaultColor={NAV_DEFAULT_LABEL_COLOR}
              ariaLabel="Label color"
              onChange={(nextValue) => updateItem({ labelColor: nextValue })}
            />
          )}
        >
          <UiInput
            size="sm"
            aiAssist={false}
            className={cn(
              NAVIGATION_GROUPED_FIELD_INPUT_CLASS,
              '!rounded-none !border-0 !bg-transparent !shadow-none',
            )}
            value={item.label ?? ''}
            placeholder="Navigation label"
            ariaLabel="Navigation label"
            onChange={(event) => updateItem({ label: event.target.value })}
          />
        </NavigationGroupedField>
      </div>

      <div className={FIELD_CLASS}>
        <label className={LABEL_CLASS}>Collapsed label</label>
        <UiInput
          size="sm"
          aiAssist={false}
          value={item.collapsedLabel ?? ''}
          placeholder="Optional rail label (max 6 visible)"
          ariaLabel="Collapsed sidebar label"
          onChange={(event) => updateItem({ collapsedLabel: event.target.value.trim() || undefined })}
        />
      </div>

      <div className={FIELD_CLASS}>
        <label className={LABEL_CLASS}>Culture</label>
        <UiSelect
          size="sm"
          value={item.cultureId?.trim() || NAVIGATION_DEFAULT_OPTION_VALUE}
          onChange={(event) => handleCultureChange(event.target.value)}
        >
          <option value={NAVIGATION_DEFAULT_OPTION_VALUE}>{NAVIGATION_DEFAULT_OPTION_LABEL}</option>
          {editorOptions.cultureOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </UiSelect>
      </div>

      <div className={FIELD_CLASS}>
        <label className={LABEL_CLASS}>Portal</label>
        <UiSelect
          size="sm"
          value={item.portalSegment?.trim() || NAVIGATION_DEFAULT_OPTION_VALUE}
          onChange={(event) => handlePortalChange(event.target.value)}
        >
          <option value={NAVIGATION_DEFAULT_OPTION_VALUE}>{NAVIGATION_DEFAULT_OPTION_LABEL}</option>
          {editorOptions.portalOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </UiSelect>
      </div>

      <div className={FIELD_CLASS}>
        <label className={LABEL_CLASS}>Location</label>
        <UiSelect
          size="sm"
          value={item.region ?? 'side'}
          onChange={(event) => handleRegionChange(event.target.value)}
        >
          {NAVIGATION_ITEM_REGIONS.map((region) => (
            <option key={region} value={region}>{NAVIGATION_ITEM_REGION_LABELS[region]}</option>
          ))}
        </UiSelect>
      </div>

      <div className={FIELD_CLASS}>
        <label className={LABEL_CLASS}>Component</label>
        <NavigationGroupedField
          disabled={isRedirectPortal}
          trailing={!isRedirectPortal ? (
            <div className="flex items-stretch">
              {(selectedComponent || item.pageKey?.trim()) ? (
                <NavigationGroupedPickerButton
                  ariaLabel="Clear component"
                  onClick={handleComponentClear}
                >
                  <X className="h-3.5 w-3.5" />
                </NavigationGroupedPickerButton>
              ) : null}
              <NavigationGroupedPickerButton
                ariaLabel="Select component"
                onClick={() => setComponentPickerOpen(true)}
              >
                <Search className="h-3.5 w-3.5" />
              </NavigationGroupedPickerButton>
            </div>
          ) : undefined}
        >
          <div
            className={cn(
              NAVIGATION_GROUPED_FIELD_DISPLAY_CLASS,
              isRedirectPortal && 'text-slate-400',
            )}
          >
            <span className="truncate">
              {isRedirectPortal
                ? 'Not applicable for redirect portals'
                : selectedComponent
                  ? `${selectedComponent.title} (${selectedComponent.loaderRef})`
                  : item.pageKey?.trim() || 'Not selected'}
            </span>
          </div>
        </NavigationGroupedField>
      </div>

      <div className={FIELD_CLASS}>
        <label className={LABEL_CLASS}>Icon</label>
        <NavigationGroupedField
          leading={(
            <NavigationTailwindColorPicker
              value={iconColor}
              defaultColor={NAV_DEFAULT_ICON_COLOR}
              ariaLabel="Icon color"
              onChange={(nextValue) => updateItem({ iconColor: nextValue })}
            />
          )}
          trailing={(
            <NavigationGroupedPickerButton
              ariaLabel="Select icon"
              onClick={() => setIconPickerOpen(true)}
            >
              <Search className="h-3.5 w-3.5" />
            </NavigationGroupedPickerButton>
          )}
        >
          <div className={NAVIGATION_GROUPED_FIELD_DISPLAY_CLASS}>
            <NavigationIcon iconRef={item.icon} className="h-4 w-4 shrink-0 text-slate-600" />
            <span className="truncate font-mono text-[11px]">
              {iconLabel}
            </span>
          </div>
        </NavigationGroupedField>
      </div>

      <div className={FIELD_CLASS}>
        <label className={LABEL_CLASS}>Access</label>
        <NavigationGroupedField
          trailing={(
            <NavigationGroupedPickerButton
              ariaLabel={ACCESS_CONTROL_ACTION_ARIA_LABEL}
              className={GRID_ACTION_ACCESS_CLASS}
              onClick={() => setAccessModalOpen(true)}
            >
              <AccessControlActionIcon />
            </NavigationGroupedPickerButton>
          )}
        >
          <div className={NAVIGATION_GROUPED_FIELD_DISPLAY_CLASS}>
            <span className="truncate text-xs text-slate-700">
              {item.auth
                ? formatAccessControlLabel(parsePlatformRouteBindingAuth(item.auth))
                : 'Route default'}
            </span>
          </div>
        </NavigationGroupedField>
      </div>

      <div className="mt-2 pt-4">
        <AppButton
          intent="destructive"
          size="sm"
          className="self-start"
          onClick={() => page.editorActions.removeItem(groupIndex, itemPath)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove item
        </AppButton>
      </div>

      <AccessControlModal
        open={accessModalOpen}
        titlePath={item.label?.trim() || 'Navigation item'}
        accessControl={draftAccess}
        onChange={setDraftAccess}
        onClose={() => setAccessModalOpen(false)}
        onSave={() => {
          updateItem({ auth: platformAuthFromAccessControl(draftAccess) });
          setAccessModalOpen(false);
        }}
      />

      <NavigationComponentPickerDialog
        open={componentPickerOpen && !isRedirectPortal}
        components={editorOptions.componentOptions}
        selectedPageKey={item.pageKey}
        onClose={() => setComponentPickerOpen(false)}
        onSelect={handleComponentSelect}
      />

      <NavigationIconPickerDialog
        open={iconPickerOpen}
        selectedIcon={item.icon}
        onClose={() => setIconPickerOpen(false)}
        onSelect={(icon) => updateItem({ icon })}
      />
    </>
  );
};
