/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CultureProvider, useCultureT } from '../CultureContext';
import * as embeddedTranslationBundles from '../embeddedTranslationBundles';

const Probe: React.FC = () => {
  const t = useCultureT();
  return <span data-testid="label">{t('hwy.selfReg.track.section')}</span>;
};

describe('CultureProvider embedded public bundles', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows Iraqi Arabic from sync overlay before /api/boot', () => {
    const syncRuntime = embeddedTranslationBundles.createEmbeddedPublicCultureTranslationRuntime('iq');
    expect(syncRuntime.t('hwy.selfReg.track.section')).toBe('البحث عن طلبك');
  });

  it('keeps Iraqi Arabic when culture adapters are not bootstrapped yet', async () => {
    vi.spyOn(embeddedTranslationBundles, 'loadEmbeddedCultureBundle').mockResolvedValue({
      'hwy.selfReg.track.section': 'البحث عن طلبك',
    });

    render(
      <CultureProvider cultureId="iq" translationBundleSource="embedded">
        <Probe />
      </CultureProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('label').textContent).toBe('البحث عن طلبك');
    });
  });
});
