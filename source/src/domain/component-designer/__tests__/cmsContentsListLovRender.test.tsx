/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CultureProvider } from '../../../core/culture/CultureContext';
import { buildCmsContentsListDraft } from '../../../../scripts/cms-phase3/cmsDesignerScaffold';
import {
  DesignerDocumentPreview,
  renderDesignerDocumentPreview,
} from '../designerRuntimePreview';
import {
  buildCmsTestBaseInfoCategoryIds,
  buildCmsTestFilterOptions,
  createCmsFetchMock,
} from './fixtures/cmsSaveRestoreFixtures';
import { buildCmsPreviewHarness } from './fixtures/cmsSaveRestoreTestHarness';

const contentsListBundle = buildCmsContentsListDraft({
  filterOptions: buildCmsTestFilterOptions(),
  statusIds: { archived: 'st-archived', draft: 'st-draft' },
  baseInfoCategoryIds: buildCmsTestBaseInfoCategoryIds(),
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CMS contents list dynamic LOV render', () => {
  it('renders the grid after base-info LOV options resolve without sync loops', async () => {
    const { handler } = createCmsFetchMock();
    vi.spyOn(globalThis, 'fetch').mockImplementation(handler);
    const harness = buildCmsPreviewHarness(contentsListBundle);

    let storeUpdates = 0;
    const Host: React.FC = () => {
      const [store, setStore] = React.useState(harness.designerStore);

      return (
        <CultureProvider cultureId="us">
          {renderDesignerDocumentPreview(contentsListBundle.document, {
            bindingDefinitions: contentsListBundle.bindingDefinitions,
            designerStore: store,
            onStoreChange: (updater) => {
              storeUpdates += 1;
              setStore((current) => (typeof updater === 'function' ? updater(current) : updater));
            },
            interactive: true,
            layoutMode: 'shell',
            hydrationData: harness.hydrationData,
          })}
        </CultureProvider>
      );
    };

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<Host />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    });

    const depthExceeded = consoleError.mock.calls.some((call) =>
      call.some((arg) => String(arg).includes('Maximum update depth')),
    );
    const referenceError = consoleError.mock.calls.some((call) =>
      call.some((arg) => String(arg).includes('getPaletteItemForNode')),
    );
    consoleError.mockRestore();

    expect(referenceError).toBe(false);
    expect(depthExceeded).toBe(false);
    expect(storeUpdates).toBeLessThan(30);
    expect(screen.getByText('Original title')).toBeInTheDocument();
  });

  it('keeps a stable Hook order when the published preview parent rerenders', async () => {
    const { handler } = createCmsFetchMock();
    vi.spyOn(globalThis, 'fetch').mockImplementation(handler);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const view = render(
      <CultureProvider cultureId="us">
        <DesignerDocumentPreview
          document={contentsListBundle.document}
          bindingDefinitions={contentsListBundle.bindingDefinitions}
          interactive
          layoutMode="shell"
        />
      </CultureProvider>,
    );

    view.rerender(
      <CultureProvider cultureId="us">
        <DesignerDocumentPreview
          document={contentsListBundle.document}
          bindingDefinitions={contentsListBundle.bindingDefinitions}
          interactive
          layoutMode="shell"
        />
      </CultureProvider>,
    );

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    });

    expect(consoleError.mock.calls.some((call) => (
      call.some((arg) => String(arg).includes('Rendered fewer hooks than expected'))
    ))).toBe(false);
  });
});
