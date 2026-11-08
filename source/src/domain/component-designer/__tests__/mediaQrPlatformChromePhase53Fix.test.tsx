/**
 * @vitest-environment jsdom
 *
 * Bug found (gap analysis §15.3–§15.5 + Phase 53): catalog had zero real Media Players
 * (video/audio), QR/Barcode generators, Command Palette / Notification Bell / User Menu,
 * or Chat Widget — `content.split-media` always rendered `<img>` even for video URLs.
 * Fixed in designerUniversalPalette / DesignerRuntimeMedia / DesignerRuntimePlatformChrome /
 * UiMediaPlayers / UiQrCode / UiBarcode / platformChromePalette / tsxUniversalPalette /
 * tsxPlatformPalette: video/audio players, mediaType on split-media (default image),
 * QR/barcode, platform chrome widgets, and a Phase-55-dependent chat stub.
 */
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import { generateDesignerTsx } from '../codegen';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { renderUniversalPaletteNode } from '../designerUniversalRuntime';
import { renderPlatformChromePaletteNode } from '../designerPlatformChromeRuntime';
import { DesignerUniversalSplitMedia } from '../DesignerRuntimeUniversalWidgets';
import { DesignerVideoPlayer, DesignerQrCode, DesignerBarcode } from '../DesignerRuntimeMedia';
import { UiVideoPlayer } from '../../../shared/ui/UiMediaPlayers';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import {
  DESIGNER_UNIVERSAL_PALETTE_ITEMS,
  UNIVERSAL_PALETTE_ITEM_IDS,
} from '../designerUniversalPalette';
import {
  DESIGNER_PLATFORM_CHROME_PALETTE_ITEMS,
  PLATFORM_CHROME_PALETTE_ITEM_IDS,
  isPlatformChromePaletteItemId,
} from '../platformChromePalette';
import { getPaletteItemById } from '../catalog';
import type { DesignerState } from '../types';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../propRegistry';

const insert = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: state.document.rootNodeId,
  });

const lastChildId = (state: DesignerState): string => {
  const parent = state.document.nodes[state.document.rootNodeId]!;
  return parent.children[parent.children.length - 1] as string;
};

beforeEach(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Phase 53 — media / QR / platform chrome / chat stub', () => {
  it('registers new content media + QR/barcode palette ids', () => {
    expect(UNIVERSAL_PALETTE_ITEM_IDS).toContain('content.video-player');
    expect(UNIVERSAL_PALETTE_ITEM_IDS).toContain('content.audio-player');
    expect(UNIVERSAL_PALETTE_ITEM_IDS).toContain('content.qr-code');
    expect(UNIVERSAL_PALETTE_ITEM_IDS).toContain('content.barcode');
    expect(DESIGNER_UNIVERSAL_PALETTE_ITEMS.some((item) => item.id === 'content.video-player')).toBe(true);
    expect(getPaletteItemById('content.split-media')?.defaultProps.mediaType).toBe('image');
  });

  it('registers platform chrome + chat stub palette ids', () => {
    expect(PLATFORM_CHROME_PALETTE_ITEM_IDS).toContain('platform-navigation.command-palette');
    expect(PLATFORM_CHROME_PALETTE_ITEM_IDS).toContain('platform-navigation.notification-bell');
    expect(PLATFORM_CHROME_PALETTE_ITEM_IDS).toContain('platform-navigation.user-menu');
    expect(isPlatformChromePaletteItemId('platform-navigation.command-palette')).toBe(true);
    expect(DESIGNER_PLATFORM_CHROME_PALETTE_ITEMS).toHaveLength(3);
    expect(getPaletteItemById('heroui.chat-widget')?.id).toBe('heroui.chat-widget');
  });

  it('split-media default mediaType=image preserves prior <img> behavior', () => {
    const { container } = render(
      <DesignerUniversalSplitMedia title="Hero" mediaSrc="https://cdn.example.com/a.jpg" />,
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/a.jpg');
    expect(container.querySelector('[data-media-type="image"]')).toBeTruthy();
    expect(container.querySelector('video')).toBeNull();
  });

  it('split-media mediaType=video renders a video element', () => {
    const { container } = render(
      <DesignerUniversalSplitMedia
        title="Clip"
        mediaType="video"
        mediaSrc="https://cdn.example.com/a.mp4"
      />,
    );
    expect(container.querySelector('video')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('video player play/pause controls update HTMLMediaElement state', async () => {
    const play = vi.fn(function play(this: HTMLMediaElement) {
      Object.defineProperty(this, 'paused', { configurable: true, get: () => false });
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    });
    const pause = vi.fn(function pause(this: HTMLMediaElement) {
      Object.defineProperty(this, 'paused', { configurable: true, get: () => true });
      this.dispatchEvent(new Event('pause'));
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play as typeof HTMLMediaElement.prototype.play);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(pause);

    const { container } = render(
      <UiVideoPlayer
        src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
        controls={false}
      />,
    );
    expect(container.querySelector('[data-designer-component="content.video-player"]')).toBeTruthy();
    fireEvent.click(screen.getByTestId('ui-video-play'));
    expect(play).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('ui-video-pause'));
    expect(pause).toHaveBeenCalled();
  });

  it.each([
    'content.video-player',
    'content.audio-player',
    'content.qr-code',
    'content.barcode',
  ] as const)('renders %s via universal runtime without crashing', (itemId) => {
    let state = insert(createInitialDesignerState(), itemId);
    const nodeId = lastChildId(state);
    const node = state.document.nodes[nodeId]!;
    const rendered = renderUniversalPaletteNode(node, { mode: 'runtime', style: {} });
    const { container } = render(<>{rendered}</>);
    expect(container.querySelector(`[data-designer-component="${itemId}"]`)).toBeTruthy();
  });

  it('renders QR and barcode with values', () => {
    const qr = render(<DesignerQrCode value="https://example.com/ticket/42" size={128} />);
    expect(qr.container.querySelector('[data-qr-value="https://example.com/ticket/42"]')).toBeTruthy();
    expect(qr.container.querySelector('[data-testid="ui-qr-svg"]')).toBeTruthy();

    const barcode = render(<DesignerBarcode value="CODE128TEST" format="CODE128" />);
    expect(barcode.container.querySelector('[data-barcode-value="CODE128TEST"]')).toBeTruthy();
  });

  it.each([
    'platform-navigation.command-palette',
    'platform-navigation.notification-bell',
    'platform-navigation.user-menu',
    'heroui.chat-widget',
  ] as const)('renders %s via platform chrome runtime', (itemId) => {
    let state = insert(createInitialDesignerState(), itemId);
    const nodeId = lastChildId(state);
    const node = state.document.nodes[nodeId]!;
    const rendered = renderPlatformChromePaletteNode(node, { mode: 'runtime', style: {} });
    const { container } = render(<>{rendered}</>);
    expect(container.querySelector(`[data-designer-component="${itemId}"]`)).toBeTruthy();
  });

  it('command palette opens on trigger click', () => {
    let state = insert(createInitialDesignerState(), 'platform-navigation.command-palette');
    const node = state.document.nodes[lastChildId(state)]!;
    const rendered = renderPlatformChromePaletteNode(node, { mode: 'runtime', style: {} });
    render(<>{rendered}</>);
    fireEvent.click(screen.getByTestId('command-palette-trigger'));
    expect(screen.getByTestId('command-palette-panel')).toBeTruthy();
  });

  it('chat widget is live-ready (Phase 55) without stub marker', () => {
    let state = insert(createInitialDesignerState(), 'heroui.chat-widget');
    const node = state.document.nodes[lastChildId(state)]!;
    const rendered = renderPlatformChromePaletteNode(node, { mode: 'runtime', style: {} });
    const { container } = render(<>{rendered}</>);
    expect(container.querySelector('[data-designer-component="heroui.chat-widget"]')).toBeTruthy();
    expect(container.querySelector('[data-requires-phase="55"]')).toBeNull();
    expect(container.querySelector('[data-testid="designer-chat-widget"]')).toBeTruthy();
  });

  it('inspector exposes expected keys for new Phase 53 elements', () => {
    let state = insert(createInitialDesignerState(), 'content.video-player');
    let keys = resolveInspectorFieldSections(state.document.nodes[lastChildId(state)]!)
      .flatMap((section) => section.fields.map((field) => field.key));
    expect(keys).toEqual(expect.arrayContaining(['src', 'controls', 'showCaptions', 'aspectRatio']));

    state = insert(createInitialDesignerState(), 'content.qr-code');
    keys = resolveInspectorFieldSections(state.document.nodes[lastChildId(state)]!)
      .flatMap((section) => section.fields.map((field) => field.key));
    expect(keys).toEqual(expect.arrayContaining(['value', 'size', 'errorCorrectionLevel']));

    state = insert(createInitialDesignerState(), 'platform-navigation.command-palette');
    keys = resolveInspectorFieldSections(state.document.nodes[lastChildId(state)]!)
      .flatMap((section) => section.fields.map((field) => field.key));
    expect(keys).toEqual(expect.arrayContaining(['hotkey', 'searchScopes', 'recentItemsCount']));
  });

  it.each([
    'content.video-player',
    'content.audio-player',
    'content.qr-code',
    'content.barcode',
    'platform-navigation.command-palette',
    'platform-navigation.notification-bell',
    'platform-navigation.user-menu',
    'heroui.chat-widget',
  ] as const)('exports valid TSX for %s', (itemId) => {
    const state = insert(createInitialDesignerState(), itemId);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    assertValidTsxSyntax(`phase53-${itemId}`, tsx);
    if (itemId === 'content.video-player') expect(tsx).toContain('DesignerVideoPlayer');
    if (itemId === 'content.audio-player') expect(tsx).toContain('DesignerAudioPlayer');
    if (itemId === 'content.qr-code') expect(tsx).toContain('DesignerQrCode');
    if (itemId === 'content.barcode') expect(tsx).toContain('DesignerBarcode');
    if (itemId === 'platform-navigation.command-palette') expect(tsx).toContain('DesignerCommandPalette');
    if (itemId === 'platform-navigation.notification-bell') expect(tsx).toContain('DesignerNotificationBell');
    if (itemId === 'platform-navigation.user-menu') expect(tsx).toContain('DesignerUserMenu');
    if (itemId === 'heroui.chat-widget') expect(tsx).toContain('DesignerChatWidget');
  });

  it('preview path renders video player node', () => {
    let state = insert(createInitialDesignerState(), 'content.video-player');
    const nodeId = lastChildId(state);
    expect(state.document.nodes[nodeId]?.props[DESIGNER_PALETTE_ITEM_ID_PROP]).toBe('content.video-player');
    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.querySelector('[data-designer-component="content.video-player"]')).toBeTruthy();
  });
});
