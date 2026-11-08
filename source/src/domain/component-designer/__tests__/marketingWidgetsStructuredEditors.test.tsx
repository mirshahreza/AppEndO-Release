/**
 * @vitest-environment jsdom
 * Bug found (parity audit item P4.21, UX-quality — not a correctness bug): unlike sibling
 * Dual-Mode widgets (content.feature-grid, content.blog-card, content.team-member,
 * content.description-list, content.carousel), marketing.faq-accordion,
 * marketing.testimonial-carousel, and marketing.pricing-table only offered a raw JSON text
 * field to edit their structured data. Replaced with the same content-records structured
 * editor sibling widgets already have.
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { createInitialDesignerState, designerReducer } from '../state';
import { DesignerUniversalPricingTable } from '../DesignerRuntimeUniversalWidgets';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: state.document.rootNodeId });

const lastChildId = (state: DesignerState): string => {
  const parent = state.document.nodes[state.document.rootNodeId];
  return parent.children[parent.children.length - 1] as string;
};

describe('marketing widgets structured editors (P4.21)', () => {
  it('marketing.faq-accordion exposes a content-records editor (question/answer) instead of raw JSON', () => {
    const state = insertItem(createInitialDesignerState(), 'marketing.faq-accordion');
    const dataField = resolveInspectorFieldSections(state.document.nodes[lastChildId(state)])
      .flatMap((s) => s.fields)
      .find((f) => f.key === 'data');
    expect(dataField?.type).toBe('content-records');
    expect(dataField?.recordFields?.map((f) => f.key)).toEqual(['question', 'answer']);
  });

  it('marketing.testimonial-carousel exposes a content-records editor (name/role/quote/avatar) instead of raw JSON', () => {
    const state = insertItem(createInitialDesignerState(), 'marketing.testimonial-carousel');
    const dataField = resolveInspectorFieldSections(state.document.nodes[lastChildId(state)])
      .flatMap((s) => s.fields)
      .find((f) => f.key === 'data');
    expect(dataField?.type).toBe('content-records');
    expect(dataField?.recordFields?.map((f) => f.key)).toEqual(['name', 'role', 'quote', 'avatar']);
  });

  it('marketing.pricing-table exposes a content-records editor with a checkbox control for "featured"', () => {
    const state = insertItem(createInitialDesignerState(), 'marketing.pricing-table');
    const dataField = resolveInspectorFieldSections(state.document.nodes[lastChildId(state)])
      .flatMap((s) => s.fields)
      .find((f) => f.key === 'data');
    expect(dataField?.type).toBe('content-records');
    expect(dataField?.recordFields?.map((f) => f.key)).toEqual(['name', 'price', 'period', 'features', 'cta', 'featured']);
    expect(dataField?.recordFields?.find((f) => f.key === 'featured')?.control).toBe('checkbox');
  });

  it('DesignerUniversalPricingTable renders comma-separated features (the structured editor storage format) as real list items', () => {
    const data = JSON.stringify([
      { id: 't1', name: 'Starter', price: '$19', period: '/mo', features: '5 users, Email support', cta: 'Start', featured: 'false' },
    ]);
    render(<DesignerUniversalPricingTable title="Plans" data={data} />);
    expect(screen.getByText('• 5 users')).toBeTruthy();
    expect(screen.getByText('• Email support')).toBeTruthy();
  });

  it('DesignerUniversalPricingTable still renders a real array/boolean (pre-existing JSON documents) identically', () => {
    const data = JSON.stringify([
      { id: 't1', name: 'Pro', price: '$49', period: '/mo', features: ['25 users', 'Priority support'], cta: 'Choose Pro', featured: true },
    ]);
    const { container } = render(<DesignerUniversalPricingTable title="Plans" data={data} />);
    expect(screen.getByText('• 25 users')).toBeTruthy();
    expect(screen.getByText('• Priority support')).toBeTruthy();
    expect(container.querySelector('.border-primary')).toBeTruthy();
  });

  it('DesignerUniversalPricingTable treats the checkbox-editor string "true" as featured, and "false"/empty as not featured', () => {
    const data = JSON.stringify([
      { id: 't1', name: 'A', features: '', featured: 'true' },
      { id: 't2', name: 'B', features: '', featured: 'false' },
      { id: 't3', name: 'C', features: '', featured: '' },
    ]);
    const { container } = render(<DesignerUniversalPricingTable data={data} />);
    const cards = container.querySelectorAll('.grid > div');
    expect(cards).toHaveLength(3);
    expect(cards[0]?.className).toContain('border-primary');
    expect(cards[1]?.className).not.toContain('border-primary');
    expect(cards[2]?.className).not.toContain('border-primary');
  });
});
