import * as React from 'react';
import type { Map as LeafletMap, Marker as LeafletMarker, LatLngExpression } from 'leaflet';

/**
 * Map / Geo visualization primitives (Phase 52) — pin map + choropleth over OpenStreetMap/Leaflet.
 * Leaflet is loaded dynamically (never at module top-level) so non-jsdom Node tests that
 * transitively import designerVizRuntime stay safe.
 */

export type UiMapTileProvider = 'osm' | 'mapbox' | 'google';

export type UiMapPin = {
  lat: number;
  lng: number;
  label?: string;
  id?: string;
};

export type UiMapChoroplethRegion = {
  regionCode: string;
  value: number;
  label?: string;
};

export type UiMapPinProps = {
  data: UiMapPin[];
  defaultCenter?: [number, number];
  defaultZoom?: number;
  clusterMarkers?: boolean;
  tileProvider?: UiMapTileProvider;
  mapboxAccessToken?: string;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
};

export type UiMapChoroplethProps = {
  data: UiMapChoroplethRegion[];
  regionLevel?: 'country' | 'province' | 'city';
  colorScale?: [string, string];
  geoJsonSource?: string;
  geoJson?: GeoJSON.FeatureCollection;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  tileProvider?: UiMapTileProvider;
  mapboxAccessToken?: string;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
};

const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const resolveTileUrl = (
  provider: UiMapTileProvider | undefined,
  mapboxAccessToken?: string,
): { url: string; attribution: string } => {
  if (provider === 'mapbox' && mapboxAccessToken && mapboxAccessToken.trim().length > 0) {
    return {
      url: `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/{z}/{x}/{y}?access_token=${encodeURIComponent(mapboxAccessToken.trim())}`,
      attribution: '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; OpenStreetMap',
    };
  }
  if (provider === 'google') {
    return { url: OSM_TILE, attribution: OSM_ATTRIBUTION };
  }
  return { url: OSM_TILE, attribution: OSM_ATTRIBUTION };
};

const isBrowserMapAvailable = (): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/jsdom|HappyDOM/i.test(userAgent)) {
    return false;
  }
  return true;
};

type LeafletModule = typeof import('leaflet');

const loadLeaflet = async (): Promise<LeafletModule | null> => {
  if (!isBrowserMapAvailable()) {
    return null;
  }
  const leaflet = await import('leaflet');
  await import('leaflet/dist/leaflet.css');
  const L = leaflet.default ?? leaflet;
  const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
  L.Marker.prototype.options.icon = DefaultIcon;
  return L;
};

const colorForValue = (
  value: number,
  min: number,
  max: number,
  colorScale: [string, string],
): string => {
  const span = max === min ? 1 : max - min;
  const t = Math.min(1, Math.max(0, (value - min) / span));
  return t < 0.5 ? colorScale[0] : colorScale[1];
};

const buildFallbackChoroplethGeoJson = (
  regions: UiMapChoroplethRegion[],
): GeoJSON.FeatureCollection => {
  const originLat = 32.4;
  const originLng = 53.6;
  const features: GeoJSON.Feature[] = regions.map((region, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const west = originLng + col * 2.2;
    const south = originLat + row * 1.6;
    const east = west + 1.8;
    const north = south + 1.3;
    return {
      type: 'Feature',
      properties: {
        regionCode: region.regionCode,
        value: region.value,
        label: region.label ?? region.regionCode,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ]],
      },
    };
  });
  return { type: 'FeatureCollection', features };
};

export const parseUiMapPins = (raw: unknown): UiMapPin[] => {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return (parsed as unknown[])
    .map((entry): UiMapPin | null => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const lat = Number(record.lat ?? record.latitude);
      const lng = Number(record.lng ?? record.lon ?? record.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }
      return {
        lat,
        lng,
        label: typeof record.label === 'string' ? record.label : undefined,
        id: typeof record.id === 'string' ? record.id : undefined,
      };
    })
    .filter((entry): entry is UiMapPin => entry !== null);
};

export const parseUiMapChoroplethRegions = (raw: unknown): UiMapChoroplethRegion[] => {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return (parsed as unknown[])
    .map((entry): UiMapChoroplethRegion | null => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const regionCode = String(record.regionCode ?? record.code ?? record.id ?? '').trim();
      const value = Number(record.value);
      if (!regionCode || !Number.isFinite(value)) {
        return null;
      }
      return {
        regionCode,
        value,
        label: typeof record.label === 'string' ? record.label : undefined,
      };
    })
    .filter((entry): entry is UiMapChoroplethRegion => entry !== null);
};

/** Stable effect key so equivalent pin props do not remount Leaflet (hover rerenders). */
export function buildUiMapPinMountKey(props: Pick<
  UiMapPinProps,
  'data' | 'defaultCenter' | 'defaultZoom' | 'clusterMarkers' | 'tileProvider' | 'mapboxAccessToken'
>): string {
  return JSON.stringify({
    data: props.data,
    defaultCenter: props.defaultCenter ?? null,
    defaultZoom: props.defaultZoom ?? 5,
    clusterMarkers: Boolean(props.clusterMarkers),
    tileProvider: props.tileProvider ?? 'osm',
    mapboxAccessToken: props.mapboxAccessToken ?? '',
  });
}

/** Stable effect key so equivalent choropleth props do not remount Leaflet. */
export function buildUiMapChoroplethMountKey(props: Pick<
  UiMapChoroplethProps,
  'data' | 'colorScale' | 'defaultCenter' | 'defaultZoom' | 'tileProvider' | 'mapboxAccessToken'
> & { geoJson: GeoJSON.FeatureCollection | null }): string {
  return JSON.stringify({
    data: props.data,
    colorScale: props.colorScale ?? null,
    defaultCenter: props.defaultCenter ?? null,
    defaultZoom: props.defaultZoom ?? 5,
    tileProvider: props.tileProvider ?? 'osm',
    mapboxAccessToken: props.mapboxAccessToken ?? '',
    geoJson: props.geoJson,
  });
}

const MapFallbackList: React.FC<{
  title: string;
  lines: string[];
  height: number;
  className?: string;
  style?: React.CSSProperties;
  dataComponent: string;
}> = ({ title, lines, height, className, style, dataComponent }) => (
  <div
    className={className}
    style={{ ...style, height, minHeight: height }}
    data-designer-component={dataComponent}
    data-map-fallback="true"
  >
    <div className="mb-2 ps-[4px] text-sm font-semibold text-slate-800">{title}</div>
    <ul className="m-0 list-disc space-y-1 ps-5 text-xs text-slate-600">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  </div>
);

export const UiMapPin: React.FC<UiMapPinProps> = ({
  data,
  defaultCenter,
  defaultZoom = 5,
  clusterMarkers = false,
  tileProvider = 'osm',
  mapboxAccessToken,
  height = 320,
  className,
  style,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const [useFallback, setUseFallback] = React.useState(!isBrowserMapAvailable());
  const mountKey = buildUiMapPinMountKey({
    data,
    defaultCenter,
    defaultZoom,
    clusterMarkers,
    tileProvider,
    mapboxAccessToken,
  });
  const pinMountRef = React.useRef({
    data,
    defaultCenter,
    defaultZoom,
    clusterMarkers,
    tileProvider,
    mapboxAccessToken,
  });
  pinMountRef.current = {
    data,
    defaultCenter,
    defaultZoom,
    clusterMarkers,
    tileProvider,
    mapboxAccessToken,
  };

  React.useEffect(() => {
    let cancelled = false;

    const mount = async () => {
      if (!containerRef.current) {
        return;
      }
      const L = await loadLeaflet();
      if (cancelled || !L || !containerRef.current) {
        if (!cancelled && !L) {
          setUseFallback(true);
        }
        return;
      }
      const next = pinMountRef.current;
      setUseFallback(false);
      mapRef.current?.remove();
      mapRef.current = null;

      const center: LatLngExpression = next.defaultCenter
        ?? (next.data[0] ? [next.data[0].lat, next.data[0].lng] : [32.4279, 53.688]);
      const map = L.map(containerRef.current, {
        center,
        zoom: next.defaultZoom,
        scrollWheelZoom: false,
      });
      const tile = resolveTileUrl(next.tileProvider, next.mapboxAccessToken);
      L.tileLayer(tile.url, { attribution: tile.attribution, maxZoom: 19 }).addTo(map);

      const markers: LeafletMarker[] = [];
      for (const pin of next.data) {
        const marker = L.marker([pin.lat, pin.lng]);
        if (pin.label) {
          marker.bindPopup(pin.label);
        }
        marker.addTo(map);
        markers.push(marker);
      }

      if ((next.clusterMarkers || markers.length > 1) && markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.2));
      } else if (markers.length === 1) {
        map.setView([next.data[0].lat, next.data[0].lng], next.defaultZoom);
      }

      if (cancelled) {
        map.remove();
        return;
      }
      mapRef.current = map;
    };

    void mount();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mountKey]);

  React.useEffect(() => {
    mapRef.current?.invalidateSize();
  }, [height]);

  if (useFallback) {
    return (
      <MapFallbackList
        title="Map pins"
        lines={data.map((pin) => `${pin.label ?? 'Pin'}: ${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`)}
        height={height}
        className={className}
        style={style}
        dataComponent="viz.map-pin"
      />
    );
  }

  return (
    <div
      className={className}
      style={style}
      data-designer-component="viz.map-pin"
      data-map-provider={tileProvider}
      data-map-pin-count={String(data.length)}
    >
      <div ref={containerRef} style={{ height, width: '100%' }} data-map-canvas="pin" />
    </div>
  );
};

export const UiMapChoropleth: React.FC<UiMapChoroplethProps> = ({
  data,
  regionLevel = 'province',
  colorScale = ['#dbeafe', '#1d4ed8'],
  geoJsonSource,
  geoJson,
  defaultCenter = [32.4279, 53.688],
  defaultZoom = 5,
  tileProvider = 'osm',
  mapboxAccessToken,
  height = 320,
  className,
  style,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const [useFallback, setUseFallback] = React.useState(!isBrowserMapAvailable());
  const [resolvedGeoJson, setResolvedGeoJson] = React.useState<GeoJSON.FeatureCollection | null>(
    geoJson ?? null,
  );
  const dataKey = JSON.stringify(data);
  const geoJsonSourceKey = geoJsonSource?.trim() ?? '';
  const dataRef = React.useRef(data);
  dataRef.current = data;

  React.useEffect(() => {
    if (geoJson) {
      setResolvedGeoJson(geoJson);
      return;
    }
    if (!geoJsonSourceKey) {
      const next = buildFallbackChoroplethGeoJson(dataRef.current);
      setResolvedGeoJson((current) => (
        JSON.stringify(current) === JSON.stringify(next) ? current : next
      ));
      return;
    }
    let cancelled = false;
    void fetch(geoJsonSourceKey)
      .then((response) => response.json())
      .then((json) => {
        if (!cancelled) {
          setResolvedGeoJson(json as GeoJSON.FeatureCollection);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedGeoJson(buildFallbackChoroplethGeoJson(dataRef.current));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [geoJson, geoJsonSourceKey, dataKey]);

  const mountKey = buildUiMapChoroplethMountKey({
    data,
    colorScale,
    defaultCenter,
    defaultZoom,
    tileProvider,
    mapboxAccessToken,
    geoJson: resolvedGeoJson,
  });
  const choroMountRef = React.useRef({
    data,
    colorScale,
    defaultCenter,
    defaultZoom,
    tileProvider,
    mapboxAccessToken,
    resolvedGeoJson,
  });
  choroMountRef.current = {
    data,
    colorScale,
    defaultCenter,
    defaultZoom,
    tileProvider,
    mapboxAccessToken,
    resolvedGeoJson,
  };

  React.useEffect(() => {
    let cancelled = false;

    const mount = async () => {
      const next = choroMountRef.current;
      if (!containerRef.current || !next.resolvedGeoJson) {
        return;
      }
      const L = await loadLeaflet();
      if (cancelled || !L || !containerRef.current) {
        if (!cancelled && !L) {
          setUseFallback(true);
        }
        return;
      }
      setUseFallback(false);
      mapRef.current?.remove();
      mapRef.current = null;

      const map = L.map(containerRef.current, {
        center: next.defaultCenter,
        zoom: next.defaultZoom,
        scrollWheelZoom: false,
      });
      const tile = resolveTileUrl(next.tileProvider, next.mapboxAccessToken);
      L.tileLayer(tile.url, { attribution: tile.attribution, maxZoom: 19 }).addTo(map);

      const valueByCode = new Map(next.data.map((region) => [region.regionCode, region.value]));
      const values = next.data.map((region) => region.value);
      const min = values.length > 0 ? Math.min(...values) : 0;
      const max = values.length > 0 ? Math.max(...values) : 1;

      const layer = L.geoJSON(next.resolvedGeoJson as GeoJSON.GeoJsonObject, {
        style: (feature) => {
          const code = String(feature?.properties?.regionCode ?? feature?.properties?.code ?? '');
          const value = valueByCode.get(code) ?? Number(feature?.properties?.value ?? 0);
          return {
            fillColor: colorForValue(value, min, max, next.colorScale),
            weight: 1,
            color: '#64748b',
            fillOpacity: 0.75,
          };
        },
        onEachFeature: (feature, featureLayer) => {
          const props = feature.properties ?? {};
          const code = String(props.regionCode ?? props.code ?? '');
          const label = String(props.label ?? code);
          const value = valueByCode.get(code) ?? Number(props.value ?? 0);
          featureLayer.bindPopup(`${label}: ${value}`);
        },
      }).addTo(map);

      try {
        map.fitBounds(layer.getBounds().pad(0.1));
      } catch {
        map.setView(next.defaultCenter, next.defaultZoom);
      }

      if (cancelled) {
        map.remove();
        return;
      }
      mapRef.current = map;
    };

    void mount();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mountKey]);

  React.useEffect(() => {
    mapRef.current?.invalidateSize();
  }, [height]);

  if (useFallback) {
    return (
      <MapFallbackList
        title={`Choropleth (${regionLevel})`}
        lines={data.map((region) => `${region.label ?? region.regionCode}: ${region.value}`)}
        height={height}
        className={className}
        style={style}
        dataComponent="viz.map-choropleth"
      />
    );
  }

  return (
    <div
      className={className}
      style={style}
      data-designer-component="viz.map-choropleth"
      data-map-provider={tileProvider}
      data-map-region-level={regionLevel}
      data-map-region-count={String(data.length)}
    >
      <div ref={containerRef} style={{ height, width: '100%' }} data-map-canvas="choropleth" />
    </div>
  );
};
