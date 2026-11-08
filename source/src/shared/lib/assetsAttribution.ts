import { ICON_PACK_MANIFEST } from './navigationIcons/iconPackManifest';

export type AssetsAttributionEntry = {
  id: string;
  type: 'icon-pack';
  label: string;
  license: string;
  attributionRequired: boolean;
  suggestedText?: string;
  author: string;
  homepage?: string;
};

export type AssetsAttributionManifest = {
  version: number;
  generatedAt: string;
  entries: AssetsAttributionEntry[];
};

export function buildAssetsAttributionManifest(generatedAt = new Date().toISOString()): AssetsAttributionManifest {
  return {
    version: 1,
    generatedAt,
    entries: ICON_PACK_MANIFEST.map((entry) => ({
      id: entry.id,
      type: 'icon-pack' as const,
      label: entry.label,
      license: entry.license,
      attributionRequired: entry.attributionRequired,
      suggestedText: entry.suggestedAttribution,
      author: entry.author,
      homepage: entry.homepage,
    })),
  };
}

export const ASSETS_ATTRIBUTION_MANIFEST = buildAssetsAttributionManifest();

export function listRequiredAttributionEntries(): AssetsAttributionEntry[] {
  return ASSETS_ATTRIBUTION_MANIFEST.entries.filter((entry) => entry.attributionRequired);
}
