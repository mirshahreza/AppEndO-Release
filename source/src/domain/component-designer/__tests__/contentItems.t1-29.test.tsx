/**
 * @vitest-environment jsdom
 * Phase T1-29 — Content palette audit (Dual-Mode + property interaction).
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  buildContentBindingConnectActions,
  buildContentDualModeDisableActions,
  buildContentDualModeEnableActions,
  collectDocumentContentPlan,
  getContentDataMode,
  getNodeContentDataResourceRef,
  isContentDataBoundNode,
  isDualModeContentNode,
  resolveContentCsvFromRows,
  resolveContentListDataVarName,
} from '../bindingContentEngine';
import { getBindingCapabilityRow } from '../bindingCapabilityMatrix';
import { generateDesignerTsx } from '../codegen';
import { getPaletteItemById } from '../catalog';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../propRegistry';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';
import {
  MOCK_BLOG_POSTS_JSON,
  MOCK_DESCRIPTION_LIST_JSON,
  MOCK_FEATURE_GRID_JSON,
  MOCK_TEAM_MEMBERS_JSON,
  MOCK_TESTIMONIALS_JSON,
} from '../universalMockFixtures';

const CONTENT_ITEM_IDS = [
  'content.stepper',
  'content.carousel',
  'content.icon',
  'content.description-list',
  'content.stat-trend',
  'content.segmented-control',
  'content.feature-grid',
  'content.blog-card',
  'content.team-member',
  'content.split-media',
  'content.cta-banner',
] as const;

type ContentItemId = (typeof CONTENT_ITEM_IDS)[number];

const EXPORT_COMPONENT_NAMES: Record<ContentItemId, string> = {
  'content.stepper': 'DesignerUniversalStepper',
  'content.carousel': 'DesignerUniversalCarousel',
  'content.icon': 'DesignerUniversalIcon',
  'content.description-list': 'DesignerUniversalDescriptionList',
  'content.stat-trend': 'DesignerUniversalStatTrend',
  'content.segmented-control': 'DesignerUniversalSegmentedControl',
  'content.feature-grid': 'DesignerUniversalFeatureGrid',
  'content.blog-card': 'DesignerUniversalBlogCardList',
  'content.team-member': 'DesignerUniversalTeamGrid',
  'content.split-media': 'DesignerUniversalSplitMedia',
  'content.cta-banner': 'DesignerUniversalCtaBanner',
};

const DEFAULT_TEXT_SNIPPETS: Record<ContentItemId, string> = {
  'content.stepper': 'Account',
  'content.carousel': 'Gallery',
  'content.icon': '',
  'content.description-list': 'Details',
  'content.stat-trend': 'Revenue',
  'content.segmented-control': 'Week',
  'content.feature-grid': 'Features',
  'content.blog-card': 'Latest posts',
  'content.team-member': 'Our team',
  'content.split-media': 'Split section',
  'content.cta-banner': 'Ready to launch?',
};

const SCOPED_INSPECTOR_FIELDS: Record<ContentItemId, string[]> = {
  'content.stepper': ['steps', 'activeStep'],
  'content.carousel': ['title', 'slides'],
  'content.icon': ['iconName', 'size'],
  'content.description-list': ['title', 'data'],
  'content.stat-trend': ['label', 'value', 'trend', 'trendDirection'],
  'content.segmented-control': ['items', 'options', 'selected'],
  'content.feature-grid': ['title', 'data'],
  'content.blog-card': ['title', 'data'],
  'content.team-member': ['title', 'data'],
  'content.split-media': ['title', 'mediaSide', 'mediaType', 'mediaSrc'],
  'content.cta-banner': ['title', 'description', 'actionLabel'],
};

const DEAD_INSPECTOR_FIELDS: Record<ContentItemId, string[]> = {
  'content.stepper': ['data', 'slides'],
  'content.carousel': ['steps', 'data', 'label'],
  'content.icon': ['data', 'steps'],
  'content.description-list': ['slides', 'steps', 'label'],
  'content.stat-trend': ['data', 'slides'],
  'content.segmented-control': ['data', 'slides'],
  'content.feature-grid': ['slides', 'steps', 'label'],
  'content.blog-card': ['slides', 'steps', 'label'],
  'content.team-member': ['slides', 'steps', 'label'],
  'content.split-media': ['data', 'slides', 'steps'],
  'content.cta-banner': ['data', 'slides', 'steps'],
};

/** Primary static payload prop preserved across Dual-Mode toggles (T1-9 contract). */
const DUAL_MODE_PRESERVE_PROP: Record<ContentItemId, string> = {
  'content.stepper': 'steps',
  'content.carousel': 'slides',
  'content.icon': 'iconName',
  'content.description-list': 'data',
  'content.stat-trend': 'label',
  'content.segmented-control': 'options',
  'content.feature-grid': 'data',
  'content.blog-card': 'data',
  'content.team-member': 'data',
  'content.split-media': 'mediaSrc',
  'content.cta-banner': 'title',
};

const DUAL_MODE_PRESERVE_VALUE: Record<ContentItemId, unknown> = {
  'content.stepper': 'Alpha,Beta,Gamma',
  'content.carousel': MOCK_TESTIMONIALS_JSON,
  'content.icon': 'Star',
  'content.description-list': MOCK_DESCRIPTION_LIST_JSON,
  'content.stat-trend': 'MRR',
  'content.segmented-control': 'Q1,Q2,Q3',
  'content.feature-grid': MOCK_FEATURE_GRID_JSON,
  'content.blog-card': MOCK_BLOG_POSTS_JSON,
  'content.team-member': MOCK_TEAM_MEMBERS_JSON,
  'content.split-media': 'https://cdn.example.com/hero.jpg',
  'content.cta-banner': 'Start your trial',
};

/** Secondary property changed while bound — must survive mode toggle. */
const DUAL_MODE_SECONDARY_PROP: Record<ContentItemId, { key: string; value: unknown }> = {
  'content.stepper': { key: 'activeStep', value: 2 },
  'content.carousel': { key: 'title', value: 'Product shots' },
  'content.icon': { key: 'size', value: 32 },
  'content.description-list': { key: 'title', value: 'Shipment details' },
  'content.stat-trend': { key: 'value', value: '$99k' },
  'content.segmented-control': { key: 'selected', value: 'Q2' },
  'content.feature-grid': { key: 'title', value: 'Platform capabilities' },
  'content.blog-card': { key: 'title', value: 'Engineering blog' },
  'content.team-member': { key: 'title', value: 'Leadership' },
  'content.split-media': { key: 'mediaSide', value: 'left' },
  'content.cta-banner': { key: 'description', value: 'No credit card required.' },
};

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: parentId ?? state.document.rootNodeId,
  });

const lastChildId = (state: DesignerState, parentId: string): string => {
  const parent = state.document.nodes[parentId];
  return parent.children[parent.children.length - 1] as string;
};

const collectInspectorFieldKeys = (state: DesignerState, nodeId: string): string[] => {
  const node = state.document.nodes[nodeId];
  return resolveInspectorFieldSections(node).flatMap((section) => section.fields.map((field) => field.key));
};

const seedPostsDataSource = (state: DesignerState): DesignerState =>
  designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: 'posts',
    dataSource: {
      id: 'posts',
      name: 'Posts',
      endpoint: '/api/posts',
      fields: ['id', 'title', 'summary', 'date', 'label', 'value', 'iconName', 'mediaSrc', 'name'],
      primaryKey: 'id',
      operations: { list: { method: 'GET', endpoint: '/api/posts' } },
    },
  });

describe('T1-29 Content palette audit', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(CONTENT_ITEM_IDS)('renders %s in canvas preview without throwing', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
  });

  it.each(CONTENT_ITEM_IDS)(
    'renders %s with edge-case values (empty string / zero items / malformed JSON / very long string) without throwing',
    (itemId) => {
      let state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      const longString = 'X'.repeat(500);

      for (const key of Object.keys(state.document.nodes[nodeId]!.props)) {
        if (key === 'className' || key === DESIGNER_PALETTE_ITEM_ID_PROP) {
          continue;
        }
        state = designerReducer(state, { type: 'set-node-prop', nodeId, key, value: '' });
      }
      expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
      cleanup();

      // Zero-items / empty-array JSON payload for list-backed widgets.
      const listProp = SCOPED_INSPECTOR_FIELDS[itemId].find((key) => key === 'data' || key === 'slides');
      if (listProp) {
        state = designerReducer(state, { type: 'set-node-prop', nodeId, key: listProp, value: '[]' });
        expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
        cleanup();

        // Malformed JSON must fall back gracefully, not crash the render tree.
        state = designerReducer(state, { type: 'set-node-prop', nodeId, key: listProp, value: '{not valid json' });
        expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
        cleanup();
      }

      // Very long string values (title-like field) should not throw or infinite-loop.
      const textField = SCOPED_INSPECTOR_FIELDS[itemId].find((key) => key !== 'data' && key !== 'slides');
      if (textField) {
        state = designerReducer(state, { type: 'set-node-prop', nodeId, key: textField, value: longString });
        expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
      }

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain('export const GeneratedComponent');
    },
  );

  it.each(CONTENT_ITEM_IDS)('exports TSX for %s with the correct universal widget', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('export const GeneratedComponent');
    expect(tsx).toContain(EXPORT_COMPONENT_NAMES[itemId]);
  });

  it.each(CONTENT_ITEM_IDS)('registers %s as Dual-Mode content with Content binding capability', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const node = state.document.nodes[nodeId]!;
    expect(isDualModeContentNode(node)).toBe(true);
    expect(getContentDataMode(node)).toBe('static');

    const row = getBindingCapabilityRow(itemId);
    expect(row?.supportedCapabilities).toContain('Content');
    expect(row?.bindingStatus).toBe('parity-tested');
    if (itemId === 'content.segmented-control') {
      // Also on LOV registry — verified end-to-end via bindingGaps.prod-6.test.tsx.
      expect(row?.supportedCapabilities).toContain('LOV');
    }
  });

  it.each(CONTENT_ITEM_IDS.filter((id) => DEFAULT_TEXT_SNIPPETS[id].length > 0))(
    'shows default content for %s in canvas preview',
    (itemId) => {
      const state = insertItem(createInitialDesignerState(), itemId);
      const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
      expect(container.textContent).toContain(DEFAULT_TEXT_SNIPPETS[itemId]);
    },
  );

  it.each(CONTENT_ITEM_IDS)(
    'exposes only scoped inspector fields for %s (no dead fields)',
    (itemId) => {
      const state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      const keys = collectInspectorFieldKeys(state, nodeId);

      for (const key of SCOPED_INSPECTOR_FIELDS[itemId]) {
        expect(keys, `${itemId} should expose ${key}`).toContain(key);
      }
      for (const deadKey of DEAD_INSPECTOR_FIELDS[itemId]) {
        expect(keys, `${itemId} should not expose dead field ${deadKey}`).not.toContain(deadKey);
      }
    },
  );

  it('content.icon renders lucide svg in preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'content.icon');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'iconName',
      value: 'Heart',
    });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'size',
      value: 40,
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.querySelector('svg')).toBeTruthy();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('iconName="Heart"');
    expect(tsx).toContain('size={40}');
  });

  it('content.stat-trend reflects label, value, trend, and direction in preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'content.stat-trend');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'label', value: 'Churn' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'value', value: '2.1%' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'trend', value: '-0.4%' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'trendDirection', value: 'down' });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Churn');
    expect(container.textContent).toContain('2.1%');
    expect(container.textContent).toContain('-0.4%');
    expect(container.querySelector('.text-rose-600')).toBeTruthy();

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('label="Churn"');
    expect(tsx).toContain('value="2.1%"');
    expect(tsx).toContain('trend="-0.4%"');
    expect(tsx).toContain('trendDirection="down"');
  });

  it('content.cta-banner reflects title, description, and action label in preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'content.cta-banner');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'title', value: 'Ship faster' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'description', value: 'Design, preview, and publish in one place.' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'actionLabel', value: 'Get started' });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Ship faster');
    expect(container.textContent).toContain('Design, preview, and publish in one place.');
    expect(container.textContent).toContain('Get started');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('title="Ship faster"');
    expect(tsx).toContain('description="Design, preview, and publish in one place."');
    expect(tsx).toContain('actionLabel="Get started"');
  });

  it('content.split-media reflects title, media side, and media URL in export', () => {
    let state = insertItem(createInitialDesignerState(), 'content.split-media');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'title', value: 'Why us' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'mediaSide', value: 'left' });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'mediaSrc',
      value: 'https://cdn.example.com/split.jpg',
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('title="Why us"');
    expect(tsx).toContain('mediaSide="left"');
    expect(tsx).toContain('https://cdn.example.com/split.jpg');
    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
  });

  it('content.blog-card reflects custom JSON data in static preview and export', () => {
    const customData = JSON.stringify([{ id: 'x1', title: 'Audit complete', summary: 'All green.' }]);
    let state = insertItem(createInitialDesignerState(), 'content.blog-card');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'title', value: 'Release notes' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'data', value: customData });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Release notes');
    expect(container.textContent).toContain('Audit complete');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('title="Release notes"');
    expect(tsx).toContain('Audit complete');
  });

  it('resolveContentCsvFromRows matches codegen for numeric id rows without label/title', () => {
    const rows = [{ id: 10 }, { id: 20, name: 'Named' }];
    expect(resolveContentCsvFromRows(rows)).toBe('10,Named');
  });

  describe.each(CONTENT_ITEM_IDS)('%s Dual-Mode + property interaction', (itemId) => {
    it('preserves static payload and secondary props across bind/unbind cycle', () => {
      let state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      const preserveKey = DUAL_MODE_PRESERVE_PROP[itemId];
      const preserveValue = DUAL_MODE_PRESERVE_VALUE[itemId];
      const secondary = DUAL_MODE_SECONDARY_PROP[itemId];

      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: preserveKey,
        value: preserveValue,
      });
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: secondary.key,
        value: secondary.value,
      });
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: 'className',
        value: 'rounded-lg border border-slate-200',
      });

      state = seedPostsDataSource(state);
      for (const action of buildContentDualModeEnableActions(nodeId)) {
        state = designerReducer(state, action);
      }
      for (const action of buildContentBindingConnectActions(
        state.document.nodes[nodeId]!,
        state.bindingDefinitions.dataSources.posts!,
      )) {
        state = designerReducer(state, action);
      }

      expect(isContentDataBoundNode(state.document.nodes[nodeId]!)).toBe(true);
      expect(state.document.nodes[nodeId]!.props[preserveKey]).toBe(preserveValue);
      expect(state.document.nodes[nodeId]!.props[secondary.key]).toBe(secondary.value);
      expect(state.document.nodes[nodeId]!.props.className).toBe('rounded-lg border border-slate-200');

      const boundTsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(boundTsx).toContain('useDataFetch');
      expect(boundTsx).toMatch(/contentData_/);

      for (const action of buildContentDualModeDisableActions(nodeId)) {
        state = designerReducer(state, action);
      }

      const node = state.document.nodes[nodeId]!;
      expect(getContentDataMode(node)).toBe('static');
      expect(getNodeContentDataResourceRef(node)).toBeUndefined();
      expect(node.props[preserveKey]).toBe(preserveValue);
      expect(node.props[secondary.key]).toBe(secondary.value);
      expect(node.props.className).toBe('rounded-lg border border-slate-200');

      const staticTsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(staticTsx).not.toMatch(/contentData_/);
      expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
    });

    it('includes bound node in content plan when connected', () => {
      let state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      state = seedPostsDataSource(state);
      for (const action of buildContentBindingConnectActions(
        state.document.nodes[nodeId]!,
        state.bindingDefinitions.dataSources.posts!,
      )) {
        state = designerReducer(state, action);
      }

      const plan = collectDocumentContentPlan(state.document, state.bindingDefinitions);
      expect(plan.contentListFetches.some((fetch) => fetch.nodeId === nodeId)).toBe(true);
    });
  });

  it('bound content.stepper preview uses hydrated API rows for steps CSV', () => {
    let state = insertItem(createInitialDesignerState(), 'content.stepper');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = seedPostsDataSource(state);
    for (const action of buildContentBindingConnectActions(
      state.document.nodes[nodeId]!,
      state.bindingDefinitions.dataSources.posts!,
    )) {
      state = designerReducer(state, action);
    }

    const hydrationData = {
      [resolveContentListDataVarName(nodeId)]: [
        { id: 1, title: 'Draft' },
        { id: 2, title: 'Review' },
        { id: 3, title: 'Publish' },
      ],
    };

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          hydrationData,
        })}
      </>,
    );
    expect(container.textContent).toContain('Draft');
    expect(container.textContent).toContain('Review');
    expect(container.textContent).toContain('Publish');
    expect(container.textContent).not.toContain('Account');
  });

  it('bound content.cta-banner preview maps first API row onto scalar props', () => {
    let state = insertItem(createInitialDesignerState(), 'content.cta-banner');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = seedPostsDataSource(state);
    for (const action of buildContentBindingConnectActions(
      state.document.nodes[nodeId]!,
      state.bindingDefinitions.dataSources.posts!,
    )) {
      state = designerReducer(state, action);
    }

    const hydrationData = {
      [resolveContentListDataVarName(nodeId)]: [{
        title: 'API headline',
        description: 'API body copy',
        actionLabel: 'API action',
      }],
    };

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          hydrationData,
        })}
      </>,
    );
    expect(container.textContent).toContain('API headline');
    expect(container.textContent).toContain('API body copy');
    expect(container.textContent).toContain('API action');
    expect(container.textContent).not.toContain('Ready to launch?');
  });

  it('every content item has a catalog definition with defaultProps', () => {
    for (const itemId of CONTENT_ITEM_IDS) {
      const item = getPaletteItemById(itemId);
      expect(item, itemId).toBeDefined();
      expect(item?.defaultProps).toBeDefined();
      expect(Object.keys(item?.defaultProps ?? {}).length).toBeGreaterThan(0);
    }
  });

  // T1-29 cluster-E follow-up: these items previously only had bind/unbind *state*
  // coverage (props on the node) plus a static-JSON preview check — never a DOM assertion
  // that a live API-hydrated data source actually renders differently than the default
  // static payload. Closing that gap here (matches the pattern already proven for
  // content.stepper / content.cta-banner above).
  it('bound content.icon preview swaps the rendered lucide icon from the API row', () => {
    let state = insertItem(createInitialDesignerState(), 'content.icon');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = seedPostsDataSource(state);
    for (const action of buildContentBindingConnectActions(
      state.document.nodes[nodeId]!,
      state.bindingDefinitions.dataSources.posts!,
    )) {
      state = designerReducer(state, action);
    }

    const hydrationData = {
      [resolveContentListDataVarName(nodeId)]: [{ iconName: 'Heart' }],
    };

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          hydrationData,
        })}
      </>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('class')).toContain('heart');
    expect(svg?.getAttribute('class')).not.toContain('sparkles');
  });

  it('bound content.description-list preview uses hydrated API rows for term/detail pairs', () => {
    let state = insertItem(createInitialDesignerState(), 'content.description-list');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = seedPostsDataSource(state);
    for (const action of buildContentBindingConnectActions(
      state.document.nodes[nodeId]!,
      state.bindingDefinitions.dataSources.posts!,
    )) {
      state = designerReducer(state, action);
    }

    const hydrationData = {
      [resolveContentListDataVarName(nodeId)]: [
        { term: 'API term', detail: 'API detail value' },
      ],
    };

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          hydrationData,
        })}
      </>,
    );
    expect(container.textContent).toContain('API term');
    expect(container.textContent).toContain('API detail value');
    expect(container.textContent).not.toContain('Status');
  });

  it('bound content.stat-trend preview maps first API row onto scalar props', () => {
    let state = insertItem(createInitialDesignerState(), 'content.stat-trend');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = seedPostsDataSource(state);
    for (const action of buildContentBindingConnectActions(
      state.document.nodes[nodeId]!,
      state.bindingDefinitions.dataSources.posts!,
    )) {
      state = designerReducer(state, action);
    }

    const hydrationData = {
      [resolveContentListDataVarName(nodeId)]: [{
        label: 'API metric',
        value: '77%',
        trend: '+3%',
        trendDirection: 'down',
      }],
    };

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          hydrationData,
        })}
      </>,
    );
    expect(container.textContent).toContain('API metric');
    expect(container.textContent).toContain('77%');
    expect(container.textContent).toContain('+3%');
    expect(container.querySelector('.text-rose-600')).toBeTruthy();
    expect(container.textContent).not.toContain('Revenue');
  });

  // NOTE: `title` is a separate static/editable heading prop for these list-type widgets —
  // Content binding only replaces the list payload (`data`), never the title (verified by
  // reading tsxUniversalPalette.ts's contentBoundOrLiteral calls + designerUniversalRuntime.tsx's
  // resolveBoundUniversalOverrides: only `data` is overridden for JSON_DATA_PROP_IDS widgets).
  // So the correct "static default is gone" assertion is against a default *list item*
  // (e.g. a mock post/feature/member), not the title.
  it.each([
    ['content.feature-grid', 'Fresh feature', 'Feature description from API', 'Fast setup'],
    ['content.blog-card', 'Fresh post', 'Post summary from API', 'Introducing App Builder'],
    ['content.team-member', 'Fresh teammate', undefined, 'Jordan Lee'],
  ] as const)('bound %s preview uses hydrated API list rows, not the static default', (itemId, primaryText, _secondary, defaultListItemText) => {
    let state = insertItem(createInitialDesignerState(), itemId);
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = seedPostsDataSource(state);
    for (const action of buildContentBindingConnectActions(
      state.document.nodes[nodeId]!,
      state.bindingDefinitions.dataSources.posts!,
    )) {
      state = designerReducer(state, action);
    }

    const row = itemId === 'content.team-member'
      ? { id: 'api-1', name: primaryText, role: 'API role', bio: 'API bio' }
      : { id: 'api-1', title: primaryText, description: 'Feature description from API', summary: 'Post summary from API' };

    const hydrationData = {
      [resolveContentListDataVarName(nodeId)]: [row],
    };

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          hydrationData,
        })}
      </>,
    );
    expect(container.textContent).toContain(primaryText);
    expect(container.textContent).not.toContain(defaultListItemText);
    // Title stays static/literal by design — not part of the Content list binding.
    expect(container.textContent).toContain(DEFAULT_TEXT_SNIPPETS[itemId]);
  });

  it('bound content.split-media preview maps first API row onto title/mediaSide/mediaSrc', () => {
    let state = insertItem(createInitialDesignerState(), 'content.split-media');
    const nodeId = lastChildId(state, state.document.rootNodeId);
    state = seedPostsDataSource(state);
    for (const action of buildContentBindingConnectActions(
      state.document.nodes[nodeId]!,
      state.bindingDefinitions.dataSources.posts!,
    )) {
      state = designerReducer(state, action);
    }

    const hydrationData = {
      [resolveContentListDataVarName(nodeId)]: [{
        title: 'API split title',
        mediaSide: 'left',
        mediaSrc: 'https://cdn.example.com/api-hydrated.jpg',
      }],
    };

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          bindingDefinitions: state.bindingDefinitions,
          hydrationData,
        })}
      </>,
    );
    expect(container.textContent).toContain('API split title');
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/api-hydrated.jpg');
  });

  // Known bug class from prior audit rounds: internal navigation/step state (carousel
  // slide index) silently resetting — or the whole widget remounting — when an unrelated
  // Style-panel edit (e.g. className) dispatches through designerReducer. Proves the fix
  // holds by actually clicking "Next" then re-rendering with a style-only prop change.
  it('content.carousel slide index survives an unrelated Style-panel prop edit', () => {
    let state = insertItem(createInitialDesignerState(), 'content.carousel');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    const { container, rerender } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Alex Chen');

    const nextButton = screen.getByRole('button', { name: 'Next' });
    fireEvent.click(nextButton);
    expect(container.textContent).toContain('Sam Rivera');
    expect(container.textContent).not.toContain('Alex Chen');

    // Style-panel edit: change className only, unrelated to carousel content/state.
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'className',
      value: 'w-full rounded-2xl border-2 border-primary',
    });

    rerender(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Sam Rivera');
    expect(container.textContent).not.toContain('Alex Chen');
    expect(container.querySelector('.border-primary')).toBeTruthy();
  });
});
