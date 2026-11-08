/**
 * @vitest-environment jsdom
 *
 * Uses real HeroUI Tabs (no mock). Nested UiTabs used to register inside the
 * workspace strip, flattening request/response tabs into the document bar.
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiTabs } from '../UiTabs';
import { UiWorkspaceTabs } from '../UiWorkspaceTabs';

describe('UiWorkspaceTabs nested UiTabs', () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  it('keeps request and response tabs out of the document strip', () => {
    render(
      <UiWorkspaceTabs
        ariaLabel="Open requests"
        selectedKey="doc-1"
        onSelectionChange={vi.fn()}
        onClose={vi.fn()}
        showAllTabsMenu={false}
        items={[{
          id: 'doc-1',
          label: 'Untitled request',
          closeable: true,
          content: (
            <div>
              <UiTabs
                ariaLabel="Request configuration"
                items={[
                  { id: 'request-params', label: 'Params', content: <div>Query params</div> },
                  { id: 'request-headers', label: 'Headers', content: <div>Request headers</div> },
                  { id: 'request-body', label: 'Body', content: <div>Request body</div> },
                  { id: 'request-auth', label: 'Auth', content: <div>Request auth</div> },
                  { id: 'request-tests', label: 'Tests', content: <div>Request tests</div> },
                ]}
              />
              <UiTabs
                ariaLabel="Response"
                items={[
                  { id: 'response-body', label: 'Body', content: <div>Response body</div> },
                  { id: 'response-headers', label: 'Headers', content: <div>Response headers</div> },
                  { id: 'response-tests', label: 'Tests', content: <div>Response tests</div> },
                ]}
              />
            </div>
          ),
        }]}
      />,
    );

    const documentTabs = within(screen.getByRole('tablist', { name: 'Open requests' }))
      .getAllByRole('tab')
      .map((tab) => tab.getAttribute('aria-label'));
    expect(documentTabs).toEqual(['Untitled request']);

    const requestTabs = within(screen.getByRole('tablist', { name: 'Request configuration' }))
      .getAllByRole('tab')
      .map((tab) => tab.getAttribute('aria-label'));
    expect(requestTabs).toEqual(['Params', 'Headers', 'Body', 'Auth', 'Tests']);

    const responseTabs = within(screen.getByRole('tablist', { name: 'Response' }))
      .getAllByRole('tab')
      .map((tab) => tab.getAttribute('aria-label'));
    expect(responseTabs).toEqual(['Body', 'Headers', 'Tests']);

    expect(screen.getByText('Query params')).toBeTruthy();
    expect(screen.getByText('Response body')).toBeTruthy();
  });
});
