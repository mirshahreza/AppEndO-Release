import React, { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import {
  formatNavigationIconRef,
  formatNavigationIconRefLabel,
} from '../../../shared/lib/navigationIcons/navigationIconRef';
import { listNavigationIconPacks } from '../../../shared/lib/navigationIcons/iconPackManifest';
import { loadNavigationIconPack, NAVIGATION_ICON_PACKS } from '../../../shared/lib/navigationIcons/navigationIconPacks';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import type { NavigationIconPackId } from '../../../shared/lib/navigationIcons/types';
import { useNavigationIconPackEntries } from '../../../shared/lib/navigationIcons/useNavigationIconPackEntries';
import { AppButton, CreateEditModalShell, UiInput, UiSelect } from '../../../shared/ui';
import { SETTINGS_CONTROL_CLASS, SETTINGS_SUBSECTION_LABEL_CLASS } from './form/SettingsFormPrimitives';
import { cn } from '../../../lib/utils';

const DEFAULT_ICON_BY_PACK: Record<NavigationIconPackId, string> = {
  lucide: 'box',
  tabler: 'box',
  phosphor: 'package',
  heroicons: 'cube',
  solar: 'box-bold',
  doodle: 'Box',
  marketeq: 'box',
};

type PwaIconPackPickerModalProps = {
  open: boolean;
  initialIconRef?: string;
  themeColor: string;
  onClose: () => void;
  onApply: (iconRef: string) => void | Promise<void>;
};

export const PwaIconPackPickerModal: React.FC<PwaIconPackPickerModalProps> = ({
  open,
  initialIconRef,
  themeColor,
  onClose,
  onApply,
}) => {
  const navigationPacks = useMemo(() => listNavigationIconPacks(), []);
  const [packId, setPackId] = useState<NavigationIconPackId>(navigationPacks[0]?.id ?? 'lucide');
  const [search, setSearch] = useState('');
  const [selectedIconRef, setSelectedIconRef] = useState(
    initialIconRef?.trim() || formatNavigationIconRef('lucide', DEFAULT_ICON_BY_PACK.lucide),
  );
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { iconNames, isLoading } = useNavigationIconPackEntries(packId, open);

  const filteredIcons = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return iconNames;
    }
    return iconNames.filter((name) => name.toLowerCase().includes(query));
  }, [iconNames, search]);

  if (!open) {
    return null;
  }

  const handleApply = async () => {
    setError(null);
    setIsApplying(true);
    try {
      await onApply(selectedIconRef);
      onClose();
    } catch (caught) {
      setError((caught as Error).message || 'Failed to apply icon.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <CreateEditModalShell
      size="lg"
      title="Pick PWA icon from library"
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <div className="flex justify-end gap-2">
          <AppButton intent="cancel" onClick={onClose} disabled={isApplying}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton intent="primary" onClick={() => void handleApply()} disabled={isApplying}>
            <Check className="h-3.5 w-3.5" />
            {isApplying ? 'Generating…' : 'Apply icon set'}
          </AppButton>
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          Choose a navigation icon. AppEndO generates favicon 32×32, 192×192, 512×512, and maskable icons on a transparent background using your theme color for the glyph.
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
          <div className="flex flex-col gap-[2px]">
            <label className={SETTINGS_SUBSECTION_LABEL_CLASS}>Pack</label>
            <UiSelect
              value={packId}
              size="sm"
              className={SETTINGS_CONTROL_CLASS}
              onChange={(event) => {
                const nextPackId = event.target.value as NavigationIconPackId;
                setPackId(nextPackId);
                void loadNavigationIconPack(nextPackId);
                setSelectedIconRef(formatNavigationIconRef(nextPackId, DEFAULT_ICON_BY_PACK[nextPackId]));
              }}
            >
              {navigationPacks.map((pack) => (
                <option key={pack.id} value={pack.id}>{pack.label}</option>
              ))}
            </UiSelect>
          </div>

          <div className="flex flex-col gap-[2px]">
            <label className={SETTINGS_SUBSECTION_LABEL_CLASS}>Search</label>
            <UiInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="icon name"
              className={SETTINGS_CONTROL_CLASS}
              size="sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200 bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%,#e2e8f0),linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%,#e2e8f0)] bg-[length:12px_12px] bg-[position:0_0,6px_6px] shadow-sm"
          >
            <NavigationIcon iconRef={selectedIconRef} className="h-10 w-10" style={{ color: themeColor }} />
          </div>
          <div className="min-w-0 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{formatNavigationIconRefLabel(selectedIconRef)}</p>
            <p className="mt-1 text-slate-500">Transparent background · glyph uses your theme color.</p>
          </div>
        </div>

        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading icons…</p>
        ) : (
          <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6 md:grid-cols-8">
            {filteredIcons.slice(0, 160).map((iconName) => {
              const iconRef = formatNavigationIconRef(packId, iconName);
              const isSelected = iconRef === selectedIconRef;
              return (
                <button
                  key={iconRef}
                  type="button"
                  title={iconRef}
                  onClick={() => setSelectedIconRef(iconRef)}
                  className={cn(
                    'flex h-12 items-center justify-center rounded-md border bg-white transition hover:border-primary/40',
                    isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200',
                  )}
                >
                  <NavigationIcon iconRef={iconRef} className="h-5 w-5 text-slate-700" />
                </button>
              );
            })}
          </div>
        )}

        {!isLoading && filteredIcons.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            No icons match the current search.
          </div>
        ) : null}

        <p className="text-xs text-slate-500">
          Showing up to 160 matches from {NAVIGATION_ICON_PACKS.find((pack) => pack.id === packId)?.label ?? packId}.
        </p>
      </div>
    </CreateEditModalShell>
  );
};
