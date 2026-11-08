/**
 * @vitest-environment jsdom
 *
 * Phase T1-9 — Dual-Mode Content Blocks + contact-form Preset + split-media mediaSrc.
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createInitialDesignerState, designerReducer } from '../state';
import {
  buildContentBindingConnectActions,
  buildContentDualModeDisableActions,
  buildContentDualModeEnableActions,
  CONTENT_DATA_MODE_PROP,
  CONTENT_DATA_RESOURCE_BINDING_KEY,
  collectDocumentContentPlan,
  DUAL_MODE_CONTENT_PALETTE_IDS,
  getContentDataMode,
  getNodeContentDataResourceRef,
  isContentDataBoundNode,
  isDualModeContentNode,
} from '../bindingContentEngine';
import { collectDocumentBindingPlan } from '../bindingEngine';
import { generateDesignerTsx } from '../codegen';
import { getPaletteItemById, DESIGNER_PALETTE } from '../catalog';
import { UNIVERSAL_PALETTE_ITEM_IDS } from '../designerUniversalPalette';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../propRegistry';
import { LEGACY_REMOVED_PALETTE_IDS } from '../runtimeShared';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { validateDesignerDocument } from '../validation';
import { PRESET_WIDGET_PARITY_CHECKLIST } from '../toolboxInventory';
import { MOCK_BLOG_POSTS_JSON } from '../universalMockFixtures';
import { getTemplateForPreset } from '../../../domain/component-designer/layout-presets/newLayoutPresets';

const insertNode = (state: ReturnType<typeof createInitialDesignerState>, itemId: string, parentId: string) => {
  const next = designerReducer(state, { type: 'insert-palette-item', itemId, parentId });
  const parent = next.document.nodes[parentId];
  const childId = parent.children[parent.children.length - 1];
  return { state: next, nodeId: childId };
};

const seedPostsDataSource = (state: ReturnType<typeof createInitialDesignerState>) =>
  designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'posts',
    dataSource: {
      id: 'posts',
      name: 'Posts',
      endpoint: '/api/posts',
      fields: ['id', 'title', 'summary', 'date', 'label', 'value', 'iconName', 'mediaSrc'],
      primaryKey: 'id',
      operations: { list: { method: 'GET', endpoint: '/api/posts' } },
    },
  });

describe('T1-9 Dual-Mode Content Blocks', () => {
  it('lists every Dual-Mode palette id from the phase prompt', () => {
    expect([...DUAL_MODE_CONTENT_PALETTE_IDS].sort()).toEqual([
      'content.audio-player',
      'content.barcode',
      'content.blog-card',
      'content.carousel',
      'content.cta-banner',
      'content.description-list',
      'content.feature-grid',
      'content.icon',
      'content.qr-code',
      'content.segmented-control',
      'content.split-media',
      'content.stat-trend',
      'content.stepper',
      'content.team-member',
      'content.video-player',
      'marketing.faq-accordion',
      'marketing.hero-cta',
      'marketing.newsletter-signup',
      'marketing.pricing-table',
      'marketing.testimonial-carousel',
    ].sort());
    expect(DUAL_MODE_CONTENT_PALETTE_IDS).not.toContain('content.contact-form-block');
  });

  it('pilot content.blog-card: static export keeps mock JSON and never clears props on mode toggle', () => {
    let state = createInitialDesignerState();
    const inserted = insertNode(state, 'content.blog-card', state.document.rootNodeId);
    state = inserted.state;
    const nodeId = inserted.nodeId;
    const staticData = String(state.document.nodes[nodeId]!.props.data ?? MOCK_BLOG_POSTS_JSON);

    state = seedPostsDataSource(state);
    for (const action of buildContentDualModeEnableActions(nodeId)) {
      state = designerReducer(state, action);
    }
    expect(getContentDataMode(state.document.nodes[nodeId]!)).toBe('bound');
    expect(state.document.nodes[nodeId]!.props.data).toBe(staticData);

    for (const action of buildContentBindingConnectActions(state.document.nodes[nodeId]!, state.bindingDefinitions.dataSources.posts!)) {
      state = designerReducer(state, action);
    }
    expect(isContentDataBoundNode(state.document.nodes[nodeId]!)).toBe(true);
    expect(state.document.nodes[nodeId]!.props.data).toBe(staticData);

    for (const action of buildContentDualModeDisableActions(nodeId)) {
      state = designerReducer(state, action);
    }
    expect(getContentDataMode(state.document.nodes[nodeId]!)).toBe('static');
    expect(getNodeContentDataResourceRef(state.document.nodes[nodeId]!)).toBeUndefined();
    expect(state.document.nodes[nodeId]!.props.data).toBe(staticData);

    const staticTsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(staticTsx).toContain('DesignerUniversalBlogCardList');
    expect(staticTsx).not.toContain('contentData_');
    expect(staticTsx).not.toMatch(/useDataFetch[\s\S]*contentData_/);
  });

  it('pilot content.blog-card: bindable mode emits useDataFetch + contentData var', () => {
    let state = createInitialDesignerState();
    const inserted = insertNode(state, 'content.blog-card', state.document.rootNodeId);
    state = seedPostsDataSource(inserted.state);
    const node = state.document.nodes[inserted.nodeId]!;
    for (const action of buildContentBindingConnectActions(node, state.bindingDefinitions.dataSources.posts!)) {
      state = designerReducer(state, action);
    }

    const plan = collectDocumentContentPlan(state.document, state.bindingDefinitions);
    expect(plan.contentListFetches).toHaveLength(1);
    expect(plan.contentListFetches[0]?.targetListProp).toBe('data');

    const bindingPlan = collectDocumentBindingPlan(state.document, state.bindingDefinitions);
    expect(bindingPlan.contentPlan.contentListFetches).toHaveLength(1);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('useDataFetch');
    expect(tsx).toMatch(/contentData_/);
    expect(tsx).toContain('JSON.stringify(Array.isArray(contentData_');
  });

  describe.each([...DUAL_MODE_CONTENT_PALETTE_IDS])('%s Dual-Mode', (paletteItemId) => {
    it('static mode: insertable, detectable, export without contentData fetch', () => {
      let state = createInitialDesignerState();
      const inserted = insertNode(state, paletteItemId, state.document.rootNodeId);
      state = inserted.state;
      const node = state.document.nodes[inserted.nodeId]!;
      expect(isDualModeContentNode(node)).toBe(true);
      expect(getContentDataMode(node)).toBe('static');
      expect(isContentDataBoundNode(node)).toBe(false);

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).not.toMatch(/contentData_/);
      expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
    });

    it('bindable mode: collect plan + emit useDataFetch for content data', () => {
      let state = createInitialDesignerState();
      const inserted = insertNode(state, paletteItemId, state.document.rootNodeId);
      state = seedPostsDataSource(inserted.state);
      for (const action of buildContentBindingConnectActions(
        state.document.nodes[inserted.nodeId]!,
        state.bindingDefinitions.dataSources.posts!,
      )) {
        state = designerReducer(state, action);
      }

      const node = state.document.nodes[inserted.nodeId]!;
      expect(node.props[CONTENT_DATA_MODE_PROP]).toBe('bound');
      expect(node.binding[CONTENT_DATA_RESOURCE_BINDING_KEY]?.dataSourceRef).toBe('posts');
      expect(collectDocumentContentPlan(state.document, state.bindingDefinitions).contentListFetches).toHaveLength(1);

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain('useDataFetch');
      expect(tsx).toMatch(/contentData_/);
    });
  });
});

describe('T1-9 content.contact-form-block → Preset', () => {
  it('removes content.contact-form-block from palette / universal catalog ids', () => {
    expect(getPaletteItemById('content.contact-form-block')).toBeUndefined();
    expect(DESIGNER_PALETTE.some((item) => item.id === 'content.contact-form-block')).toBe(false);
    expect((UNIVERSAL_PALETTE_ITEM_IDS as readonly string[]).includes('content.contact-form-block')).toBe(false);
    expect(LEGACY_REMOVED_PALETTE_IDS.has('content.contact-form-block')).toBe(true);
  });

  it('maps contact-form preset to html.form in parity checklist', () => {
    expect(PRESET_WIDGET_PARITY_CHECKLIST.find((entry) => entry.presetId === 'contact-form')).toEqual({
      presetId: 'contact-form',
      widgetId: 'html.form',
    });
  });

  it('contact-form preset inserts a real html.form with labeled fields and submit', () => {
    const seeds = getTemplateForPreset('contact-form');
    expect(seeds.length).toBeGreaterThan(0);
    const root = seeds[0]!;
    expect(root.paletteItemId).toBe('html.form');

    const flatten = (seed: typeof root): string[] => [
      seed.paletteItemId ?? '',
      ...(seed.children ?? []).flatMap((child) => flatten(child as typeof root)),
    ];
    const ids = flatten(root);
    expect(ids).toContain('heroui.input-text');
    expect(ids).toContain('heroui.textarea');
    expect(ids).toContain('heroui.button-solid');
  });

  it('loads a legacy content.contact-form-block node without crashing and warns', () => {
    const state = createInitialDesignerState();
    const rootId = state.document.rootNodeId;
    const legacyId = 'legacy_contact_form';

    state.document.nodes[rootId] = {
      ...state.document.nodes[rootId],
      children: [legacyId],
    };
    state.document.nodes[legacyId] = {
      id: legacyId,
      type: 'container',
      parentId: rootId,
      order: 0,
      props: {
        [DESIGNER_PALETTE_ITEM_ID_PROP]: 'content.contact-form-block',
        title: 'Contact us',
        submitLabel: 'Send',
      },
      layout: {},
      binding: {},
      children: [],
    };

    expect(() => {
      render(<>{renderDesignerDocumentPreview(state.document)}</>);
    }).not.toThrow();

    const diagnostics = validateDesignerDocument(state.document);
    expect(diagnostics.some((issue) =>
      issue.code === 'legacy-palette-item'
      && issue.nodeId === legacyId
      && issue.level === 'warning'
      && /Contact Form/i.test(issue.message),
    )).toBe(true);

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('DesignerUniversalContactFormBlock');
  });
});

describe('T1-9 content.split-media mediaSrc', () => {
  it('exposes mediaSrc on the palette def and in export + preview', () => {
    const item = getPaletteItemById('content.split-media');
    expect(item?.defaultProps).toHaveProperty('mediaSrc');

    let state = createInitialDesignerState();
    const inserted = insertNode(state, 'content.split-media', state.document.rootNodeId);
    state = designerReducer(inserted.state, {
      type: 'set-node-prop',
      nodeId: inserted.nodeId,
      key: 'mediaSrc',
      value: 'https://cdn.example.com/hero.jpg',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('mediaSrc=');
    expect(tsx).toContain('https://cdn.example.com/hero.jpg');

    expect(() => {
      render(<>{renderDesignerDocumentPreview(state.document)}</>);
    }).not.toThrow();
  });
});
