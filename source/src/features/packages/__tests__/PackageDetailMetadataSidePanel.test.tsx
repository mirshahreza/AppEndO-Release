// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { PackageDetail } from '../types';
import { PackageDetailMetadataSidePanel } from '../components/PackageDetailMetadataSidePanel';

const detail: PackageDetail = {
  packageId: 'cms',
  displayName: 'CMS',
  version: '1.2.0',
  installStatus: 'installed',
  activeInstalledVersion: '1.1.0',
  bundleManifest: {
    id: 'cms',
    name: 'CMS',
    version: '1.2.0',
    requiredAppVersion: '>=1.0.0',
    description: 'Pages, posts, and vocabularies for the tenant site.',
    createdAt: '2026-08-01T00:00:00.000Z',
    createdBy: 'admin',
    dependencies: [{ packageId: 'identity', versionRange: '>=2.0.0' }],
    capabilities: {
      apis: [],
      ui_components: [],
      db_objects: [],
    },
  },
};

afterEach(() => {
  cleanup();
});

describe('PackageDetailMetadataSidePanel', () => {
  it('uses the nested-editor inspector chrome', () => {
    render(<PackageDetailMetadataSidePanel detailData={detail} />);

    const rail = screen.getByTestId('package-detail-inspector-rail');
    expect(rail.className).toContain('--app-inspector-rail-width');
    expect(rail.className).toContain('--app-inspector-rail-bg');
    expect(rail).toHaveClass('border-s');
    expect(rail).not.toHaveClass('border-l');
    expect(rail).not.toHaveClass('w-80');
    expect(rail).toHaveTextContent('Metadata');
    expect(rail).toHaveTextContent('Dependencies');
    expect(rail).toHaveTextContent('Description');
    expect(rail).not.toHaveTextContent('Summary');
    expect(rail).not.toHaveTextContent('Audit trail');
    expect(rail).not.toHaveTextContent('Package Name');
    expect(screen.getByTestId('package-detail-inspector-audit')).toHaveTextContent('Created');
    expect(screen.getByTestId('package-detail-inspector-audit')).toHaveTextContent('admin • Aug 1, 2026');
    expect(rail).toHaveTextContent('identity');
    expect(rail).toHaveTextContent('>=2.0.0');
    expect(rail).toHaveTextContent('Pages, posts, and vocabularies for the tenant site.');
  });

  it('applies a live width from the ghost splitter', () => {
    render(<PackageDetailMetadataSidePanel detailData={detail} widthPx={420} />);

    expect(screen.getByTestId('package-detail-inspector-rail')).toHaveStyle({ width: '420px' });
  });

  it('shows None selected for empty active version and empty description', () => {
    render(
      <PackageDetailMetadataSidePanel
        detailData={{
          ...detail,
          activeInstalledVersion: null,
          bundleManifest: {
            ...detail.bundleManifest!,
            description: '',
            dependencies: [],
            createdAt: undefined,
            createdBy: undefined,
          },
        }}
      />,
    );

    const rail = screen.getByTestId('package-detail-inspector-rail');
    expect(rail).toHaveTextContent('None selected');
    expect(rail).not.toHaveTextContent('No description recorded.');
    expect(rail).not.toHaveTextContent('--');
    expect(screen.queryByTestId('package-detail-inspector-audit')).not.toBeInTheDocument();
  });
});
