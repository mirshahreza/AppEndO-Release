/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { getBaseComponentOptions } from '../../catalog/baseComponentCatalog';
import type { SectionId } from '../../types';
import { BaseComponentsPageHeaderProvider } from '../../components/BaseComponentsPageHeaderContext';
import { BaseComponentsPropertiesDockProvider } from '../../components/BaseComponentsPropertiesDockContext';
import { layoutHostClass } from '../PrimitiveLivingPreview';
import {
  groupPrimitiveConfigSections,
  PrimitiveBaseComponentsWorkspace,
} from '../PrimitiveBaseComponentsWorkspace';

const DATA_DISPLAY_PRIMITIVE_IDS = [
  'plain-text',
  'heading',
  'html-image',
  'html-iframe',
  'typography-lead',
  'tree-view',
  'timeline',
  'gantt',
  'carousel',
  'description-list',
  'stat-trend',
  'split-media',
] as const;

const renderWorkspace = (sectionId: SectionId) =>
  render(
    <BaseComponentsPropertiesDockProvider>
      <BaseComponentsPageHeaderProvider>
        <PrimitiveBaseComponentsWorkspace sectionId={sectionId} />
      </BaseComponentsPageHeaderProvider>
    </BaseComponentsPropertiesDockProvider>,
  );

describe('groupPrimitiveConfigSections', () => {
  it('uses the section label when every production option shares one axis', () => {
    const groups = groupPrimitiveConfigSections(getBaseComponentOptions('plain-text'), 'Text');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBe('Text');
    expect(groups[0]?.options.map((option) => option.id)).toEqual(['plainText.text']);
  });

  it('splits split-media into Content and Layout accordion sections', () => {
    const groups = groupPrimitiveConfigSections(getBaseComponentOptions('split-media'), 'Split media');
    expect(groups.map((group) => group.title)).toEqual(['Content', 'Layout']);
    expect(groups[0]?.options.map((option) => option.id)).toEqual([
      'splitMedia.title',
      'splitMedia.mediaType',
      'splitMedia.mediaSrc',
    ]);
    expect(groups[1]?.options.map((option) => option.id)).toEqual(['splitMedia.side']);
  });
});

describe('PrimitiveBaseComponentsWorkspace right accordion', () => {
  afterEach(cleanup);

  it.each(DATA_DISPLAY_PRIMITIVE_IDS)('%s docks the standard properties accordion on the right', (sectionId) => {
    renderWorkspace(sectionId);
    expect(screen.getByRole('textbox', { name: 'Search properties' })).toBeVisible();
    expect(document.querySelector('[data-bc-config-mode="docked"]')).toBeTruthy();
    expect(document.querySelector('[data-bc-preview-root]')).toHaveAttribute('data-bc-preview-root', sectionId);
    expect(screen.getAllByRole('button').some((button) => button.getAttribute('aria-expanded') === 'true')).toBe(true);
  });

  it('plain-text accordion edits the living sample', () => {
    renderWorkspace('plain-text');
    expect(screen.getByRole('button', { name: /text/i })).toHaveAttribute('aria-expanded', 'true');
    const field = screen.getByLabelText('Text');
    fireEvent.change(field, { target: { value: 'Hello catalog' } });
    expect(screen.getByText('Hello catalog')).toBeVisible();
  });

  it('split-media exposes content and layout fields in the accordion', () => {
    renderWorkspace('split-media');
    expect(screen.getByRole('button', { name: /content/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Title')).toBeVisible();
    expect(screen.getByLabelText('Media Type')).toBeVisible();
    expect(screen.getByLabelText('Media Src')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /layout/i }));
    expect(screen.getByLabelText('Side')).toBeVisible();
  });

  it('carousel edits the slide collection and shows the inherited widget', () => {
    renderWorkspace('carousel');
    expect(screen.getByText('Gallery')).toBeVisible();
    expect(screen.getByText('We shipped our admin portal in days, not months.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /data/i }));
    expect(screen.getByRole('button', { name: /add slide/i })).toBeVisible();
    expect(screen.getAllByLabelText('Name').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('button', { name: /add slide/i }));
    expect(screen.getAllByLabelText('Name')).toHaveLength(3);
  });

  it('heading exposes text and level against the real heading preview', () => {
    renderWorkspace('heading');
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Catalog heading' } });
    expect(screen.getByRole('heading', { name: 'Catalog heading' })).toBeVisible();
    expect(screen.getByLabelText('Level')).toBeVisible();
  });

  it('applies height h-full on a flex row living sample', () => {
    renderWorkspace('flex-row');
    fireEvent.change(screen.getByLabelText('Height'), { target: { value: 'h-full' } });
    const host = document.querySelector('[data-bc-preview-root="flex-row"] .gap-3');
    expect(host?.className).toContain('h-full');
    expect(host?.className).toContain('flex-1');
  });
});

describe('layoutHostClass', () => {
  it('applies h-full as a real fill utility and ignores raw pixel height strings', () => {
    expect(layoutHostClass({ width: 'w-full', height: 'h-full' }, 'flex gap-3')).toContain('h-full');
    expect(layoutHostClass({ width: 'w-full', height: 'h-full' }, 'flex gap-3')).toContain('flex-1');
    expect(layoutHostClass({ width: '100%', height: '360' }, 'iframe')).toBe('iframe');
    expect(layoutHostClass({ height: 'auto' }, 'flex')).toBe('flex');
  });
});
