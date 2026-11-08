/**
 * @vitest-environment jsdom
 * Phase T1-30 — Marketing palette audit (Dual-Mode + property interaction).
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
  resolveContentListDataVarName,
} from '../bindingContentEngine';
import { getBindingCapabilityRow } from '../bindingCapabilityMatrix';
import { generateDesignerTsx } from '../codegen';
import { getPaletteItemById } from '../catalog';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';
import {
  MOCK_FAQ_ITEMS_JSON,
  MOCK_PRICING_TIERS_JSON,
  MOCK_TESTIMONIALS_JSON,
} from '../universalMockFixtures';

const MARKETING_ITEM_IDS = [
  'marketing.faq-accordion',
  'marketing.testimonial-carousel',
  'marketing.pricing-table',
  'marketing.hero-cta',
  'marketing.newsletter-signup',
] as const;

type MarketingItemId = (typeof MARKETING_ITEM_IDS)[number];

const EXPORT_COMPONENT_NAMES: Record<MarketingItemId, string> = {
  'marketing.faq-accordion': 'DesignerUniversalFaqAccordion',
  'marketing.testimonial-carousel': 'DesignerUniversalTestimonialCarousel',
  'marketing.pricing-table': 'DesignerUniversalPricingTable',
  'marketing.hero-cta': 'DesignerUniversalHeroCta',
  'marketing.newsletter-signup': 'DesignerUniversalNewsletterSignup',
};

const DEFAULT_TEXT_SNIPPETS: Record<MarketingItemId, string> = {
  'marketing.faq-accordion': 'Frequently asked questions',
  'marketing.testimonial-carousel': 'What customers say',
  'marketing.pricing-table': 'Plans',
  'marketing.hero-cta': 'Build apps visually',
  'marketing.newsletter-signup': 'Stay in the loop',
};

const SCOPED_INSPECTOR_FIELDS: Record<MarketingItemId, string[]> = {
  'marketing.faq-accordion': ['title', 'data'],
  'marketing.testimonial-carousel': ['title', 'data'],
  'marketing.pricing-table': ['title', 'data'],
  'marketing.hero-cta': ['title', 'subtitle', 'primaryCta', 'secondaryCta'],
  'marketing.newsletter-signup': ['title', 'placeholder', 'buttonLabel'],
};

const DEAD_INSPECTOR_FIELDS: Record<MarketingItemId, string[]> = {
  'marketing.faq-accordion': ['slides', 'steps', 'label', 'placeholder'],
  'marketing.testimonial-carousel': ['slides', 'steps', 'label', 'primaryCta'],
  'marketing.pricing-table': ['slides', 'steps', 'subtitle', 'actionLabel'],
  'marketing.hero-cta': ['data', 'slides', 'steps', 'placeholder', 'buttonLabel'],
  'marketing.newsletter-signup': ['data', 'slides', 'steps', 'subtitle', 'primaryCta'],
};

/** Primary static payload prop preserved across Dual-Mode toggles (T1-9 contract). */
const DUAL_MODE_PRESERVE_PROP: Record<MarketingItemId, string> = {
  'marketing.faq-accordion': 'data',
  'marketing.testimonial-carousel': 'data',
  'marketing.pricing-table': 'data',
  'marketing.hero-cta': 'title',
  'marketing.newsletter-signup': 'title',
};

const DUAL_MODE_PRESERVE_VALUE: Record<MarketingItemId, unknown> = {
  'marketing.faq-accordion': MOCK_FAQ_ITEMS_JSON,
  'marketing.testimonial-carousel': MOCK_TESTIMONIALS_JSON,
  'marketing.pricing-table': MOCK_PRICING_TIERS_JSON,
  'marketing.hero-cta': 'Launch your next product',
  'marketing.newsletter-signup': 'Product updates',
};

/** Secondary property changed while bound — must survive mode toggle. */
const DUAL_MODE_SECONDARY_PROP: Record<MarketingItemId, { key: string; value: unknown }> = {
  'marketing.faq-accordion': { key: 'title', value: 'Support center' },
  'marketing.testimonial-carousel': { key: 'title', value: 'Customer stories' },
  'marketing.pricing-table': { key: 'title', value: 'Annual pricing' },
  'marketing.hero-cta': { key: 'subtitle', value: 'Design, preview, and ship from one workspace.' },
  'marketing.newsletter-signup': { key: 'placeholder', value: 'you@startup.io' },
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
      fields: [
        'id',
        'title',
        'subtitle',
        'summary',
        'description',
        'primaryCta',
        'secondaryCta',
        'placeholder',
        'buttonLabel',
        'question',
        'answer',
        'name',
        'quote',
        'price',
        'period',
        'cta',
      ],
      primaryKey: 'id',
      operations: { list: { method: 'GET', endpoint: '/api/posts' } },
    },
  });

describe('T1-30 Marketing palette audit', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(MARKETING_ITEM_IDS)('renders %s in canvas preview without throwing', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
  });

  it.each(MARKETING_ITEM_IDS)(
    'renders %s with edge-case values (empty string / zero items / malformed JSON / very long string) without throwing',
    (itemId) => {
      let state = insertItem(createInitialDesignerState(), itemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);
      const longString = 'X'.repeat(500);

      for (const key of Object.keys(state.document.nodes[nodeId]!.props)) {
        if (key === 'className' || key === '_designerPaletteItemId') {
          continue;
        }
        state = designerReducer(state, { type: 'set-node-prop', nodeId, key, value: '' });
      }
      expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
      cleanup();

      const listProp = SCOPED_INSPECTOR_FIELDS[itemId].find((key) => key === 'data');
      if (listProp) {
        state = designerReducer(state, { type: 'set-node-prop', nodeId, key: listProp, value: '[]' });
        expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
        cleanup();

        state = designerReducer(state, { type: 'set-node-prop', nodeId, key: listProp, value: '{not valid json' });
        expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
        cleanup();
      }

      const textField = SCOPED_INSPECTOR_FIELDS[itemId].find((key) => key !== 'data');
      if (textField) {
        state = designerReducer(state, { type: 'set-node-prop', nodeId, key: textField, value: longString });
        expect(() => render(<>{renderDesignerDocumentPreview(state.document)}</>)).not.toThrow();
      }

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain('export const GeneratedComponent');
    },
  );

  it.each(MARKETING_ITEM_IDS)('exports TSX for %s with the correct universal widget', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('export const GeneratedComponent');
    expect(tsx).toContain(EXPORT_COMPONENT_NAMES[itemId]);
  });

  it.each(MARKETING_ITEM_IDS)('registers %s as Dual-Mode content with Content binding capability', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const nodeId = lastChildId(state, state.document.rootNodeId);
    const node = state.document.nodes[nodeId]!;
    expect(isDualModeContentNode(node)).toBe(true);
    expect(getContentDataMode(node)).toBe('static');

    const row = getBindingCapabilityRow(itemId);
    expect(row?.supportedCapabilities).toContain('Content');
    expect(row?.bindingStatus).toBe('parity-tested');
  });

  it.each(MARKETING_ITEM_IDS)('shows default content for %s in canvas preview', (itemId) => {
    const state = insertItem(createInitialDesignerState(), itemId);
    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain(DEFAULT_TEXT_SNIPPETS[itemId]);
  });

  it.each(MARKETING_ITEM_IDS)(
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

  it('marketing.faq-accordion reflects custom JSON data in static preview and export', () => {
    const customData = JSON.stringify([{ id: 'x1', question: 'Billing cycle?', answer: 'Monthly or annual.' }]);
    let state = insertItem(createInitialDesignerState(), 'marketing.faq-accordion');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'title', value: 'Billing FAQ' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'data', value: customData });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Billing FAQ');
    expect(container.textContent).toContain('Billing cycle?');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('title="Billing FAQ"');
    expect(tsx).toContain('Billing cycle?');
  });

  it('marketing.pricing-table reflects title and tier names in preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'marketing.pricing-table');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'title', value: 'Choose your plan' });
    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'data',
      value: JSON.stringify([{ id: 'solo', name: 'Solo', price: '$9', period: '/mo', features: ['1 seat'], cta: 'Start' }]),
    });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Choose your plan');
    expect(container.textContent).toContain('Solo');
    expect(container.textContent).toContain('$9');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('title="Choose your plan"');
    expect(tsx).toContain('Solo');
  });

  it('marketing.hero-cta reflects title, subtitle, and CTA labels in preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'marketing.hero-cta');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'title', value: 'Ship faster' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'subtitle', value: 'From idea to production in days.' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'primaryCta', value: 'Start free' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'secondaryCta', value: 'Book demo' });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Ship faster');
    expect(container.textContent).toContain('From idea to production in days.');
    expect(container.textContent).toContain('Start free');
    expect(container.textContent).toContain('Book demo');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('title="Ship faster"');
    expect(tsx).toContain('subtitle="From idea to production in days."');
    expect(tsx).toContain('primaryCta="Start free"');
    expect(tsx).toContain('secondaryCta="Book demo"');
  });

  it('marketing.newsletter-signup reflects title, placeholder, and button label in preview and export', () => {
    let state = insertItem(createInitialDesignerState(), 'marketing.newsletter-signup');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'title', value: 'Weekly digest' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'placeholder', value: 'work@company.com' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'buttonLabel', value: 'Join list' });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Weekly digest');
    expect(container.textContent).toContain('Join list');
    expect(container.querySelector('input')?.getAttribute('placeholder')).toBe('work@company.com');

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('title="Weekly digest"');
    expect(tsx).toContain('placeholder="work@company.com"');
    expect(tsx).toContain('buttonLabel="Join list"');
  });

  it('marketing.testimonial-carousel reflects custom testimonial data in static preview', () => {
    const customData = JSON.stringify([{ id: 't9', name: 'Riley Park', role: 'Founder', quote: 'Best builder we tried.', avatar: '' }]);
    let state = insertItem(createInitialDesignerState(), 'marketing.testimonial-carousel');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'title', value: 'Loved by teams' });
    state = designerReducer(state, { type: 'set-node-prop', nodeId, key: 'data', value: customData });

    const { container } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Loved by teams');
    expect(container.textContent).toContain('Riley Park');
    expect(container.textContent).toContain('Best builder we tried.');
  });

  describe.each(MARKETING_ITEM_IDS)('%s Dual-Mode + property interaction', (itemId) => {
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
        value: 'rounded-xl border border-slate-200',
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
      expect(state.document.nodes[nodeId]!.props.className).toBe('rounded-xl border border-slate-200');

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
      expect(node.props.className).toBe('rounded-xl border border-slate-200');

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

  it('bound marketing.faq-accordion preview uses hydrated API rows for FAQ JSON', () => {
    let state = insertItem(createInitialDesignerState(), 'marketing.faq-accordion');
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
        { id: 'api-q1', question: 'API question one?', answer: 'API answer one.' },
        { id: 'api-q2', question: 'API question two?', answer: 'API answer two.' },
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
    expect(container.textContent).toContain('API question one?');
    expect(container.textContent).toContain('API answer one.');
    expect(container.textContent).not.toContain('How do I get started?');
  });

  it('bound marketing.hero-cta preview maps first API row onto scalar props', () => {
    let state = insertItem(createInitialDesignerState(), 'marketing.hero-cta');
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
        subtitle: 'API subheadline',
        primaryCta: 'API primary',
        secondaryCta: 'API secondary',
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
    expect(container.textContent).toContain('API subheadline');
    expect(container.textContent).toContain('API primary');
    expect(container.textContent).toContain('API secondary');
    expect(container.textContent).not.toContain('Build apps visually');
  });

  it('bound marketing.newsletter-signup preview maps first API row onto scalar props', () => {
    let state = insertItem(createInitialDesignerState(), 'marketing.newsletter-signup');
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
        title: 'API digest',
        placeholder: 'api@example.com',
        buttonLabel: 'API subscribe',
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
    expect(container.textContent).toContain('API digest');
    expect(container.textContent).toContain('API subscribe');
    expect(container.querySelector('input')?.getAttribute('placeholder')).toBe('api@example.com');
    expect(container.textContent).not.toContain('Stay in the loop');
  });

  it('bound marketing.pricing-table preview uses hydrated API tier rows', () => {
    let state = insertItem(createInitialDesignerState(), 'marketing.pricing-table');
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
        { id: 'api-tier', name: 'API Plan', price: '$99', period: '/yr', features: ['Unlimited'], cta: 'Buy now', featured: true },
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
    expect(container.textContent).toContain('API Plan');
    expect(container.textContent).toContain('$99');
    expect(container.textContent).toContain('Buy now');
    expect(container.textContent).not.toContain('Starter');
  });

  it('bound marketing.testimonial-carousel preview uses hydrated API testimonial rows', () => {
    let state = insertItem(createInitialDesignerState(), 'marketing.testimonial-carousel');
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
        { id: 'api-t1', name: 'API Pat', role: 'VP Sales', quote: 'API quote text.', avatar: '' },
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
    expect(container.textContent).toContain('API Pat');
    expect(container.textContent).toContain('API quote text.');
    expect(container.textContent).not.toContain('Alex Chen');
  });

  // Known bug class from prior audit rounds: internal navigation/step state silently
  // resetting (or the widget remounting) when an unrelated Style-panel edit dispatches
  // through designerReducer. testimonial-carousel wraps DesignerUniversalCarousel's slide
  // index state; faq-accordion has its own openId state. Prove both survive re-render
  // with a style-only prop change.
  it('marketing.testimonial-carousel slide index survives an unrelated Style-panel prop edit', () => {
    let state = insertItem(createInitialDesignerState(), 'marketing.testimonial-carousel');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    const { container, rerender } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Alex Chen');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(container.textContent).toContain('Sam Rivera');
    expect(container.textContent).not.toContain('Alex Chen');

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

  it('marketing.faq-accordion open question survives an unrelated Style-panel prop edit', () => {
    let state = insertItem(createInitialDesignerState(), 'marketing.faq-accordion');
    const nodeId = lastChildId(state, state.document.rootNodeId);

    const { container, rerender } = render(<>{renderDesignerDocumentPreview(state.document)}</>);
    // Default open item is the first FAQ row (q1) — its answer is visible by default.
    expect(container.textContent).toContain('Create a component and drag widgets from the palette.');

    fireEvent.click(screen.getByRole('button', { name: /Can I bind data from an API\?/ }));
    expect(container.textContent).toContain('Yes — use binding definitions on supported widgets.');
    expect(container.textContent).not.toContain('Create a component and drag widgets from the palette.');

    state = designerReducer(state, {
      type: 'set-node-prop',
      nodeId,
      key: 'className',
      value: 'space-y-2 rounded-2xl border-2 border-primary p-2',
    });

    rerender(<>{renderDesignerDocumentPreview(state.document)}</>);
    expect(container.textContent).toContain('Yes — use binding definitions on supported widgets.');
    expect(container.textContent).not.toContain('Create a component and drag widgets from the palette.');
    expect(container.querySelector('.border-primary')).toBeTruthy();
  });

  it('every marketing item has a catalog definition with defaultProps', () => {
    for (const itemId of MARKETING_ITEM_IDS) {
      const item = getPaletteItemById(itemId);
      expect(item, itemId).toBeDefined();
      expect(item?.defaultProps).toBeDefined();
      expect(Object.keys(item?.defaultProps ?? {}).length).toBeGreaterThan(0);
    }
  });
});
