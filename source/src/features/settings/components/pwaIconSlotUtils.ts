import type { PwaSettings } from '../../../shared/api/contracts/settings/pwa';
import type { PwaIconSlot } from '../../../shared/lib/pwaAssets';

export const PWA_ICON_SLOTS: readonly PwaIconSlot[] = ['32', '192', '512', 'maskable'];

export const PWA_SLOT_FIELD: Record<PwaIconSlot, keyof Pick<PwaSettings,
  'faviconUrl' | 'icon192Url' | 'icon512Url' | 'maskableIcon512Url'
>> = {
  '32': 'faviconUrl',
  '192': 'icon192Url',
  '512': 'icon512Url',
  maskable: 'maskableIcon512Url',
};

export type GeneratedPwaIconSet = Pick<PwaSettings,
  'faviconUrl' | 'icon192Url' | 'icon512Url' | 'maskableIcon512Url' | 'iconSourceRef'
>;

export const buildPwaIconPatch = (
  icons: GeneratedPwaIconSet,
  slot: PwaIconSlot,
  scope: 'all' | 'single',
): Partial<PwaSettings> => {
  if (scope === 'all') {
    return icons;
  }

  const field = PWA_SLOT_FIELD[slot];
  return { [field]: icons[field] };
};

export const slotsForScope = (slot: PwaIconSlot, scope: 'all' | 'single'): PwaIconSlot[] =>
  scope === 'all' ? [...PWA_ICON_SLOTS] : [slot];
