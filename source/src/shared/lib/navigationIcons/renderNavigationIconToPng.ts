import React from 'react';
import { createRoot } from 'react-dom/client';
import { NavigationIcon } from './NavigationIcon';
import { loadNavigationIconPack } from './navigationIconPacks';
import { parseNavigationIconRef } from './navigationIconRef';

export type RenderNavigationIconOptions = {
  backgroundColor?: string;
  iconColor?: string;
  /** Extra inset as a ratio of canvas size (maskable safe zone uses ~0.2). */
  paddingRatio?: number;
};

const ICON_VIEWBOX_SIZE = 24;

const waitForPaint = (): Promise<void> => new Promise((resolve) => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => resolve());
  });
});

function composeSvgToPngBlob(
  iconSvg: SVGElement,
  size: number,
  backgroundColor: string,
  iconColor: string,
  paddingRatio: number,
): Promise<Blob> {
  const iconSize = size * (1 - paddingRatio * 2);
  const offset = (size - iconSize) / 2;
  const scale = iconSize / ICON_VIEWBOX_SIZE;

  const iconMarkup = new XMLSerializer().serializeToString(iconSvg);
  const backgroundRect = backgroundColor && backgroundColor !== 'transparent'
    ? `<rect width="100%" height="100%" fill="${backgroundColor}" />`
    : '';
  const wrappedSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${backgroundRect}
      <g transform="translate(${offset} ${offset}) scale(${scale})" color="${iconColor}">
        ${iconMarkup.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}
      </g>
    </svg>
  `.trim();

  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(wrappedSvg)}`;

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas is not available.'));
        return;
      }

      context.drawImage(image, 0, 0, size, size);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to encode PNG.'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    };
    image.onerror = () => reject(new Error('Failed to render icon SVG.'));
    image.src = svgUrl;
  });
}

export async function renderNavigationIconToPng(
  iconRef: string,
  size: number,
  options: RenderNavigationIconOptions = {},
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Icon rendering requires a browser environment.');
  }

  const parsed = parseNavigationIconRef(iconRef);
  if (!parsed) {
    throw new Error('Invalid navigation icon reference.');
  }

  await loadNavigationIconPack(parsed.packId);

  const backgroundColor = options.backgroundColor ?? '#ffffff';
  const iconColor = options.iconColor ?? '#0f172a';
  const paddingRatio = Math.min(Math.max(options.paddingRatio ?? 0.12, 0), 0.4);
  const iconSize = Math.round(size * (1 - paddingRatio * 2));

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = `${iconSize}px`;
  container.style.height = `${iconSize}px`;
  container.style.color = iconColor;
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    root.render(
      React.createElement(NavigationIcon, {
        iconRef,
        className: 'h-full w-full',
      }),
    );
    await waitForPaint();

    const svg = container.querySelector('svg');
    if (!svg) {
      throw new Error(`Icon "${iconRef}" did not render an SVG.`);
    }

    return await composeSvgToPngBlob(svg, size, backgroundColor, iconColor, paddingRatio);
  } finally {
    root.unmount();
    container.remove();
  }
}

export async function renderNavigationIconPwaSet(
  iconRef: string,
  colors: { backgroundColor: string; iconColor?: string },
): Promise<{ icon32: Blob; icon192: Blob; icon512: Blob; maskable512: Blob }> {
  const shared = { backgroundColor: colors.backgroundColor, iconColor: colors.iconColor ?? '#ffffff' };
  const [icon32, icon192, icon512, maskable512] = await Promise.all([
    renderNavigationIconToPng(iconRef, 32, shared),
    renderNavigationIconToPng(iconRef, 192, shared),
    renderNavigationIconToPng(iconRef, 512, shared),
    renderNavigationIconToPng(iconRef, 512, { ...shared, paddingRatio: 0.2 }),
  ]);

  return { icon32, icon192, icon512, maskable512 };
}

export function isRenderableNavigationIconRef(iconRef: string): boolean {
  return Boolean(parseNavigationIconRef(iconRef));
}
