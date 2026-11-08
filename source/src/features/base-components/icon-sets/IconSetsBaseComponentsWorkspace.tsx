import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy } from 'lucide-react';
import {
  FormField,
  FormSection,
  UiInput,
  UiSelect,
} from '../../../shared/ui';
import type { AppSurfaceBoxTone } from '../../../shared/ui/surfaceClasses';
import { cn } from '../../../lib/utils';
import {
  formatNavigationIconRef,
  formatNavigationIconRefLabel,
} from '../../../shared/lib/navigationIcons/navigationIconRef';
import { NAVIGATION_ICON_PACKS, loadNavigationIconPack } from '../../../shared/lib/navigationIcons/navigationIconPacks';
import { getIconPackManifestEntry } from '../../../shared/lib/navigationIcons/iconPackManifest';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import type { NavigationIconPackId } from '../../../shared/lib/navigationIcons/types';
import { useNavigationIconPackEntries } from '../../../shared/lib/navigationIcons/useNavigationIconPackEntries';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import { BASE_COMPONENTS_WORKSPACE_INSET_CLASS } from '../components/BaseComponentsWorkspacePanel';
import { BaseComponentsResetButton, BaseComponentsConfigToolbarControls } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
} from '../baseComponentsConfiguratorLayout';
import {
  BASE_COMPONENTS_OPTION_IDLE_CLASS,
  BASE_COMPONENTS_OPTION_SELECTED_CLASS,
  BASE_COMPONENTS_BADGE_SOFT_CLASS,
} from '../baseComponentsVisualTokens';

const DEFAULT_ICON_BY_PACK: Record<NavigationIconPackId, string> = {
  lucide: 'LayoutDashboard',
  tabler: 'IconHome',
  phosphor: 'House',
  heroicons: 'HomeIcon',
  solar: 'Home',
  doodle: 'HeartIcon',
  marketeq: 'acorn',
};

const COLOR_TONE_OPTIONS: AppSurfaceBoxTone[] = ['slate', 'violet', 'cyan', 'indigo', 'emerald', 'amber', 'rose'];

const ICON_COLOR_CLASS: Record<AppSurfaceBoxTone, string> = {
  slate: 'text-slate-600',
  violet: 'text-violet-600',
  cyan: 'text-cyan-600',
  indigo: 'text-indigo-600',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  rose: 'text-rose-600',
};

const COLOR_TONE_SWATCH_CLASS: Record<AppSurfaceBoxTone, string> = {
  slate: 'bg-slate-500',
  violet: 'bg-violet-500',
  cyan: 'bg-cyan-500',
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
};

/** Selected color-tone chips keep a thin semantic border; fill stays slate-neutral. */
const COLOR_TONE_OPTION_SELECTED_CLASS: Record<AppSurfaceBoxTone, string> = {
  slate: BASE_COMPONENTS_OPTION_SELECTED_CLASS,
  violet: 'border-violet-300 bg-slate-50 text-violet-900 shadow-sm ring-1 ring-violet-200',
  cyan: 'border-cyan-300 bg-slate-50 text-cyan-900 shadow-sm ring-1 ring-cyan-200',
  indigo: 'border-indigo-300 bg-slate-50 text-indigo-900 shadow-sm ring-1 ring-indigo-200',
  emerald: 'border-emerald-300 bg-slate-50 text-emerald-900 shadow-sm ring-1 ring-emerald-200',
  amber: 'border-amber-300 bg-slate-50 text-amber-900 shadow-sm ring-1 ring-amber-200',
  rose: 'border-rose-300 bg-slate-50 text-rose-900 shadow-sm ring-1 ring-rose-200',
};

const APPEARANCE_OPTION_IDLE_CLASS = BASE_COMPONENTS_OPTION_IDLE_CLASS;

const OPTION_SELECTED_CLASS = BASE_COMPONENTS_OPTION_SELECTED_CLASS;

const SIZE_OPTION_SELECTED_CLASS = OPTION_SELECTED_CLASS;

export type IconSetsBaseComponentsIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

const STANDARD_ICON_SIZES: IconSetsBaseComponentsIconSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
const LARGE_ICON_SIZES: IconSetsBaseComponentsIconSize[] = ['2xl', '3xl'];

/** Stroke/vector packs scale cleanly at larger baseComponents preview sizes. */
const LARGE_SIZE_PACK_IDS = new Set<NavigationIconPackId>([
  'lucide',
  'tabler',
  'phosphor',
  'heroicons',
  'solar',
  'marketeq',
  'doodle',
]);

function getIconSizeOptionsForPack(packId: NavigationIconPackId): IconSetsBaseComponentsIconSize[] {
  if (LARGE_SIZE_PACK_IDS.has(packId)) {
    return [...STANDARD_ICON_SIZES, ...LARGE_ICON_SIZES];
  }

  return STANDARD_ICON_SIZES;
}

function clampIconSizeForPack(
  packId: NavigationIconPackId,
  size: IconSetsBaseComponentsIconSize,
): IconSetsBaseComponentsIconSize {
  const options = getIconSizeOptionsForPack(packId);
  return options.includes(size) ? size : 'xl';
}

const ICON_SIZE_CLASS: Record<IconSetsBaseComponentsIconSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
  xl: 'h-6 w-6',
  '2xl': 'h-8 w-8',
  '3xl': 'h-10 w-10',
};

export const resolveIconSetsPreviewState = (state: IconSetsBaseComponentsConfig['state']) => ({
  disabled: state === 'disabled',
  selectedLabel: state === 'selected' ? 'Selected' : null,
});

export type IconSetsBaseComponentsConfig = {
  packId: NavigationIconPackId;
  search: string;
  selectedIconRef: string;
  colorTone: AppSurfaceBoxTone;
  size: IconSetsBaseComponentsIconSize;
  stroke: 'light' | 'regular' | 'bold';
  state: 'default' | 'selected' | 'disabled';
  direction: 'ltr' | 'rtl';
  naming: 'decorative' | 'named';
};

export const resolveIconSetsRenderModel = (config: IconSetsBaseComponentsConfig) => ({
  direction: config.direction,
  disabled: config.state === 'disabled',
  selected: config.state === 'selected',
  iconClassName: cn(
    ICON_SIZE_CLASS[config.size],
    ICON_COLOR_CLASS[config.colorTone],
    config.stroke === 'light' && 'stroke-[1.25]',
    config.stroke === 'bold' && 'stroke-[2.5]',
    config.state === 'disabled' && 'opacity-40',
  ),
  ariaLabelFor: (name: string) => config.naming === 'named' ? name : undefined,
});

const DEFAULT_CONFIG: IconSetsBaseComponentsConfig = {
  packId: 'lucide',
  search: '',
  selectedIconRef: formatNavigationIconRef('lucide', DEFAULT_ICON_BY_PACK.lucide),
  colorTone: 'slate',
  size: 'md',
  stroke: 'regular',
  state: 'default',
  direction: 'ltr',
  naming: 'decorative',
};

const ICON_GRID_INITIAL_BATCH = 120;
const ICON_GRID_BATCH_SIZE = 120;

type IconSetsBaseComponentsPreviewProps = {
  config: IconSetsBaseComponentsConfig;
  onSelectIconRef: (iconRef: string) => void;
  onSearchChange: (search: string) => void;
};

const IconSetsBaseComponentsPreview: React.FC<IconSetsBaseComponentsPreviewProps> = ({
  config,
  onSelectIconRef,
  onSearchChange,
}) => {
  const deferredSearch = useDeferredValue(config.search);
  const previewState = resolveIconSetsPreviewState(config.state);
  const renderModel = resolveIconSetsRenderModel(config);
  const { iconNames, isLoading, loadError } = useNavigationIconPackEntries(config.packId, true);
  const [visibleCount, setVisibleCount] = useState(ICON_GRID_INITIAL_BATCH);

  const filteredIconNames = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    if (!needle) {
      return iconNames;
    }

    return iconNames.filter((name) => name.toLowerCase().includes(needle));
  }, [deferredSearch, iconNames]);

  const visibleIconNames = useMemo(
    () => filteredIconNames.slice(0, visibleCount),
    [filteredIconNames, visibleCount],
  );

  const hasMoreIcons = visibleIconNames.length < filteredIconNames.length;

  useEffect(() => {
    setVisibleCount(ICON_GRID_INITIAL_BATCH);
  }, [config.packId, deferredSearch]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !hasMoreIcons) {
      return;
    }

    const loadMoreIfNearEnd = () => {
      const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (remaining < 280) {
        setVisibleCount((current) => Math.min(current + ICON_GRID_BATCH_SIZE, filteredIconNames.length));
      }
    };

    loadMoreIfNearEnd();
    container.addEventListener('scroll', loadMoreIfNearEnd, { passive: true });
    return () => container.removeEventListener('scroll', loadMoreIfNearEnd);
  }, [filteredIconNames.length, hasMoreIcons, visibleIconNames.length]);

  const selectedLabel = formatNavigationIconRefLabel(config.selectedIconRef);
  const iconClassName = renderModel.iconClassName;
  const selectedHeaderIconClassName = cn(
    ICON_SIZE_CLASS['3xl'],
    ICON_COLOR_CLASS[config.colorTone],
    config.stroke === 'light' && 'stroke-[1.25]',
    config.stroke === 'bold' && 'stroke-[2.5]',
    previewState.disabled && 'opacity-40',
  );
  const totalIconCount = iconNames.length;
  const isFiltered = deferredSearch.trim().length > 0;
  const [copyHintVisible, setCopyHintVisible] = useState(false);
  const [copyHintPosition, setCopyHintPosition] = useState<{ top: number; left: number } | null>(null);
  const copyHintTimeoutRef = useRef<number | null>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => () => {
    if (copyHintTimeoutRef.current !== null) {
      window.clearTimeout(copyHintTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    setCopyHintVisible(false);
    setCopyHintPosition(null);
  }, [selectedLabel]);

  const handleCopyRef = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(selectedLabel);
      const rect = copyButtonRef.current?.getBoundingClientRect();
      if (rect) {
        setCopyHintPosition({
          top: rect.top - 8,
          left: rect.left + rect.width / 2,
        });
      }
      setCopyHintVisible(true);
      if (copyHintTimeoutRef.current !== null) {
        window.clearTimeout(copyHintTimeoutRef.current);
      }
      copyHintTimeoutRef.current = window.setTimeout(() => {
        setCopyHintVisible(false);
        setCopyHintPosition(null);
        copyHintTimeoutRef.current = null;
      }, 2000);
    } catch {
      // Clipboard may be unavailable outside secure context.
    }
  }, [selectedLabel]);

  const copyHint = copyHintVisible && copyHintPosition
    ? createPortal(
      <span
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed z-[200] whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 shadow-sm"
        style={{
          top: copyHintPosition.top,
          left: copyHintPosition.left,
          transform: 'translate(-50%, -100%)',
        }}
      >
        Copied
      </span>,
      document.body,
    )
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white" dir={config.direction}>
      {copyHint}
      <div className="flex min-w-0 shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-2">
        <div className="w-40 shrink-0">
          <UiInput
            size="sm"
            value={config.search}
            placeholder="icons…"
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Search icons"
          />
        </div>
        <p className="shrink-0 whitespace-nowrap text-xs text-slate-500">
          {isLoading
            ? 'Loading…'
            : isFiltered
              ? `${filteredIconNames.length.toLocaleString()} / ${totalIconCount.toLocaleString()}`
              : totalIconCount.toLocaleString()}
        </p>
        <div className={cn('ms-auto shrink rounded-md', previewState.selectedLabel && 'ring-2 ring-indigo-300 ring-offset-1')}>
          <button
            ref={copyButtonRef}
            type="button"
            className="flex min-w-0 cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-slate-50 py-1 ps-2 pe-1.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-100"
            title="Copy icon ref"
            aria-label={`Copy ${selectedLabel}`}
            onClick={() => void handleCopyRef()}
            disabled={previewState.disabled}
          >
            <NavigationIcon iconRef={config.selectedIconRef} className={cn('shrink-0', selectedHeaderIconClassName)} />
            <span className="max-w-[7.5rem] truncate font-mono text-[11px] text-slate-700 sm:max-w-[10rem]" title={selectedLabel}>
              {selectedLabel}
            </span>
            <Copy className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            {previewState.selectedLabel ? <span className="text-[10px] font-bold text-indigo-700">{previewState.selectedLabel}</span> : null}
          </button>
        </div>
      </div>

      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-auto p-3">
        {isLoading ? (
          <div className="flex h-full min-h-[240px] items-start justify-start text-sm text-slate-400">
            Loading icon pack…
          </div>
        ) : loadError ? (
          <div className="flex h-full min-h-[240px] items-start justify-start px-4 text-sm text-rose-600">
            {loadError}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {visibleIconNames.map((name) => {
              const iconRef = formatNavigationIconRef(config.packId, name);
              const isSelected = selectedLabel === iconRef;
              return (
                <button
                  key={name}
                  type="button"
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors',
                    isSelected
                      ? BASE_COMPONENTS_OPTION_SELECTED_CLASS
                      : BASE_COMPONENTS_OPTION_IDLE_CLASS,
                  )}
                  onClick={() => onSelectIconRef(iconRef)}
                  disabled={previewState.disabled}
                  aria-label={renderModel.ariaLabelFor(name)}
                >
                  <NavigationIcon iconRef={iconRef} className={cn('shrink-0', iconClassName)} />
                  <span className="truncate font-mono text-[11px]">{name}</span>
                </button>
              );
            })}
            {filteredIconNames.length === 0 ? (
              <p className="col-span-full py-8 text-start text-sm text-slate-400">
                No matching icons.
              </p>
            ) : null}
            {hasMoreIcons ? (
              <p className="col-span-full py-2 text-start text-xs text-slate-400">
                Loading more icons…
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export const IconSetsBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<IconSetsBaseComponentsConfig>(DEFAULT_CONFIG);
  const configJson = useMemo(() => JSON.stringify(config, null, 2), [config]);
  const sizeOptions = useMemo(() => getIconSizeOptionsForPack(config.packId), [config.packId]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="icon-sets" json={configJson}>
          <BaseComponentsResetButton onClick={() => setConfig(DEFAULT_CONFIG)} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Icon sets" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <ul className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {NAVIGATION_ICON_PACKS.map((pack) => {
                  const isSelected = pack.id === config.packId;
                  const previewIconRef = formatNavigationIconRef(pack.id, DEFAULT_ICON_BY_PACK[pack.id]);
                  return (
                    <li key={pack.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        className={cn(
                          'flex min-w-0 flex-1 items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors',
                          isSelected
                            ? cn('font-bold', OPTION_SELECTED_CLASS)
                            : cn('font-semibold', APPEARANCE_OPTION_IDLE_CLASS),
                        )}
                        aria-pressed={isSelected}
                        onMouseEnter={() => {
                          void loadNavigationIconPack(pack.id);
                        }}
                        onFocus={() => {
                          void loadNavigationIconPack(pack.id);
                        }}
                        onClick={() => {
                          setConfig((current) => ({
                            ...current,
                            packId: pack.id,
                            selectedIconRef: formatNavigationIconRef(pack.id, DEFAULT_ICON_BY_PACK[pack.id]),
                            size: clampIconSizeForPack(pack.id, current.size),
                          }));
                        }}
                      >
                        <NavigationIcon
                          iconRef={previewIconRef}
                          className={cn(
                            'h-4 w-4 shrink-0',
                            isSelected ? 'text-slate-700' : 'text-slate-500',
                          )}
                        />
                        <span className="min-w-0 truncate">{pack.label}</span>
                        {(() => {
                          const manifest = getIconPackManifestEntry(pack.id);
                          if (!manifest) return null;
                          return (
                            <span className={cn(
                              BASE_COMPONENTS_BADGE_SOFT_CLASS,
                              'shrink-0',
                              manifest.usage === 'navigation'
                                ? isSelected
                                  ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : isSelected
                                  ? 'border-amber-200 bg-amber-100 text-amber-800'
                                  : 'border-amber-200 bg-amber-50 text-amber-700',
                            )}
                            >
                              {manifest.usage === 'navigation' ? 'Nav' : 'Decorative'}
                            </span>
                          );
                        })()}
                        {isSelected ? (
                          <Check className="ms-auto h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </FormSection>

            <FormSection title="Appearance" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Color" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <ul className="grid grid-cols-2 gap-2">
                    {COLOR_TONE_OPTIONS.map((tone) => {
                      const isSelected = config.colorTone === tone;
                      return (
                        <li key={tone}>
                          <button
                            type="button"
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors',
                              isSelected
                                ? cn('font-bold', COLOR_TONE_OPTION_SELECTED_CLASS[tone])
                                : cn('font-semibold', APPEARANCE_OPTION_IDLE_CLASS),
                            )}
                            aria-pressed={isSelected}
                            aria-label={`Color ${tone}`}
                            onClick={() => setConfig((current) => ({ ...current, colorTone: tone }))}
                          >
                            <span
                              className={cn(
                                'h-3 w-3 shrink-0 rounded-full border border-black/10',
                                COLOR_TONE_SWATCH_CLASS[tone],
                              )}
                              aria-hidden
                            />
                            <span className="capitalize">{tone}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </FormField>

                <FormField label="Size" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <ul className="flex flex-wrap gap-2">
                    {sizeOptions.map((size) => {
                      const isSelected = config.size === size;
                      return (
                        <li key={size}>
                          <button
                            type="button"
                            className={cn(
                              'rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                              isSelected
                                ? cn('font-bold', SIZE_OPTION_SELECTED_CLASS)
                                : cn('font-semibold', APPEARANCE_OPTION_IDLE_CLASS),
                            )}
                            aria-pressed={isSelected}
                            aria-label={`Size ${size}`}
                            onClick={() => setConfig((current) => ({ ...current, size }))}
                          >
                            {size}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </FormField>
                <FormField label="Stroke" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" value={config.stroke} onChange={(event) => setConfig((current) => ({ ...current, stroke: event.target.value as IconSetsBaseComponentsConfig['stroke'] }))} ariaLabel="Icon stroke">
                    <option value="light">light</option><option value="regular">regular</option><option value="bold">bold</option>
                  </UiSelect>
                </FormField>
                <FormField label="State" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" value={config.state} onChange={(event) => setConfig((current) => ({ ...current, state: event.target.value as IconSetsBaseComponentsConfig['state'] }))} ariaLabel="Icon state">
                    <option value="default">default</option><option value="selected">selected</option><option value="disabled">disabled</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Direction & naming" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Direction audit" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" value={config.direction} onChange={(event) => setConfig((current) => ({ ...current, direction: event.target.value as IconSetsBaseComponentsConfig['direction'] }))} ariaLabel="Icon direction audit">
                    <option value="ltr">ltr</option><option value="rtl">rtl</option>
                  </UiSelect>
                </FormField>
                <FormField label="Accessible naming" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" value={config.naming} onChange={(event) => setConfig((current) => ({ ...current, naming: event.target.value as IconSetsBaseComponentsConfig['naming'] }))} ariaLabel="Icon accessible naming">
                    <option value="decorative">decorative</option><option value="named">named</option>
                  </UiSelect>
                </FormField>
                <p className="text-[11px] text-slate-500">Directional icons must mirror or swap meaning in RTL. Decorative icons stay hidden from assistive technology; named icons receive a task label.</p>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col max-lg:min-h-[min(60vh,28rem)] lg:h-full">
          <IconSetsBaseComponentsPreview
            config={config}
            onSelectIconRef={(selectedIconRef) => setConfig((current) => ({ ...current, selectedIconRef }))}
            onSearchChange={(search) => setConfig((current) => ({ ...current, search }))}
          />
        </div>
      </div>
    </div>
  );
};
