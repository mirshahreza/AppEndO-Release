/** Theme Designer token that shows or hides AtmosphereBackdrop in the studio shell. */

export const ATMOSPHERE_GEOMETRY_TOKEN_KEY = '--app-atmosphere-geometry';
export const ATMOSPHERE_GEOMETRY_ON = 'on';
export const ATMOSPHERE_GEOMETRY_OFF = 'off';
export const ATMOSPHERE_GEOMETRY_DOCUMENT_ATTR = 'data-atmosphere-geometry';

export const isAtmosphereGeometryOn = (value: string | undefined | null): boolean => {
  const normalized = value?.trim().toLowerCase();
  return normalized !== ATMOSPHERE_GEOMETRY_OFF && normalized !== '0';
};

export const atmosphereGeometryTokenValue = (enabled: boolean): string => (
  enabled ? ATMOSPHERE_GEOMETRY_ON : ATMOSPHERE_GEOMETRY_OFF
);

export const syncAtmosphereGeometryDocumentAttr = (
  root: HTMLElement,
  value: string | undefined | null,
): void => {
  if (isAtmosphereGeometryOn(value)) {
    root.removeAttribute(ATMOSPHERE_GEOMETRY_DOCUMENT_ATTR);
    return;
  }
  root.setAttribute(ATMOSPHERE_GEOMETRY_DOCUMENT_ATTR, ATMOSPHERE_GEOMETRY_OFF);
};
