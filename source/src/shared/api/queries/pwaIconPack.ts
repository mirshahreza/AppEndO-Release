import { renderNavigationIconPwaSet } from '../../lib/navigationIcons/renderNavigationIconToPng';
import type { PwaSettings } from '../contracts/settings/pwa';
import { deletePwaIcon, uploadPwaIcon } from './pwa';

export async function applyPwaIconsFromNavigationPack(
  iconRef: string,
  colors: Pick<PwaSettings, 'themeColor'>,
): Promise<Pick<PwaSettings, 'faviconUrl' | 'icon192Url' | 'icon512Url' | 'maskableIcon512Url' | 'iconSourceRef'>> {
  const blobs = await renderNavigationIconPwaSet(iconRef, {
    backgroundColor: 'transparent',
    iconColor: colors.themeColor || '#0f172a',
  });

  const [faviconUrl, icon192Url, icon512Url, maskableIcon512Url] = await Promise.all([
    uploadPwaIcon('32', new File([blobs.icon32], 'icon-32.png', { type: 'image/png' })),
    uploadPwaIcon('192', new File([blobs.icon192], 'icon-192.png', { type: 'image/png' })),
    uploadPwaIcon('512', new File([blobs.icon512], 'icon-512.png', { type: 'image/png' })),
    uploadPwaIcon('maskable', new File([blobs.maskable512], 'icon-maskable-512.png', { type: 'image/png' })),
  ]);

  return {
    faviconUrl,
    icon192Url,
    icon512Url,
    maskableIcon512Url,
    iconSourceRef: iconRef,
  };
}

export async function clearCustomPwaIcons(): Promise<void> {
  await Promise.all([
    deletePwaIcon('32'),
    deletePwaIcon('192'),
    deletePwaIcon('512'),
    deletePwaIcon('maskable'),
  ]);
}
