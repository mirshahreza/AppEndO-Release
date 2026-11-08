// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import {
  ATMOSPHERE_GEOMETRY_DOCUMENT_ATTR,
  ATMOSPHERE_GEOMETRY_OFF,
  ATMOSPHERE_GEOMETRY_ON,
  ATMOSPHERE_GEOMETRY_TOKEN_KEY,
  atmosphereGeometryTokenValue,
  isAtmosphereGeometryOn,
  syncAtmosphereGeometryDocumentAttr,
} from '../atmosphereGeometry';
import { applyThemeTokenMapToDocument } from '../themePresetUtils';

afterEach(() => {
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute(ATMOSPHERE_GEOMETRY_DOCUMENT_ATTR);
});

describe('atmosphereGeometry', () => {
  it('defaults to on when the token is missing', () => {
    expect(isAtmosphereGeometryOn(undefined)).toBe(true);
    expect(isAtmosphereGeometryOn('on')).toBe(true);
    expect(isAtmosphereGeometryOn('off')).toBe(false);
    expect(isAtmosphereGeometryOn('0')).toBe(false);
    expect(atmosphereGeometryTokenValue(true)).toBe(ATMOSPHERE_GEOMETRY_ON);
    expect(atmosphereGeometryTokenValue(false)).toBe(ATMOSPHERE_GEOMETRY_OFF);
  });

  it('toggles the document attribute used by the shell CSS', () => {
    const root = document.documentElement;
    syncAtmosphereGeometryDocumentAttr(root, ATMOSPHERE_GEOMETRY_OFF);
    expect(root.getAttribute(ATMOSPHERE_GEOMETRY_DOCUMENT_ATTR)).toBe(ATMOSPHERE_GEOMETRY_OFF);

    syncAtmosphereGeometryDocumentAttr(root, ATMOSPHERE_GEOMETRY_ON);
    expect(root.hasAttribute(ATMOSPHERE_GEOMETRY_DOCUMENT_ATTR)).toBe(false);
  });

  it('applies the document attribute from a theme token map', () => {
    applyThemeTokenMapToDocument({
      [ATMOSPHERE_GEOMETRY_TOKEN_KEY]: ATMOSPHERE_GEOMETRY_OFF,
    });
    expect(document.documentElement.getAttribute(ATMOSPHERE_GEOMETRY_DOCUMENT_ATTR)).toBe(
      ATMOSPHERE_GEOMETRY_OFF,
    );
    expect(document.documentElement.style.getPropertyValue(ATMOSPHERE_GEOMETRY_TOKEN_KEY)).toBe(
      ATMOSPHERE_GEOMETRY_OFF,
    );

    applyThemeTokenMapToDocument({
      [ATMOSPHERE_GEOMETRY_TOKEN_KEY]: ATMOSPHERE_GEOMETRY_ON,
    });
    expect(document.documentElement.hasAttribute(ATMOSPHERE_GEOMETRY_DOCUMENT_ATTR)).toBe(false);
  });
});
