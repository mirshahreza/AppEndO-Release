// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import type { DesignerDocument, DesignerNode } from '../../../../domain/component-designer/types';
import { AccentThemeProvider } from '../../../../contexts/AccentThemeContext';
import { CultureProvider } from '../../../../core/culture/CultureContext';
import { ACCENT_STORAGE_KEY } from '../../../theme/accentColorUtils';
import { LANDING_WIDGET_FIXTURES } from '../../landing-widgets';
import { createCreativeSceneFixture } from '../../creative-scenes';
import { getShellEffectPreset, SHELL_EFFECT_CATALOG } from '../../shell-effects';
import {
  DesignerDocumentShellRenderer,
  isRegisteredShellRuntimeComponentId,
} from '..';

function documentWith(nodes: DesignerNode[]): DesignerDocument {
  return {
    schemaVersion: '1.0.0',
    id: 'compiled-shell',
    name: 'Compiled shell',
    rootNodeId: 'root',
    nodes: Object.fromEntries([
      ['root', {
        id: 'root',
        type: 'root',
        parentId: null,
        order: 0,
        props: {},
        layout: {},
        binding: {},
        children: nodes.filter((node) => node.parentId === 'root').map((node) => node.id),
      }],
      ...nodes.map((node) => [node.id, node]),
    ]),
    metadata: {
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    diagnostics: [],
  };
}

function systemNode(
  id: string,
  refId: string,
  parentId: string,
  children: string[] = [],
  props: Record<string, unknown> = {},
): DesignerNode {
  return {
    id,
    type: 'container',
    parentId,
    order: 0,
    props,
    layout: {},
    binding: {},
    componentRef: { refType: 'system', refId },
    children,
  };
}

const renderShell = (ui: React.ReactElement) => render(
  <CultureProvider cultureId="us">{ui}</CultureProvider>,
);

describe('DesignerDocumentShellRenderer', () => {
  afterEach(cleanup);

  it('renders compiled foundation and route outlet through production components', () => {
    const document = documentWith([
      systemNode('frame', 'ShellFrame', 'root', ['main'], { colorScheme: 'light' }),
      systemNode('main', 'ShellRegion', 'frame', ['content'], { regionId: 'main' }),
      systemNode('content', 'ShellContentHost', 'main', ['outlet'], { contentWidth: 'full' }),
      {
        id: 'outlet',
        type: 'system-slot',
        parentId: 'content',
        order: 0,
        props: { slotId: 'core.shell.route-outlet' },
        layout: {},
        binding: {},
        children: [],
      },
    ]);

    renderShell(
      <DesignerDocumentShellRenderer
        document={document}
        runtimeSlots={{ routeOutlet: <div data-testid="route-content">Route content</div> }}
      />,
    );

    expect(screen.getByTestId('route-content')).toBeInTheDocument();
    expect(screen.getByTestId('route-content').closest('[data-shell-content-host]')).toBeInTheDocument();
    expect(screen.getByTestId('route-content').closest('[data-shell-frame]')).toBeInTheDocument();
  });

  it('resolves landing and creative IDs to production exports and keeps semantic fallbacks', () => {
    const widget = LANDING_WIDGET_FIXTURES['landing-feature-grid'];
    const scene = createCreativeSceneFixture('scene-layered-hero');
    const document = documentWith([
      systemNode('landing', 'LandingFeatureGrid', 'root', [], {
        widgetId: widget.id,
        props: widget.props,
      }),
      systemNode('scene', 'CreativeSceneRenderer', 'root', [], { config: scene }),
      systemNode('unknown', 'TrustedFutureShellComponent', 'root'),
    ]);

    renderShell(<DesignerDocumentShellRenderer document={document} />);

    expect(document.nodes.landing.componentRef?.refId).toBe('LandingFeatureGrid');
    expect(screen.getByText(widget.props.heading)).toBeInTheDocument();
    expect(document.nodes.scene.componentRef?.refId).toBe('CreativeSceneRenderer');
    expect(document.nodes.unknown.componentRef?.refId).toBe('TrustedFutureShellComponent');
    expect(screen.getByText(scene.content.heading)).toBeInTheDocument();
    expect(screen.getByText('TrustedFutureShellComponent')).toBeInTheDocument();
    expect(screen.getByText('This trusted shell component is unavailable.')).toBeInTheDocument();
  });

  it('registers compiler-emitted production component IDs', () => {
    [
      'ShellFrame',
      'ShellTopMegaNavigation',
      'ShellEffectLayer',
      'LandingFeatureGrid',
      'CreativeSceneRenderer',
      'ThreeProductStage',
    ].forEach((id) => expect(isRegisteredShellRuntimeComponentId(id), id).toBe(true));
  });

  it('routes generated accent controls through the shared persisted accent context', () => {
    localStorage.removeItem(ACCENT_STORAGE_KEY);
    const document = documentWith([
      systemNode('accent', 'ShellAccentControl', 'root'),
    ]);
    render(
      <CultureProvider cultureId="us">
        <AccentThemeProvider>
          <DesignerDocumentShellRenderer document={document} />
        </AccentThemeProvider>
      </CultureProvider>,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Emerald' }));
    const stored = JSON.parse(localStorage.getItem(ACCENT_STORAGE_KEY) ?? '{}');
    expect(stored).toMatchObject({ source: 'default' });
    expect(stored.hex).toMatch(/^#[0-9A-F]{6}$/);
    expect(globalThis.document.documentElement.style.getPropertyValue('--color-primary-500')).toBe(stored.hex);
  });

  it('maps frame, header, content, surface, density, and effects options to observable runtime styling', () => {
    const document = documentWith([
      systemNode('frame', 'ShellFrame', 'root', ['header', 'main'], {
        colorScheme: 'dark',
        chromeDensity: 'spacious',
        contentDensity: 'compact',
        effectsIsolation: true,
        effectsOverflow: 'clip',
        designTokens: {
          profile: 'custom',
          accent: { source: 'custom', value: { colorSpace: 'srgb', components: [1, 0, 0], alpha: 1, hex: '#cc3344' } },
          neutralFamily: 'zinc',
          surfaceBias: 'warm',
        },
        typography: {
          roles: {
            body: {
              color: { source: 'semantic', token: 'surface-foreground' },
              fontProfileId: 'editorial',
              size: 'md',
              weight: 'regular',
              lineHeight: 'normal',
              tracking: 'normal',
              transform: 'none',
            },
            navigation: {
              color: { source: 'semantic', token: 'neutral' },
              fontProfileId: 'inter',
              size: 'sm',
              weight: 'medium',
              lineHeight: 'normal',
              tracking: 'normal',
              transform: 'none',
            },
          },
        },
        backdrop: { mode: 'solid', baseColor: { source: 'custom', value: { colorSpace: 'srgb', components: [1, 1, 1], alpha: 1, hex: '#f8f4ee' } } },
        shapeDepth: {
          radius: { global: 'xl' },
          shadow: { level: 'lg', softness: 'balanced', target: 'layered' },
          border: { strength: 'defined', contrast: 'medium' },
          backdrop: { style: 'solid', blur: 'none' },
        },
      }),
      systemNode('header', 'ShellHeader', 'frame', [], {
        regionId: 'header',
        presence: 'visible',
        width: 'inset',
        placement: 'center',
        padding: 'sm',
        gap: 'md',
        separator: 'hairline',
        visibility: { desktop: true, tablet: true, phone: true },
        surface: {
          treatment: { mode: 'solid', baseColor: { source: 'custom', value: { colorSpace: 'srgb', components: [1, 1, 1], alpha: 1, hex: '#ffffff' } } },
          shapeDepth: {
            radius: { global: 'lg' },
            shadow: { level: 'md', softness: 'balanced', target: 'chrome-only' },
            border: { strength: 'soft', contrast: 'low' },
            backdrop: { style: 'solid', blur: 'none' },
          },
          readability: 'solid-panel',
        },
        behavior: 'sticky',
        height: 'tall',
        composition: 'stacked-brand-nav',
        brandPlacement: 'center',
        edgeStyle: 'floating-bar',
      }),
      systemNode('main', 'ShellRegion', 'frame', ['content'], { regionId: 'main', responsiveStrategy: 'adaptive', mobileNavigation: 'drawer' }),
      systemNode('content', 'ShellContentHost', 'main', [], {
        regionId: 'content',
        presence: 'visible',
        width: 'contained',
        padding: 'none',
        gap: 'none',
        separator: 'none',
        visibility: { desktop: true, tablet: true, phone: true },
        contentDensity: 'compact',
        composition: 'aside-content',
        contentWidth: 'boxed-sm',
        hostStyle: 'inset-panel',
        separation: 'shadow',
        gutter: 'spacious',
        dockPadding: true,
        scrollOwner: 'content-host',
        scrollShadow: true,
      }),
    ]);
    const { container } = renderShell(<DesignerDocumentShellRenderer document={document} />);
    const frame = container.querySelector<HTMLElement>('[data-shell-frame]')!;
    const header = container.querySelector<HTMLElement>('[data-shell-header]')!;
    const content = container.querySelector<HTMLElement>('[data-shell-content-host]')!;

    expect(frame).toHaveAttribute('data-effects-overflow', 'clip');
    expect(frame.className).toContain('overflow-clip');
    expect(frame.className).toContain('rounded-xl');
    expect(frame.style.backgroundColor).toBe('rgb(248, 244, 238)');
    expect(frame.style.getPropertyValue('--shell-accent')).toBe('#cc3344');
    expect(frame.style.fontFamily).toContain('Georgia');
    expect(header.className).toContain('flex-col');
    expect(header.className).toContain('shadow-lg');
    expect(header.closest('[data-shell-region="header"]')?.className).toContain('w-[calc(100%-2rem)]');
    expect(content.className).toContain('max-w-3xl');
    expect(content.className).toContain('gap-8');
    expect(content.className).toContain('shadow-md');
    expect(content.className).toContain('p-2');
    expect(content).toHaveAttribute('data-scroll-owner', 'content-host');
  });

  it('applies the active phone override structurally', () => {
    const document = documentWith([
      systemNode('frame', 'ShellFrame', 'root', ['main'], { colorScheme: 'light' }),
      systemNode('main', 'ShellRegion', 'frame', ['content'], { regionId: 'main' }),
      systemNode('content', 'ShellContentHost', 'main', [], {
        regionId: 'content',
        presence: 'visible',
        width: 'contained',
        visibility: { desktop: true, tablet: true, phone: true },
        responsive: {
          phone: { presence: 'visible', span: 'full', order: 4, safeArea: 'inline', scrollOwner: 'content-host' },
        },
      }),
    ]);
    const { container } = renderShell(<DesignerDocumentShellRenderer document={document} viewport="phone" />);
    const region = container.querySelector<HTMLElement>('[data-shell-region="content"]')!;
    expect(region.className).toContain('w-full');
    expect(region.className).toContain('ps-[env(safe-area-inset-left)]');
    expect(region.style.order).toBe('4');
    expect(container.querySelector('[data-shell-content-host]')).toHaveAttribute('data-scroll-owner', 'content-host');
  });

  it('bounds ShellFrame chrome while keeping effects on the full-bleed frame', () => {
    const preset = getShellEffectPreset('aurora');
    const document = documentWith([
      systemNode('frame', 'ShellFrame', 'root', ['effect', 'main'], {
        colorScheme: 'light',
        layoutWidth: 'bounded',
        boundedEdge: 'outset',
      }),
      systemNode('effect', 'ShellEffectLayer', 'frame', [], {
        id: 'layer-bounded-frame',
        effectId: 'aurora',
        target: 'page',
        plane: 'background',
        ...preset.layer,
      }),
      systemNode('main', 'ShellRegion', 'frame', ['content'], { regionId: 'main' }),
      systemNode('content', 'ShellContentHost', 'main', [], { contentWidth: 'fluid' }),
    ]);
    const { container } = renderShell(<DesignerDocumentShellRenderer document={document} />);
    const frame = container.querySelector('[data-shell-frame]')!;
    expect(frame).toHaveAttribute('data-shell-layout-width', 'bounded');
    expect(frame.querySelector('[data-shell-bounded-chrome]')).toBeTruthy();
    expect(frame.querySelector('[data-shell-effect-id="aurora"]')).toBeTruthy();
    expect(frame.querySelector('[data-shell-effect-id="aurora"]')?.closest('[data-shell-bounded-chrome]')).toBeNull();
  });

  it('wraps container shells in a bounded canvas when metadata requests it', () => {
    const document = documentWith([
      {
        id: 'shell-root',
        type: 'container',
        parentId: 'root',
        order: 0,
        props: { className: 'admin-shell-surface shell-atmosphere h-screen w-full flex overflow-hidden' },
        layout: {},
        binding: {},
        children: ['content'],
      },
      systemNode('content', 'ShellContentHost', 'shell-root', [], { contentWidth: 'fluid' }),
    ]);
    document.metadata.shellLayoutWidth = 'bounded';
    const { container } = renderShell(<DesignerDocumentShellRenderer document={document} />);
    expect(container.querySelector('[data-shell-layout-canvas]')).toBeTruthy();
    expect(container.querySelector('[data-shell-bounded-chrome]')).toBeTruthy();
  });

  it('forwards controlled viewport and paused motion to runtime effects', () => {
    const preset = getShellEffectPreset('particle-field');
    const document = documentWith([
      systemNode('effect', 'ShellEffectLayer', 'root', [], {
        id: 'layer-preview-particles',
        target: SHELL_EFFECT_CATALOG['particle-field'].targets[0],
        plane: 'background',
        ...preset.layer,
        reducedMotionFallback: 'static',
      }),
    ]);
    const { container } = renderShell(
      <DesignerDocumentShellRenderer document={document} viewport="phone" motionPaused />,
    );
    const effect = container.querySelector<HTMLElement>('[data-shell-effect-id="particle-field"]')!;
    expect(effect).toHaveAttribute('data-paused', 'true');
    expect(effect.querySelector('[data-effect-fallback]')).toHaveAttribute('data-effect-fallback', 'static');
  });
});
