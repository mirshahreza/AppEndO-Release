import fs from 'fs';
import path from 'path';
import { runtimeDirs } from '../../core/runtime/runtimePaths';
import { toPwaPlatformAssetUrl, type PwaIconSlot } from '../../shared/lib/pwaAssets';

export type { PwaIconSlot } from '../../shared/lib/pwaAssets';

const SLOT_FILE_STEM: Record<PwaIconSlot, string> = {
  '32': 'icon-32',
  '192': 'icon-192',
  '512': 'icon-512',
  maskable: 'icon-maskable-512',
};

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const extensionFromFileName = (fileName: string): string | null => {
  const extension = path.extname(fileName).toLowerCase();
  return ALLOWED_EXTENSIONS.has(extension) ? extension : null;
};

export function getPwaAssetsRootPath(): string {
  return path.join(process.cwd(), runtimeDirs.platformPwa);
}

export function ensurePwaAssetsDir(): string {
  const root = getPwaAssetsRootPath();
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function listSlotFiles(root: string, slot: PwaIconSlot): string[] {
  const stem = SLOT_FILE_STEM[slot];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith(`${stem}.`))
    .map((entry) => entry.name);
}

function deleteSlotFiles(root: string, slot: PwaIconSlot): void {
  for (const fileName of listSlotFiles(root, slot)) {
    fs.unlinkSync(path.join(root, fileName));
  }
}

export function writePwaIcon(
  slot: PwaIconSlot,
  fileName: string,
  content: Buffer,
): { ok: true; url: string } | { ok: false; error: string } {
  const extension = extensionFromFileName(fileName);
  if (!extension) {
    return { ok: false, error: 'PWA icons must be PNG, JPEG, or WebP images.' };
  }

  const root = ensurePwaAssetsDir();
  deleteSlotFiles(root, slot);

  const relativePath = `${SLOT_FILE_STEM[slot]}${extension}`;
  const absPath = path.join(root, relativePath);
  fs.writeFileSync(absPath, content);

  return {
    ok: true,
    url: toPwaPlatformAssetUrl(relativePath),
  };
}

export function deletePwaIcon(
  slot: PwaIconSlot,
): { ok: true } | { ok: false; error: string } {
  const root = ensurePwaAssetsDir();
  const existing = listSlotFiles(root, slot);
  if (existing.length === 0) {
    return { ok: true };
  }

  try {
    deleteSlotFiles(root, slot);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message || 'Failed to delete PWA icon.' };
  }
}

export function parsePwaIconSlot(value: string): PwaIconSlot | null {
  if (value === '32' || value === '192' || value === '512' || value === 'maskable') {
    return value;
  }
  return null;
}

export function resolveRuntimePwaIconUrl(slot: PwaIconSlot): string | null {
  const root = getPwaAssetsRootPath();
  if (!fs.existsSync(root)) {
    return null;
  }

  const files = listSlotFiles(root, slot);
  if (files.length === 0) {
    return null;
  }

  return toPwaPlatformAssetUrl(files[0]!);
}

export function hydratePwaSettingsIconUrls<T extends {
  faviconUrl: string;
  icon192Url: string;
  icon512Url: string;
  maskableIcon512Url: string;
}>(settings: T): T {
  const withRuntimeUrl = (current: string, slot: PwaIconSlot): string => {
    if (current.trim()) {
      return current;
    }
    return resolveRuntimePwaIconUrl(slot) ?? '';
  };

  return {
    ...settings,
    faviconUrl: withRuntimeUrl(settings.faviconUrl, '32'),
    icon192Url: withRuntimeUrl(settings.icon192Url, '192'),
    icon512Url: withRuntimeUrl(settings.icon512Url, '512'),
    maskableIcon512Url: withRuntimeUrl(settings.maskableIcon512Url, 'maskable'),
  };
}
