// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { VibeAppliedChangesFooter } from '../VibeAppliedChangesFooter';
import type { AppliedChangeItem } from '../../../shared/api/contracts/ai/agentTypes';

const fileItem: AppliedChangeItem = {
  changeSetId: 'cs-file',
  label: 'src/example.ts',
  kind: 'file_patch',
  diffZones: [{ startLine: 2, endLine: 4 }],
};

describe('VibeAppliedChangesFooter', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows per-zone revert controls when handler provided', () => {
    const onRevertZone = vi.fn();
    render(
      <VibeAppliedChangesFooter
        items={[fileItem]}
        onReject={vi.fn()}
        onRevertZone={onRevertZone}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Applied changes/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Revert$/i }));
    expect(onRevertZone).toHaveBeenCalledWith('cs-file', { startLine: 2, endLine: 4 });
  });
});
