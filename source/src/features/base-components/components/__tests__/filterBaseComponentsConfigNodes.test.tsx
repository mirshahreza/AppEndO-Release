/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { FormField, FormSection, UiSelect } from '../../../../shared/ui';
import {
  collectBaseComponentsConfigSearchText,
  filterBaseComponentsConfigNodes,
} from '../filterBaseComponentsConfigNodes';

describe('filterBaseComponentsConfigNodes', () => {
  it('keeps a labeled field when the label matches', () => {
    const tree = (
      <div>
        <FormField label="Intent" reserveHintSlot={false}>intent control</FormField>
        <FormField label="Size" reserveHintSlot={false}>size control</FormField>
      </div>
    );

    const filtered = filterBaseComponentsConfigNodes(tree, 'intent');
    expect(collectBaseComponentsConfigSearchText(filtered).toLowerCase()).toContain('intent');
    expect(collectBaseComponentsConfigSearchText(filtered).toLowerCase()).not.toContain('size');
  });

  it('keeps the whole section payload when the title matches', () => {
    const tree = (
      <FormSection title="Shell">
        <FormField label="Width" reserveHintSlot={false}>width control</FormField>
      </FormSection>
    );

    const filtered = filterBaseComponentsConfigNodes(tree, 'shell');
    expect(collectBaseComponentsConfigSearchText(filtered).toLowerCase()).toContain('width');
  });

  it('keeps a field when an option value matches', () => {
    const tree = (
      <FormField label="Orientation" reserveHintSlot={false}>
        <UiSelect size="sm" ariaLabel="Orientation" value="horizontal" onChange={() => undefined}>
          <option value="horizontal">horizontal</option>
          <option value="vertical">vertical</option>
        </UiSelect>
      </FormField>
    );

    const filtered = filterBaseComponentsConfigNodes(tree, 'vertical');
    expect(filtered).not.toBeNull();
    expect(collectBaseComponentsConfigSearchText(filtered).toLowerCase()).toContain('orientation');
  });

  it('returns null when nothing matches', () => {
    const tree = (
      <FormField label="Intent" reserveHintSlot={false}>intent control</FormField>
    );
    expect(filterBaseComponentsConfigNodes(tree, 'no-such-property')).toBeNull();
  });
});
