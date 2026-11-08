import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveBaseComponentConfig } from '../../../catalog/resolveBaseComponentConfig';
import {
  TABS_COMPONENT_META,
  TABS_OPTIONS,
} from '../../../catalog/sections/tabs.options';
import { BaseComponentsDecisionPanel } from '../BaseComponentsDecisionPanel';
import { BaseComponentsOptionsPanel } from '../BaseComponentsOptionsPanel';

describe('Base Components metadata panels', () => {
  it('renders decision and option metadata for reusable catalog surfaces', () => {
    const resolution = resolveBaseComponentConfig(TABS_OPTIONS);
    const markup = renderToStaticMarkup(
      <div>
        <BaseComponentsDecisionPanel component={TABS_COMPONENT_META} />
        <BaseComponentsOptionsPanel
          options={TABS_OPTIONS}
          resolution={resolution}
        />
      </div>,
    );

    expect(markup).toContain('Decision');
    expect(markup).toContain('experimental');
    expect(markup).toContain('tabs.activationMode');
    expect(markup).toContain('disabled');
  });
});
