// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const ensurePackageUiRuntime = vi.fn(async () => undefined);

vi.mock('../../../core/packages/ensurePackageUiRuntime', () => ({
  ensurePackageUiRuntime: () => ensurePackageUiRuntime(),
}));

import { PackagePageModule } from '../PackagePageModule';

describe('PackagePageModule', () => {
  beforeEach(() => {
    ensurePackageUiRuntime.mockClear();
  });

  it('loads package UI runtime before importing the page module', async () => {
    render(<PackagePageModule loaderRef="cms:cms-site-home" />);

    await waitFor(() => {
      expect(ensurePackageUiRuntime).toHaveBeenCalledTimes(1);
    });
  });
});
