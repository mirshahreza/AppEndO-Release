// @vitest-environment jsdom

import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LIVE_DESIGNER_DOCK_HEADER_CLASS, LIVE_DESIGNER_DOCK_TITLE_CLASS } from '../../../../../shared/ui/surfaceClasses';
import { LiveDesignerDockPanelHeader } from '../LiveDesignerDockPanelHeader';
import { LiveDesignerCodePanel } from '../LiveDesignerCodePanel';

afterEach(() => {
  cleanup();
});

describe('LiveDesignerDockPanelHeader', () => {
  it('uses the shared 13px dock title', () => {
    render(
      <LiveDesignerDockPanelHeader
        title="Properties"
        closeAriaLabel="Close properties"
        onClose={() => undefined}
      />,
    );

    const title = screen.getByTestId('live-designer-dock-panel-title');
    expect(title).toHaveTextContent('Properties');
    expect(title).toHaveClass(...LIVE_DESIGNER_DOCK_TITLE_CLASS.split(' '));
    expect(LIVE_DESIGNER_DOCK_TITLE_CLASS).toContain('text-[13px]');
    expect(LIVE_DESIGNER_DOCK_TITLE_CLASS).toContain('leading-none');
    expect(LIVE_DESIGNER_DOCK_HEADER_CLASS).toContain('py-[7px]');
  });
});

describe('LiveDesignerCodePanel header', () => {
  it('uses the same dock title chrome as Properties', () => {
    const onChange = vi.fn();
    render(
      <LiveDesignerCodePanel
        documentKey="demo"
        value=""
        diagnostics={[]}
        onChange={onChange}
        onClose={() => undefined}
        width={320}
      />,
    );

    const title = screen.getByTestId('live-designer-dock-panel-title');
    expect(title).toHaveTextContent('Code');
    expect(title).toHaveClass(...LIVE_DESIGNER_DOCK_TITLE_CLASS.split(' '));
  });
});
