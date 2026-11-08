import { describe, expect, it } from 'vitest';
import { buildUiMapChoroplethMountKey, buildUiMapPinMountKey } from '../UiMap';

describe('UiMap mount keys', () => {
  it('stays stable when pin arrays and centers are rebuilt with the same values', () => {
    const first = buildUiMapPinMountKey({
      data: [{ lat: 35.7, lng: 51.4, label: 'Tehran HQ' }],
      defaultCenter: [32.4279, 53.688],
      defaultZoom: 5,
      clusterMarkers: false,
      tileProvider: 'osm',
    });
    const second = buildUiMapPinMountKey({
      data: [{ lat: 35.7, lng: 51.4, label: 'Tehran HQ' }],
      defaultCenter: [32.4279, 53.688],
      defaultZoom: 5,
      clusterMarkers: false,
      tileProvider: 'osm',
    });
    expect(second).toBe(first);
  });

  it('changes when a pin coordinate changes', () => {
    const first = buildUiMapPinMountKey({
      data: [{ lat: 35.7, lng: 51.4 }],
      defaultZoom: 5,
      clusterMarkers: false,
      tileProvider: 'osm',
    });
    const second = buildUiMapPinMountKey({
      data: [{ lat: 35.8, lng: 51.4 }],
      defaultZoom: 5,
      clusterMarkers: false,
      tileProvider: 'osm',
    });
    expect(second).not.toBe(first);
  });

  it('stays stable when choropleth geojson is rebuilt with the same regions', () => {
    const geoJson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [],
    };
    const first = buildUiMapChoroplethMountKey({
      data: [{ regionCode: 'TEH', value: 12 }],
      colorScale: ['#dbeafe', '#1d4ed8'],
      defaultCenter: [32.4279, 53.688],
      defaultZoom: 5,
      tileProvider: 'osm',
      geoJson,
    });
    const second = buildUiMapChoroplethMountKey({
      data: [{ regionCode: 'TEH', value: 12 }],
      colorScale: ['#dbeafe', '#1d4ed8'],
      defaultCenter: [32.4279, 53.688],
      defaultZoom: 5,
      tileProvider: 'osm',
      geoJson: { type: 'FeatureCollection', features: [] },
    });
    expect(second).toBe(first);
  });
});
