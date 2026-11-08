import type { BaseInfoRow } from '../../base-info/types';

export type GeoNodeKind = 'province' | 'ghavateh' | 'circle' | 'maktab' | 'region';

const KIND_PREFIX: Record<GeoNodeKind, string> = {
  province: 'hwy-province-',
  ghavateh: 'hwy-ghavateh-',
  circle: 'hwy-circle-',
  maktab: 'hwy-maktab-',
  region: 'hwy-region-',
};

const KIND_LABEL: Record<GeoNodeKind, string> = {
  province: 'Province',
  ghavateh: 'Ghavateh',
  circle: 'Circle',
  maktab: 'Maktab',
  region: 'Region',
};

const KIND_LEVEL_COLOR: Record<GeoNodeKind, string> = {
  province: '#8FAF9A',
  ghavateh: '#C4A88E',
  circle: '#7BA7C4',
  maktab: '#A3B18A',
  region: '#B8A9C9',
};

const parseMetadataKind = (metadata: string | null | undefined): GeoNodeKind | null => {
  const raw = String(metadata || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { hwyGeoKind?: string };
    const kind = String(parsed.hwyGeoKind || '').trim() as GeoNodeKind;
    if (kind in KIND_LABEL) return kind;
  } catch {
    // ignore invalid JSON
  }
  return null;
};

export const resolveGeoNodeKind = (row: Pick<BaseInfoRow, 'short_name' | 'metadata'> | null | undefined): GeoNodeKind | null => {
  if (!row) return null;
  const fromMeta = parseMetadataKind(row.metadata);
  if (fromMeta) return fromMeta;
  const shortName = String(row.short_name || '').trim().toLowerCase();
  for (const [kind, prefix] of Object.entries(KIND_PREFIX) as [GeoNodeKind, string][]) {
    if (shortName.startsWith(prefix)) return kind;
  }
  return null;
};

export const geoNodeKindLabel = (kind: GeoNodeKind | null | undefined): string | null => (
  kind ? KIND_LABEL[kind] : null
);

export const geoNodeKindColor = (kind: GeoNodeKind | null | undefined): string | null => (
  kind ? KIND_LEVEL_COLOR[kind] : null
);

export const resolveGeoNodeTypeLabel = (row: BaseInfoRow | null | undefined): string | null => (
  geoNodeKindLabel(resolveGeoNodeKind(row))
);
