import React, { useEffect, useMemo, useState } from 'react';
import { ImageIcon, Link2, Plus, Trash2, X } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { cn } from '../../../lib/utils';
import {
  normalizeDashboardHomeShortcutPath,
  type DashboardHomeShortcut,
} from '../../../shared/lib/dashboardHomeShortcuts';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import { formatNavigationIconRefLabel } from '../../../shared/lib/navigationIcons/navigationIconRef';
import {
  AppButton,
  AppSearchBox,
  CreateEditModalShell,
  FormField,
  FormSection,
  NativeButton,
  NavigationIconPickerDialog,
  UiInput,
  resolveFormFieldPairGridClass,
} from '../../../shared/ui';
import {
  DASHBOARD_SHORTCUT_FREE_FORM_ID,
  DASHBOARD_SHORTCUT_OTHER_GROUP,
  composeDashboardShortcutPath,
  createDashboardShortcutFromFreePath,
  createDashboardShortcutFromTarget,
  filterDashboardShortcutTargets,
  type DashboardShortcutQueryPair,
  type DashboardShortcutTarget,
} from '../dashboardShortcutPicker';
import { useDashboardShortcutTargets } from '../hooks/useDashboardShortcutTargets';

type DashboardAddShortcutModalProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (shortcut: DashboardHomeShortcut) => boolean;
};

type QueryRow = DashboardShortcutQueryPair & { id: number };

const emptyQueryRow = (id: number): QueryRow => ({ id, key: '', value: '' });

export const DashboardAddShortcutModal: React.FC<DashboardAddShortcutModalProps> = ({
  open,
  onClose,
  onAdd,
}) => {
  const t = useCultureT();
  const targets = useDashboardShortcutTargets();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('');
  const [itemSlug, setItemSlug] = useState('');
  const [queryRows, setQueryRows] = useState<QueryRow[]>([emptyQueryRow(1)]);
  const [nextQueryId, setNextQueryId] = useState(2);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [freePath, setFreePath] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setSearch('');
    setSelectedId(null);
    setLabel('');
    setIcon('');
    setItemSlug('');
    setFreePath('');
    setQueryRows([emptyQueryRow(1)]);
    setNextQueryId(2);
    setIconPickerOpen(false);
  }, [open]);

  const filteredTargets = useMemo(
    () => filterDashboardShortcutTargets(targets, search),
    [search, targets],
  );

  const groupedTargets = useMemo(() => {
    const groups: Array<{ heading: string | null; items: DashboardShortcutTarget[] }> = [];
    for (const target of filteredTargets) {
      const last = groups[groups.length - 1];
      if (last && last.heading === target.group) {
        last.items.push(target);
      } else {
        groups.push({ heading: target.group, items: [target] });
      }
    }
    return groups;
  }, [filteredTargets]);

  const isFreeForm = selectedId === DASHBOARD_SHORTCUT_FREE_FORM_ID;
  const selectedTarget = isFreeForm
    ? null
    : targets.find((target) => target.id === selectedId) ?? null;
  const queryPairs = queryRows.map(({ key, value }) => ({ key, value }));
  const normalizedFreePath = normalizeDashboardHomeShortcutPath(freePath);
  const previewPath = isFreeForm
    ? (normalizedFreePath ?? '')
    : selectedTarget
      ? composePreviewPath(selectedTarget, itemSlug, queryPairs)
      : '';
  const trimmedLabel = label.trim();
  const canSubmit = isFreeForm
    ? Boolean(trimmedLabel && normalizedFreePath)
    : Boolean(selectedTarget && trimmedLabel && previewPath);

  const resetAndClose = () => {
    onClose();
  };

  const selectTarget = (target: DashboardShortcutTarget) => {
    setSelectedId(target.id);
    setLabel(target.label);
    setIcon(target.icon?.trim() ?? '');
    setItemSlug('');
    setFreePath('');
    setQueryRows([emptyQueryRow(1)]);
    setNextQueryId(2);
  };

  const selectFreeForm = () => {
    setSelectedId(DASHBOARD_SHORTCUT_FREE_FORM_ID);
    setLabel('');
    setIcon('');
    setItemSlug('');
    setFreePath('');
    setQueryRows([emptyQueryRow(1)]);
    setNextQueryId(2);
  };

  const handleSubmit = () => {
    const shortcut = isFreeForm
      ? createDashboardShortcutFromFreePath({ label, icon, path: freePath })
      : selectedTarget
        ? createDashboardShortcutFromTarget(selectedTarget, {
          label,
          icon,
          itemSlug,
          queryPairs,
        })
        : null;
    if (!shortcut) {
      return;
    }
    onAdd(shortcut);
    resetAndClose();
  };

  if (!open) {
    return null;
  }

  return (
    <CreateEditModalShell
      size="maximized"
      title={t('dashboard.myShortcuts.addLink')}
      gradient={false}
      shellClassName="flex min-h-0 flex-col overflow-hidden"
      bodyOuterClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !min-h-0 !p-0"
      onClose={resetAndClose}
      onBackdropClick={resetAndClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={resetAndClose}>
            <X className="h-3.5 w-3.5" />
            {t('actions.cancel')}
          </AppButton>
          <AppButton intent="primary" onClick={handleSubmit} disabled={!canSubmit}>
            <Plus className="h-3.5 w-3.5" />
            {t('dashboard.myShortcuts.addLink')}
          </AppButton>
        </>
      )}
    >
      <div className="flex h-full min-h-0 flex-1">
        <aside className="flex w-[min(22rem,38%)] shrink-0 flex-col border-e border-slate-200">
          <div className="shrink-0 border-b border-slate-200 px-3 py-2">
            <AppSearchBox
              value={search}
              onChange={setSearch}
              placeholder={t('dashboard.myShortcuts.search')}
              ariaLabel={t('dashboard.myShortcuts.search')}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="mb-3">
              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t('dashboard.myShortcuts.customLink')}
              </p>
              <NativeButton
                type="button"
                aria-label={t('dashboard.myShortcuts.customLink')}
                aria-pressed={isFreeForm}
                className={cn(
                  'flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-start transition-colors',
                  isFreeForm
                    ? 'bg-indigo-50 text-indigo-950'
                    : 'text-slate-800 hover:bg-slate-50',
                )}
                onClick={selectFreeForm}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white">
                  <Link2 className={cn('h-4 w-4', isFreeForm ? 'text-indigo-700' : 'text-slate-600')} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{t('dashboard.myShortcuts.customLink')}</span>
                  <span className="block truncate text-[10px] text-slate-500">{t('dashboard.myShortcuts.pathHint')}</span>
                </span>
              </NativeButton>
            </div>
            {groupedTargets.map((group) => (
              <div key={group.heading ?? '__ungrouped'} className="mb-3 last:mb-0">
                {group.heading ? (
                  <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {group.heading === DASHBOARD_SHORTCUT_OTHER_GROUP
                      ? t('dashboard.myShortcuts.otherPages')
                      : group.heading}
                  </p>
                ) : null}
                <div className="flex flex-col gap-0.5">
                  {group.items.map((target) => {
                    const isSelected = target.id === selectedId;
                    return (
                      <NativeButton
                        key={target.id}
                        type="button"
                        aria-label={target.label}
                        aria-pressed={isSelected}
                        className={cn(
                          'flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-start transition-colors',
                          isSelected
                            ? 'bg-indigo-50 text-indigo-950'
                            : 'text-slate-800 hover:bg-slate-50',
                        )}
                        onClick={() => selectTarget(target)}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white">
                          <NavigationIcon
                            iconRef={target.icon}
                            className={cn('h-4 w-4', isSelected ? 'text-indigo-700' : 'text-slate-600')}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{target.label}</span>
                          <span className="block truncate font-mono text-[10px] text-slate-500">{target.path}</span>
                        </span>
                      </NativeButton>
                    );
                  })}
                </div>
              </div>
            ))}
            {filteredTargets.length === 0 ? (
              <p className="px-2 py-10 text-center text-sm text-slate-400">
                {t('dashboard.myShortcuts.noMatchingPages')}
              </p>
            ) : null}
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-[15px]">
          {isFreeForm || selectedTarget ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              <FormSection
                title={t('dashboard.myShortcuts.appearance')}
                hint={t('dashboard.myShortcuts.appearanceHint')}
                tone="indigo"
              >
                <div className={resolveFormFieldPairGridClass(true)}>
                  <FormField
                    label={t('dashboard.myShortcuts.label')}
                    hint={t('dashboard.myShortcuts.labelHint')}
                    required
                    invalid={!trimmedLabel}
                  >
                    <UiInput
                      size="sm"
                      value={label}
                      ariaLabel={t('dashboard.myShortcuts.label')}
                      onChange={(event) => setLabel(event.target.value)}
                      autoDir
                      isInvalid={!trimmedLabel}
                    />
                  </FormField>
                  <FormField
                    label={t('dashboard.myShortcuts.icon')}
                    hint={t('dashboard.myShortcuts.iconHint')}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white">
                        {icon.trim() || selectedTarget?.icon ? (
                          <NavigationIcon
                            iconRef={icon || selectedTarget?.icon}
                            className="h-4 w-4 text-slate-700"
                          />
                        ) : (
                          <Link2 className="h-4 w-4 text-slate-500" aria-hidden />
                        )}
                      </span>
                      <AppButton
                        type="button"
                        size="sm"
                        intent="secondary"
                        className="flex min-w-0 flex-1 justify-start"
                        aria-label={t('dashboard.myShortcuts.chooseIcon')}
                        onClick={() => setIconPickerOpen(true)}
                      >
                        <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate font-mono text-[11px] leading-none">
                          {icon.trim()
                            ? formatNavigationIconRefLabel(icon)
                            : t('dashboard.myShortcuts.chooseIcon')}
                        </span>
                      </AppButton>
                    </div>
                  </FormField>
                </div>
              </FormSection>

              {isFreeForm ? (
                <FormSection
                  title={t('dashboard.myShortcuts.path')}
                  hint={t('dashboard.myShortcuts.pathHint')}
                  tone="cyan"
                  divided
                >
                  <FormField
                    label={t('dashboard.myShortcuts.path')}
                    hint={t('dashboard.myShortcuts.pathHint')}
                    required
                    invalid={Boolean(freePath.trim() && !normalizedFreePath)}
                  >
                    <UiInput
                      size="sm"
                      value={freePath}
                      ariaLabel={t('dashboard.myShortcuts.path')}
                      onChange={(event) => setFreePath(event.target.value)}
                      autoDir={false}
                      isInvalid={Boolean(freePath.trim() && !normalizedFreePath)}
                    />
                  </FormField>
                  {freePath.trim() && !normalizedFreePath ? (
                    <p className="text-xs text-rose-600">{t('dashboard.myShortcuts.pathInvalid')}</p>
                  ) : null}
                  {normalizedFreePath ? (
                    <FormField label={t('dashboard.myShortcuts.preview')}>
                      <p className="truncate rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-600" dir="ltr">
                        {normalizedFreePath}
                      </p>
                    </FormField>
                  ) : null}
                </FormSection>
              ) : selectedTarget ? (
              <FormSection
                title={t('dashboard.myShortcuts.parameters')}
                hint={t('dashboard.myShortcuts.parametersHint')}
                tone="cyan"
                divided
              >
                {selectedTarget.itemMode === 'edit' ? (
                  <FormField
                    label={t('dashboard.myShortcuts.recordKey')}
                    hint={t('dashboard.myShortcuts.recordKeyHint')}
                  >
                    <UiInput
                      size="sm"
                      value={itemSlug}
                      ariaLabel={t('dashboard.myShortcuts.recordKey')}
                      onChange={(event) => setItemSlug(event.target.value)}
                      autoDir={false}
                    />
                  </FormField>
                ) : null}
                {selectedTarget.itemMode === 'remainder' ? (
                  <FormField
                    label={t('dashboard.myShortcuts.extraPath')}
                    hint={t('dashboard.myShortcuts.extraPathHint')}
                  >
                    <UiInput
                      size="sm"
                      value={itemSlug}
                      ariaLabel={t('dashboard.myShortcuts.extraPath')}
                      onChange={(event) => setItemSlug(event.target.value)}
                      autoDir={false}
                    />
                  </FormField>
                ) : null}
                {queryRows.map((row) => (
                  <div key={row.id} className="flex items-end gap-2">
                    <FormField
                      label={t('dashboard.myShortcuts.queryName')}
                      className="min-w-0 flex-1"
                    >
                      <UiInput
                        size="sm"
                        value={row.key}
                        onChange={(event) => setQueryRows((current) => current.map((item) => (
                          item.id === row.id ? { ...item, key: event.target.value } : item
                        )))}
                        autoDir={false}
                      />
                    </FormField>
                    <FormField
                      label={t('dashboard.myShortcuts.queryValue')}
                      className="min-w-0 flex-1"
                    >
                      <UiInput
                        size="sm"
                        value={row.value}
                        onChange={(event) => setQueryRows((current) => current.map((item) => (
                          item.id === row.id ? { ...item, value: event.target.value } : item
                        )))}
                        autoDir
                      />
                    </FormField>
                    <AppButton
                      type="button"
                      size="icon-sm"
                      intent="secondary"
                      tabStop="skip"
                      className="mb-0.5"
                      aria-label={t('dashboard.myShortcuts.removeQueryParam')}
                      onClick={() => setQueryRows((current) => (
                        current.length <= 1
                          ? [emptyQueryRow(row.id)]
                          : current.filter((item) => item.id !== row.id)
                      ))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </AppButton>
                  </div>
                ))}
                <AppButton
                  type="button"
                  intent="secondary"
                  onClick={() => {
                    setQueryRows((current) => [...current, emptyQueryRow(nextQueryId)]);
                    setNextQueryId((current) => current + 1);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('dashboard.myShortcuts.addQueryParam')}
                </AppButton>
                <FormField
                  label={t('dashboard.myShortcuts.preview')}
                >
                  <p className="truncate rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-600" dir="ltr">
                    {previewPath}
                  </p>
                </FormField>
              </FormSection>
              ) : null}
              <button type="submit" className="sr-only" disabled={!canSubmit} tabIndex={-1}>
                {t('dashboard.myShortcuts.addLink')}
              </button>
            </form>
          ) : (
            <div className="flex h-full min-h-[12rem] items-center justify-center">
              <p className="max-w-sm text-center text-sm text-slate-500">
                {t('dashboard.myShortcuts.selectPageHint')}
              </p>
            </div>
          )}
        </section>
      </div>
      <NavigationIconPickerDialog
        open={iconPickerOpen}
        selectedIcon={icon || selectedTarget?.icon || undefined}
        onClose={() => setIconPickerOpen(false)}
        onSelect={(nextIcon) => {
          setIcon(nextIcon);
          setIconPickerOpen(false);
        }}
      />
    </CreateEditModalShell>
  );
};

const composePreviewPath = (
  target: DashboardShortcutTarget,
  itemSlug: string,
  queryPairs: DashboardShortcutQueryPair[],
): string => composeDashboardShortcutPath({
  basePath: target.path,
  itemMode: target.itemMode,
  itemSlug,
  queryPairs,
});
