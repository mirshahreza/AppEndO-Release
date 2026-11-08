import * as React from 'react';
import {
  parseUiMapChoroplethRegions,
  parseUiMapPins,
  UiMapChoropleth,
  UiMapPin,
  type UiMapTileProvider,
} from '../../shared/ui/UiMap';
import type { DesignerNode } from './types';
import {
  MOCK_MAP_CHOROPLETH_JSON,
  MOCK_MAP_PINS_JSON,
} from './visualizationMockFixtures';
import { readNumber, readString } from './runtimeShared';
import { renderDesignerVizDataState } from './designerVizDataState';

export type DesignerMapPinRuntimeProps = {
  title?: string;
  data?: string;
  defaultCenter?: string;
  defaultZoom?: number;
  clusterMarkers?: boolean;
  tileProvider?: UiMapTileProvider | string;
  mapboxAccessToken?: string;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  isLoading?: boolean;
  emptyContent?: string;
  errorContent?: string;
};

export type DesignerMapChoroplethRuntimeProps = {
  title?: string;
  data?: string;
  regionLevel?: 'country' | 'province' | 'city' | string;
  colorScale?: string;
  geoJsonSource?: string;
  defaultCenter?: string;
  defaultZoom?: number;
  tileProvider?: UiMapTileProvider | string;
  mapboxAccessToken?: string;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  isLoading?: boolean;
  emptyContent?: string;
  errorContent?: string;
};

const parseCenter = (raw: unknown): [number, number] | undefined => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length >= 2) {
      const lat = Number(parsed[0]);
      const lng = Number(parsed[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return [lat, lng];
      }
    }
  } catch {
    const parts = raw.split(',').map((part) => Number(part.trim()));
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return [parts[0], parts[1]];
    }
  }
  return undefined;
};

const parseColorScale = (raw: unknown): [string, string] | undefined => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length >= 2 && typeof parsed[0] === 'string' && typeof parsed[1] === 'string') {
      return [parsed[0], parsed[1]];
    }
  } catch {
    const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return [parts[0], parts[1]];
    }
  }
  return undefined;
};

const resolveTileProvider = (raw: unknown): UiMapTileProvider => {
  if (raw === 'mapbox' || raw === 'google' || raw === 'osm') {
    return raw;
  }
  return 'osm';
};

export const DesignerVizMapPin: React.FC<DesignerMapPinRuntimeProps> = ({
  title = '',
  data,
  defaultCenter,
  defaultZoom = 5,
  clusterMarkers = false,
  tileProvider = 'osm',
  mapboxAccessToken,
  height = 320,
  className,
  style,
  isLoading,
  emptyContent,
  errorContent,
}) => {
  const pins = parseUiMapPins(data ?? MOCK_MAP_PINS_JSON);
  return (
    <div className={className} style={style} data-designer-component="viz.map-pin">
      {title.length > 0 ? (
        <div className="mb-2 ps-[4px] text-sm font-semibold text-slate-800">{title}</div>
      ) : null}
      {renderDesignerVizDataState({
        isLoading,
        loadingMessage: 'Loading map…',
        hasError: false,
        errorContent,
        isEmpty: pins.length === 0,
        emptyContent,
        children: (
          <UiMapPin
            data={pins}
            defaultCenter={parseCenter(defaultCenter)}
            defaultZoom={defaultZoom}
            clusterMarkers={clusterMarkers}
            tileProvider={resolveTileProvider(tileProvider)}
            mapboxAccessToken={mapboxAccessToken}
            height={height}
          />
        ),
      })}
    </div>
  );
};

export const DesignerVizMapChoropleth: React.FC<DesignerMapChoroplethRuntimeProps> = ({
  title = '',
  data,
  regionLevel = 'province',
  colorScale,
  geoJsonSource,
  defaultCenter,
  defaultZoom = 5,
  tileProvider = 'osm',
  mapboxAccessToken,
  height = 320,
  className,
  style,
  isLoading,
  emptyContent,
  errorContent,
}) => {
  const regions = parseUiMapChoroplethRegions(data ?? MOCK_MAP_CHOROPLETH_JSON);
  const level = regionLevel === 'country' || regionLevel === 'city' || regionLevel === 'province'
    ? regionLevel
    : 'province';
  return (
    <div className={className} style={style} data-designer-component="viz.map-choropleth">
      {title.length > 0 ? (
        <div className="mb-2 ps-[4px] text-sm font-semibold text-slate-800">{title}</div>
      ) : null}
      {renderDesignerVizDataState({
        isLoading,
        loadingMessage: 'Loading map…',
        hasError: false,
        errorContent,
        isEmpty: regions.length === 0,
        emptyContent,
        children: (
          <UiMapChoropleth
            data={regions}
            regionLevel={level}
            colorScale={parseColorScale(colorScale)}
            geoJsonSource={geoJsonSource}
            defaultCenter={parseCenter(defaultCenter)}
            defaultZoom={defaultZoom}
            tileProvider={resolveTileProvider(tileProvider)}
            mapboxAccessToken={mapboxAccessToken}
            height={height}
          />
        ),
      })}
    </div>
  );
};

export const resolveMapPinPropsFromNode = (node: DesignerNode): DesignerMapPinRuntimeProps => ({
  title: readString(node.props.title),
  data: readString(node.props.data, MOCK_MAP_PINS_JSON),
  defaultCenter: readString(node.props.defaultCenter, '[32.4279,53.688]'),
  defaultZoom: readNumber(node.props.defaultZoom, 5),
  clusterMarkers: node.props.clusterMarkers === true,
  tileProvider: readString(node.props.tileProvider, 'osm'),
  mapboxAccessToken: readString(node.props.mapboxAccessToken) || undefined,
  height: readNumber(node.props.height, 320),
  className: readString(node.props.className, 'w-full rounded-lg border border-slate-200 bg-white p-3'),
  isLoading: node.props.isLoading === true,
  emptyContent: readString(node.props.emptyContent),
  errorContent: readString(node.props.errorContent),
});

export const resolveMapChoroplethPropsFromNode = (node: DesignerNode): DesignerMapChoroplethRuntimeProps => ({
  title: readString(node.props.title),
  data: readString(node.props.data, MOCK_MAP_CHOROPLETH_JSON),
  regionLevel: readString(node.props.regionLevel, 'province'),
  colorScale: readString(node.props.colorScale, '["#dbeafe","#1d4ed8"]'),
  geoJsonSource: readString(node.props.geoJsonSource) || undefined,
  defaultCenter: readString(node.props.defaultCenter, '[32.4279,53.688]'),
  defaultZoom: readNumber(node.props.defaultZoom, 5),
  tileProvider: readString(node.props.tileProvider, 'osm'),
  mapboxAccessToken: readString(node.props.mapboxAccessToken) || undefined,
  height: readNumber(node.props.height, 320),
  className: readString(node.props.className, 'w-full rounded-lg border border-slate-200 bg-white p-3'),
  isLoading: node.props.isLoading === true,
  emptyContent: readString(node.props.emptyContent),
  errorContent: readString(node.props.errorContent),
});
