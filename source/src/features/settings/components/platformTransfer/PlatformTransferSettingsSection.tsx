import React, { useMemo, useState } from 'react';
import { AlertTriangle, Download, Upload } from 'lucide-react';
import { AppButton, UiCheckboxChoice } from '../../../../shared/ui';
import { ConfirmDialogShell } from '../../../../shared/ui/ConfirmDialogShell';
import { cn } from '../../../../lib/utils';
import { useCultureT } from '../../../../core/culture/CultureContext';
import type { PlatformTransferCatalogEntry, PlatformTransferGroupId, PlatformTransferSectionKey } from '../../../../shared/api/contracts/settings/platformTransfer';
import {
  SETTINGS_PANEL_PADDING_X_CLASS,
  SETTINGS_SURFACE_STACK_CLASS,
  SettingsFormGroup,
} from '../form/SettingsFormPrimitives';
import { usePlatformTransferPage } from './usePlatformTransferPage';

const MODE_BUTTON_CLASS = 'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors';
const TRANSFER_CARD_GRID_CLASS = 'grid grid-cols-1 items-start gap-1.5 sm:grid-cols-2 lg:grid-cols-3';
const TRANSFER_CARD_CLASS = '!flex items-center gap-2 self-stretch rounded-md border px-2.5 py-1.5 text-start';
const SENSITIVE_BADGE_CLASS =
  'ms-1 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-800';
const TRANSFER_FOOTER_CLASS = 'mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3';
const TRANSFER_SHELL_PADDING_CLASS = cn(SETTINGS_PANEL_PADDING_X_CLASS, 'py-4');

type TransferEntryCopy = {
  label: string;
  description: string;
  sensitive?: boolean;
};

export const PlatformTransferSettingsSection: React.FC = () => {
  const page = usePlatformTransferPage();
  const t = useCultureT();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const groupOrder = useMemo(
    () => ['platform-blobs', 'app-settings', 'data-model'] as PlatformTransferGroupId[],
    [],
  );

  const importPreviewByGroup = useMemo(() => {
    const groups = new Map<PlatformTransferGroupId, PlatformTransferCatalogEntry[]>();
    for (const entry of page.importPreviewEntries) {
      const current = groups.get(entry.group) ?? [];
      current.push(entry);
      groups.set(entry.group, current);
    }
    return groups;
  }, [page.importPreviewEntries]);

  const renderEntryBody = (entry: TransferEntryCopy) => (
    <span className="min-w-0 flex-1 text-start">
      <span className="flex flex-wrap items-center justify-start gap-x-1 text-xs font-semibold leading-none text-slate-900">
        {entry.label}
        {entry.sensitive ? (
          <span className={SENSITIVE_BADGE_CLASS}>
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {t('platformTransfer.sensitive')}
          </span>
        ) : null}
      </span>
      <span className="mt-[2px] block line-clamp-1 text-[11px] leading-snug text-slate-500">{entry.description}</span>
    </span>
  );

  const renderExportEntry = (entry: {
    key: PlatformTransferSectionKey;
    label: string;
    description: string;
    sensitive?: boolean;
  }) => (
    <UiCheckboxChoice
      key={entry.key}
      id={`platform-transfer-export-${entry.key}`}
      checked={page.selectedSet.has(entry.key)}
      onChange={(checked) => page.toggleKey(entry.key, checked)}
      className={cn(
        TRANSFER_CARD_CLASS,
        page.selectedSet.has(entry.key) ? 'border-cyan-200 bg-cyan-50/50' : 'border-slate-200 bg-white',
      )}
    >
      {renderEntryBody(entry)}
    </UiCheckboxChoice>
  );

  const renderImportPreviewEntry = (entry: {
    key: PlatformTransferSectionKey;
    label: string;
    description: string;
    sensitive?: boolean;
  }) => (
    <div
      key={entry.key}
      className={cn(TRANSFER_CARD_CLASS, 'border-cyan-200 bg-cyan-50/50')}
    >
      {renderEntryBody(entry)}
    </div>
  );

  const fileInput = (
    <input
      ref={page.fileInputRef}
      type="file"
      accept="application/json,.json"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) {
          void page.parseBundleFile(file);
        }
        event.target.value = '';
      }}
    />
  );

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50', TRANSFER_SHELL_PADDING_CLASS)}>
      {page.isLoading ? (
        <div className="text-sm text-slate-500">{t('platformTransfer.loadingCatalog')}</div>
      ) : (
        <div className={cn('w-full text-start', SETTINGS_SURFACE_STACK_CLASS)}>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="min-w-0 flex-1 text-xs leading-snug text-slate-600">
              {t('platformTransfer.introBefore')}
              {' '}
              <code className="rounded bg-slate-100 px-1 py-px text-[11px]">settings.json</code>
              {' '}
              {t('platformTransfer.introAfter')}
            </p>

            <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-100 p-0.5">
              <button
                type="button"
                className={cn(
                  MODE_BUTTON_CLASS,
                  page.mode === 'export' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
                onClick={() => page.setMode('export')}
              >
                {t('platformTransfer.export')}
              </button>
              <button
                type="button"
                className={cn(
                  MODE_BUTTON_CLASS,
                  page.mode === 'import' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
                onClick={() => page.setMode('import')}
              >
                {t('platformTransfer.import')}
              </button>
            </div>
          </div>

          {page.mode === 'export' ? (
            <>
              {groupOrder.map((groupId) => {
                const entries = page.catalogByGroup.get(groupId) ?? [];
                if (entries.length === 0) return null;

                return (
                  <SettingsFormGroup
                    key={groupId}
                    title={page.groupLabels[groupId]}
                    sectionId="platform-transfer"
                    divided={groupId !== 'platform-blobs'}
                  >
                    <div className={TRANSFER_CARD_GRID_CLASS}>
                      {entries.map((entry) => renderExportEntry(entry))}
                    </div>
                  </SettingsFormGroup>
                );
              })}

              <div className={TRANSFER_FOOTER_CLASS}>
                <AppButton intent="secondary" size="sm" onClick={page.selectDefaults}>{t('platformTransfer.selectDefaults')}</AppButton>
                <AppButton intent="cancel" size="sm" onClick={page.clearSelection}>{t('platformTransfer.clear')}</AppButton>
                <AppButton
                  intent="primary"
                  size="sm"
                  className="ms-auto"
                  onClick={() => void page.handleExport()}
                  disabled={page.isExporting || page.selectedCount === 0}
                >
                  <Download className="h-3.5 w-3.5" />
                  {page.isExporting ? t('platformTransfer.exporting') : t('platformTransfer.exportSelected')}
                </AppButton>
              </div>
            </>
          ) : page.pendingBundle ? (
            <>
              <p className="text-xs text-slate-600">
                {t('platformTransfer.importPreviewIntro').replace('{fileName}', page.importFileName ?? '')}
              </p>

              {groupOrder.map((groupId) => {
                const entries = importPreviewByGroup.get(groupId) ?? [];
                if (entries.length === 0) return null;

                return (
                  <SettingsFormGroup
                    key={groupId}
                    title={page.groupLabels[groupId]}
                    sectionId="platform-transfer"
                    divided={groupId !== 'platform-blobs'}
                  >
                    <div className={TRANSFER_CARD_GRID_CLASS}>
                      {entries.map((entry) => renderImportPreviewEntry(entry))}
                    </div>
                  </SettingsFormGroup>
                );
              })}

              {page.hasSensitiveImport ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                  {t('platformTransfer.sensitiveImportWarning')}
                </p>
              ) : null}

              <div className={TRANSFER_FOOTER_CLASS}>
                <AppButton intent="cancel" size="sm" onClick={page.cancelImport} disabled={page.isImporting}>
                  {t('actions.cancel')}
                </AppButton>
                <AppButton
                  intent="primary"
                  size="sm"
                  className="ms-auto"
                  onClick={() => setConfirmOpen(true)}
                  disabled={page.isImporting || page.importPreviewEntries.length === 0}
                >
                  {page.isImporting ? t('platformTransfer.importing') : t('platformTransfer.confirmImport')}
                </AppButton>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p className="text-xs text-slate-600">
                {t('platformTransfer.chooseFileHint')}
              </p>
              {fileInput}
              <AppButton intent="secondary" size="sm" onClick={() => page.fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" />
                {t('platformTransfer.chooseFile')}
              </AppButton>
            </div>
          )}

          {page.statusMessage ? (
            <p className="text-sm text-emerald-700">{page.statusMessage}</p>
          ) : null}
          {page.errorMessage ? (
            <p className="text-sm text-rose-700">{page.errorMessage}</p>
          ) : null}
        </div>
      )}

      <ConfirmDialogShell
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('platformTransfer.confirmImportTitle')}
        tone="danger"
        confirmIntent="destructive"
        confirmLabel={t('platformTransfer.import')}
        isConfirming={page.isImporting}
        confirmingLabel={t('platformTransfer.importing')}
        onConfirm={() => {
          setConfirmOpen(false);
          void page.handleImport();
        }}
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            {t('platformTransfer.confirmImportBody')}
          </p>
          <ul className="list-disc space-y-1 ps-5">
            {page.importPreviewEntries.map((entry) => (
              <li key={entry.key}>{entry.label}</li>
            ))}
          </ul>
          {page.hasSensitiveImport ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              {t('platformTransfer.confirmSensitiveWarning')}
            </p>
          ) : null}
        </div>
      </ConfirmDialogShell>
    </div>
  );
};
