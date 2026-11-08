import React from 'react';
import { Images, Trash2, Upload } from 'lucide-react';
import type { PwaSettings } from '../../../shared/api/contracts/settings/pwa';
import { buildPwaIconPreviewSrc } from '../../../shared/api/contracts/settings/pwa';
import type { PwaIconSlot } from '../../../shared/lib/pwaAssets';
import { deletePwaIcon } from '../../../shared/api/queries/pwa';
import { cn } from '../../../lib/utils';
import { getSettingsTypography } from '../settingsSectionTypography';
import {
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_DELETE_CLASS,
} from '../../../shared/ui/surfaceClasses';
import {
  SPLIT_BUTTON_MENU_ITEM_CLASS,
  SPLIT_BUTTON_MENU_PANEL_CLASS,
  useSplitButtonMenu,
} from '../../../shared/ui/AppSplitButton';
import {
  SETTINGS_FIELD_LABEL_BAND_CLASS,
  SettingsLabelInfoRow,
  useSettingsFormSection,
} from './form/SettingsFormPrimitives';

const PWA_ICON_PREVIEW_SIZE = 40;

type PwaIconFieldProps = {
  label: string;
  labelInfo?: string;
  slot: PwaIconSlot;
  pwa: PwaSettings;
  disabled?: boolean;
  isBusy?: boolean;
  previewCacheKey?: string | number;
  onPickFromLibrary: () => void;
  onUploadFile: (file: File) => void;
  onChange: (url: string) => void;
};

export const PwaIconField: React.FC<PwaIconFieldProps> = ({
  label,
  labelInfo,
  slot,
  pwa,
  disabled = false,
  isBusy = false,
  previewCacheKey,
  onPickFromLibrary,
  onUploadFile,
  onChange,
}) => {
  const section = useSettingsFormSection();
  const typography = section?.typography ?? getSettingsTypography('pwa');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = useSplitButtonMenu(menuOpen, setMenuOpen);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [previewBroken, setPreviewBroken] = React.useState(false);
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [localPreviewRevision, setLocalPreviewRevision] = React.useState(0);
  const customUrl = React.useMemo(() => {
    switch (slot) {
      case '32':
        return pwa.faviconUrl.trim();
      case '192':
        return pwa.icon192Url.trim();
      case '512':
        return pwa.icon512Url.trim();
      case 'maskable':
        return pwa.maskableIcon512Url.trim();
      default:
        return '';
    }
  }, [pwa.faviconUrl, pwa.icon192Url, pwa.icon512Url, pwa.maskableIcon512Url, slot]);
  const previewSrc = React.useMemo(() => {
    const cacheBust = previewCacheKey ?? (localPreviewRevision || undefined);
    return buildPwaIconPreviewSrc(slot, pwa, cacheBust);
  }, [localPreviewRevision, pwa, previewCacheKey, slot]);

  React.useEffect(() => {
    setLocalPreviewRevision(Date.now());
    setPreviewBroken(false);
  }, [customUrl, previewCacheKey]);

  React.useEffect(() => {
    setPreviewBroken(false);
  }, [previewSrc]);

  const resolvedLabelInfo = labelInfo ?? (
    customUrl
      ? undefined
      : 'Using the built-in default icon until you choose a custom image.'
  );

  const fieldDisabled = disabled || isBusy || isRemoving;

  const openMenu = () => {
    if (fieldDisabled) {
      return;
    }
    setMenuOpen((previous) => !previous);
  };

  const handlePickFromLibrary = () => {
    setMenuOpen(false);
    onPickFromLibrary();
  };

  const openFilePicker = () => {
    setMenuOpen(false);
    inputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) {
      return;
    }
    setUploadError(null);
    onUploadFile(file);
  };

  const handleRemove = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (fieldDisabled || !customUrl) {
      return;
    }

    setUploadError(null);
    setIsRemoving(true);
    try {
      await deletePwaIcon(slot);
      setLocalPreviewRevision(Date.now());
      onChange('');
    } catch (error) {
      setUploadError((error as Error).message || 'Failed to remove PWA icon.');
    } finally {
      setIsRemoving(false);
    }
  };

  const showPreview = !previewBroken;

  return (
    <div className={cn('flex min-w-0 flex-col gap-[2px]', disabled && 'opacity-60')}>
      <div className="grid min-h-10 grid-cols-[40px_minmax(0,1fr)] items-center gap-2">
        <div ref={menuRef} className="group relative h-10 w-10 shrink-0">
          <button
            type="button"
            disabled={fieldDisabled}
            onClick={openMenu}
            aria-label={`Change ${label}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            style={{ width: PWA_ICON_PREVIEW_SIZE, height: PWA_ICON_PREVIEW_SIZE }}
            className={cn(
              'relative flex items-center justify-center overflow-hidden rounded-md border border-slate-300',
              'bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%,#f1f5f9),linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%,#f1f5f9)] bg-[length:10px_10px] bg-[position:0_0,5px_5px]',
              'transition-colors hover:border-indigo-400',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200',
              'disabled:cursor-not-allowed',
            )}
          >
            {showPreview ? (
              <img
                src={previewSrc}
                alt=""
                className="h-full w-full object-contain"
                onError={() => setPreviewBroken(true)}
              />
            ) : (
              <Upload className="h-5 w-5 text-slate-400" aria-hidden />
            )}
          </button>

          {menuOpen ? (
            <div
              className={cn(SPLIT_BUTTON_MENU_PANEL_CLASS, 'left-0 min-w-[11rem]')}
              role="menu"
              aria-label={`${label} actions`}
            >
              <button
                type="button"
                role="menuitem"
                className={SPLIT_BUTTON_MENU_ITEM_CLASS}
                onClick={handlePickFromLibrary}
              >
                <Images className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Pick from icon library
              </button>
              <button
                type="button"
                role="menuitem"
                className={SPLIT_BUTTON_MENU_ITEM_CLASS}
                onClick={openFilePicker}
              >
                <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Upload image
              </button>
            </div>
          ) : null}

          {customUrl && showPreview ? (
            <div
              className={cn(
                'absolute bottom-0.5 right-0.5 opacity-0 transition-opacity',
                'group-hover:opacity-100 group-focus-within:opacity-100',
              )}
            >
              <button
                type="button"
                tabIndex={-1}
                title="Remove icon"
                aria-label={`Remove ${label}`}
                disabled={fieldDisabled}
                className={cn(
                  ICON_ACTION_BUTTON_SM_CLASS,
                  ICON_ACTION_DELETE_CLASS,
                  'bg-white/90 shadow-sm',
                )}
                onClick={(event) => void handleRemove(event)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={fieldDisabled}
            onChange={handleFileChange}
            className="hidden"
            aria-hidden
            tabIndex={-1}
          />
        </div>

        <div className={cn(SETTINGS_FIELD_LABEL_BAND_CLASS, 'min-h-10 items-center')}>
          <SettingsLabelInfoRow
            label={label}
            labelInfo={resolvedLabelInfo}
            labelClassName={typography.fieldLabel}
          />
        </div>
      </div>

      {uploadError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
          {uploadError}
        </p>
      ) : null}
    </div>
  );
};
