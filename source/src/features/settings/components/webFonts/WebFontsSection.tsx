import React, { useEffect } from 'react';
import { Bold, Copy, Italic, Trash2, Type, Upload, X } from 'lucide-react';
import { formatQueryError } from '../../../../shared/api/client';
import { loadCultureFonts } from '../../../../core/culture/cultureFontLoader';
import {
  AppButton,
  AppToast,
  CreateEditModalShell,
  QueryErrorPanel,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  UiSelect,
  ICON_ACTION_BUTTON_BASE_CLASS,
  ICON_ACTION_DELETE_CLASS,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
} from '../../../../shared/ui';
import { cn } from '../../../../lib/utils';
import { ListPageToolbarScrollHost } from '../../../../shared/ui/list-page/listPageToolbarChrome';
import { useListPageToolbarScroll } from '../../../../shared/lib/useListPageToolbarScroll';
import { getSettingsTypography } from '../../settingsSectionTypography';
import {
  SettingsCard,
  SettingsCardGrid,
} from '../form/SettingsFormPrimitives';
import type { WebFontsSectionModel } from './useWebFontsSection';
import {
  WEB_FONT_PREVIEW_BOX_CLASS,
  WEB_FONT_PREVIEW_SAMPLES,
  WEB_FONT_PREVIEW_SIZE_CLASS,
  WEB_FONT_PREVIEW_SIZE_OPTIONS,
  WEB_FONT_PREVIEW_SIZE_TOOLBAR_BUTTON_CLASS,
  WEB_FONT_SCRIPT_FILTER_OPTIONS,
  WEB_FONT_SCRIPT_OPTIONS,
} from './constants';
import type { WebFontPreviewSize, WebFontScriptFilter } from './constants';
import type { WebFontScript } from '../../../../shared/api/contracts/platform/webFonts';
import { buildWebFontFaceCss, buildWebFontFamilyStyle } from './webFontCopySnippets';

type Props = {
  page: WebFontsSectionModel;
};

const CARD_META_ROW_CLASS = 'inline-flex h-6 max-w-full items-center gap-1.5';

const PREVIEW_TOOLBAR_ICON_TOGGLE_CLASS =
  'inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border p-0 transition-colors';

const WebFontPreview: React.FC<{
  font: NonNullable<WebFontsSectionModel['fontsQuery']['data']>[number];
  previewSize: WebFontPreviewSize;
  previewBold: boolean;
  previewItalic: boolean;
}> = ({ font, previewSize, previewBold, previewItalic }) => {
  useEffect(() => {
    void loadCultureFonts({
      defaultFontId: font.id,
      fonts: [{
        id: font.id,
        label: font.label,
        family: font.family,
        url: font.url,
        format: font.format,
      }],
    });
  }, [font]);

  return (
    <div className="mt-2 space-y-1.5 text-slate-700">
      {WEB_FONT_PREVIEW_SAMPLES.map((sample) => (
        <div
          className={cn(
            WEB_FONT_PREVIEW_BOX_CLASS,
            WEB_FONT_PREVIEW_SIZE_CLASS[previewSize],
            previewBold ? 'font-bold' : 'font-normal',
            previewItalic ? 'italic' : 'not-italic',
          )}
          style={{
            fontFamily: `"${font.family}"`,
            fontWeight: previewBold ? 700 : 400,
            fontStyle: previewItalic ? 'italic' : 'normal',
            fontSynthesis: 'none',
          }}
        >
          {sample.text}
        </div>
      ))}
    </div>
  );
};

const FOOTER_ACTION_BUTTON_CLASS =
  'inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2 text-[10px] font-semibold uppercase leading-none transition-colors';

const WebFontCardFooter: React.FC<{
  font: NonNullable<WebFontsSectionModel['fontsQuery']['data']>[number];
  typo: ReturnType<typeof getSettingsTypography>;
  scriptDisabled: boolean;
  onScriptSelect: (script: WebFontScript) => void;
  onCopyCss: () => void;
  onCopyStyle: () => void;
}> = ({ font, typo, scriptDisabled, onScriptSelect, onCopyCss, onCopyStyle }) => (
  <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
    <div
      role="radiogroup"
      aria-label={`Script for ${font.label}`}
      className="inline-flex items-center gap-1"
    >
      {WEB_FONT_SCRIPT_OPTIONS.map((option) => {
        const selected = font.script === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={scriptDisabled}
            onClick={() => {
              if (!selected) {
                onScriptSelect(option.value);
              }
            }}
            className={cn(
              typo.gridTypeBadge,
              'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md p-0 text-center uppercase leading-none transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-60',
              selected
                ? 'border-violet-300 bg-violet-100 text-violet-800'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>

    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onCopyCss}
        title="Copy @font-face CSS"
        aria-label={`Copy @font-face CSS for ${font.label}`}
        className={cn(
          typo.gridTypeBadge,
          FOOTER_ACTION_BUTTON_CLASS,
          'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
        )}
      >
        <Copy className="h-3 w-3" aria-hidden />
        CSS
      </button>
      <button
        type="button"
        onClick={onCopyStyle}
        title="Copy font-family style"
        aria-label={`Copy font-family style for ${font.label}`}
        className={cn(
          typo.gridTypeBadge,
          FOOTER_ACTION_BUTTON_CLASS,
          'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
        )}
      >
        <Copy className="h-3 w-3" aria-hidden />
        Style
      </button>
    </div>
  </div>
);

const WebFontPreviewToolbar: React.FC<{
  previewSize: WebFontPreviewSize;
  onPreviewSizeChange: (size: WebFontPreviewSize) => void;
  previewBold: boolean;
  onPreviewBoldChange: (value: boolean) => void;
  previewItalic: boolean;
  onPreviewItalicChange: (value: boolean) => void;
  typo: ReturnType<typeof getSettingsTypography>;
}> = ({
  previewSize,
  onPreviewSizeChange,
  previewBold,
  onPreviewBoldChange,
  previewItalic,
  onPreviewItalicChange,
  typo,
}) => (
  <div className="inline-flex items-center gap-1">
    <div
      role="radiogroup"
      aria-label="Preview text size"
      className="inline-flex items-center gap-1"
    >
      {WEB_FONT_PREVIEW_SIZE_OPTIONS.map((option) => {
        const selected = previewSize === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${option.label}px preview text`}
            title={`${option.label}px preview text`}
            onClick={() => {
              if (!selected) {
                onPreviewSizeChange(option.value);
              }
            }}
            className={cn(
              typo.gridMono,
              WEB_FONT_PREVIEW_SIZE_TOOLBAR_BUTTON_CLASS,
              'text-[11px] leading-none',
              selected
                ? 'border-violet-300 bg-violet-100 text-violet-800'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>

    <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />

    <button
      type="button"
      aria-pressed={previewBold}
      aria-label="Bold preview text"
      title="Bold preview text"
      onClick={() => onPreviewBoldChange(!previewBold)}
      className={cn(
        typo.gridTypeBadge,
        PREVIEW_TOOLBAR_ICON_TOGGLE_CLASS,
        previewBold
          ? 'border-violet-300 bg-violet-100 text-violet-800'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <Bold className="h-3.5 w-3.5" aria-hidden />
    </button>

    <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />

    <button
      type="button"
      aria-pressed={previewItalic}
      aria-label="Italic preview text"
      title="Italic preview text"
      onClick={() => onPreviewItalicChange(!previewItalic)}
      className={cn(
        typo.gridTypeBadge,
        PREVIEW_TOOLBAR_ICON_TOGGLE_CLASS,
        previewItalic
          ? 'border-violet-300 bg-violet-100 text-violet-800'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <Italic className="h-3.5 w-3.5" aria-hidden />
    </button>
  </div>
);

const WebFontCard: React.FC<{
  font: NonNullable<WebFontsSectionModel['fontsQuery']['data']>[number];
  page: WebFontsSectionModel;
  typo: ReturnType<typeof getSettingsTypography>;
}> = ({ font, page, typo }) => (
  <SettingsCard className="group relative">
      <div className="flex min-h-8 min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Type className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
          <span className={cn(typo.gridPrimary, CARD_META_ROW_CLASS, 'min-w-0 truncate')}>
            {font.label}
          </span>
        </div>
        <div className="flex h-8 shrink-0 items-center justify-end">
          <div className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              disabled={page.isDeleting}
              onClick={() => page.setDeleteTargetId(font.id)}
              title={`Delete ${font.label}`}
              aria-label={`Delete ${font.label}`}
              className={cn(
                ICON_ACTION_BUTTON_BASE_CLASS,
                'h-8 w-8',
                ICON_ACTION_DELETE_CLASS,
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <WebFontPreview
        font={font}
        previewSize={page.previewSize}
        previewBold={page.previewBold}
        previewItalic={page.previewItalic}
      />

      <WebFontCardFooter
        font={font}
        typo={typo}
        scriptDisabled={page.isUpdatingScript}
        onScriptSelect={(script) => { void page.updateFontScript(font.id, script); }}
        onCopyCss={() => {
          void page.copyFontSnippet(buildWebFontFaceCss(font), 'Font CSS copied.');
        }}
        onCopyStyle={() => {
          void page.copyFontSnippet(buildWebFontFamilyStyle(font), 'Font style copied.');
        }}
      />
  </SettingsCard>
);

export const WebFontsSection: React.FC<Props> = ({ page }) => {
  const { listToolbarCollapsed, handleGridScroll } = useListPageToolbarScroll();
  const typo = getSettingsTypography('web-fonts');
  const loadError = page.fontsQuery.isError ? page.fontsQuery.error : null;
  const fonts = page.fontsQuery.data ?? [];
  const filteredFonts = page.filteredFonts;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-slate-50 font-sans">
      <ListPageToolbarScrollHost collapsed={listToolbarCollapsed}>
      <div
        className={cn(
          `${PAGE_TOOLBAR_SINGLE_ROW_CLASS} justify-between gap-2 lg:gap-3`)}
      >
        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <ToolbarSearchInput
            value={page.searchInput}
            onChange={page.setSearchInput}
            placeholder="Filter by name or family…"
            ariaLabel="Search web fonts"
          />
          <div className="w-full min-w-0 sm:w-36">
            <UiSelect
              size="sm"
              value={page.scriptFilter}
              onChange={(event) => page.setScriptFilter(event.target.value as WebFontScriptFilter)}
              ariaLabel="Filter web fonts by language"
            >
              {WEB_FONT_SCRIPT_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </UiSelect>
          </div>
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <WebFontPreviewToolbar
            previewSize={page.previewSize}
            onPreviewSizeChange={page.setPreviewSize}
            previewBold={page.previewBold}
            onPreviewBoldChange={page.setPreviewBold}
            previewItalic={page.previewItalic}
            onPreviewItalicChange={page.setPreviewItalic}
            typo={typo}
          />
          <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
          <ToolbarActionGroupWithRefresh
            onRefresh={() => { void page.fontsQuery.refetch(); }}
            isRefreshing={page.fontsQuery.isFetching && !page.fontsQuery.isLoading}
            actions={[
              {
                id: 'upload-web-font',
                label: 'Upload Font',
                icon: <Upload className="h-3.5 w-3.5" aria-hidden="true" />,
                intent: 'create',
                primary: true,
                disabled: page.isUploading,
                onClick: page.openUploadPicker,
              },
            ]}
          />
        </div>
      </div>
      </ListPageToolbarScrollHost>

      <input
        ref={page.uploadInputRef}
        type="file"
        multiple
        accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          void page.handleFilesSelected(files);
        }}
      />

      {page.formError ? (
        <div className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {page.formError}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4" onScroll={handleGridScroll}>
        {page.fontsQuery.isLoading ? (
          <div className={cn('flex h-40 items-center justify-center', typo.loadingText)}>
            Loading web fonts...
          </div>
        ) : loadError ? (
          <QueryErrorPanel
            message="Failed to load web fonts."
            detail={formatQueryError(loadError, 'Could not load uploaded fonts.')}
            onRetry={() => { void page.fontsQuery.refetch(); }}
          />
        ) : fonts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
            <Type className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
            <p className="mt-3 text-sm font-medium text-slate-700">No uploaded web fonts yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Upload WOFF2, WOFF, TTF, or OTF files to use them as culture default fonts.
            </p>
          </div>
        ) : filteredFonts.length === 0 ? (
          <div className={cn('flex h-40 items-center justify-center', typo.loadingText)}>
            No web fonts match your filters.
          </div>
        ) : (
          <SettingsCardGrid columns={2}>
            {filteredFonts.map((font) => (
              <WebFontCard key={font.id} font={font} page={page} typo={typo} />
            ))}
          </SettingsCardGrid>
        )}
      </div>

      {page.deleteTargetId ? (
        <CreateEditModalShell
          size="md"
          title="Delete Web Font"
          onClose={() => page.setDeleteTargetId(null)}
          onBackdropClick={() => page.setDeleteTargetId(null)}
          footer={(
            <div className="flex justify-end gap-2">
              <AppButton intent="cancel" onClick={() => page.setDeleteTargetId(null)} disabled={page.isDeleting}>
                <X className="h-3.5 w-3.5" />
                Cancel
              </AppButton>
              <AppButton
                intent="destructive"
                size="sm"
                onClick={() => { void page.confirmDelete(); }}
                disabled={page.isDeleting}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </AppButton>
            </div>
          )}
        >
          <p className="text-sm text-slate-600">
            Delete this uploaded font? Cultures that use it will fall back to the bundle default on next save.
          </p>
        </CreateEditModalShell>
      ) : null}

      {page.toast ? (
        <AppToast type={page.toast.type} text={page.toast.text} />
      ) : null}
    </div>
  );
};
