// @vitest-environment jsdom

import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { DEFAULT_PWA_SETTINGS } from '../../../../shared/api/contracts/settings/pwa';
import { PwaIconField } from '../PwaIconField';
import { SettingsFormGroup } from '../form/SettingsFormPrimitives';

const renderField = () => render(
  <SettingsFormGroup sectionId="pwa">
    <PwaIconField
      label="Icon 192×192"
      slot="192"
      pwa={DEFAULT_PWA_SETTINGS}
      onPickFromLibrary={() => undefined}
      onUploadFile={() => undefined}
      onChange={() => undefined}
    />
  </SettingsFormGroup>,
);

describe('PwaIconField', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the icon preview via the PWA icon file endpoint', () => {
    renderField();

    const preview = screen.getByRole('button', { name: /Change Icon 192×192/i }).querySelector('img');
    expect(preview?.getAttribute('src')).toContain('/api/pwa/icons/192/file?url=');
    expect(preview?.getAttribute('src')).toContain(encodeURIComponent('/pwa-192x192.png'));
  });

  it('shows library and upload actions in the icon menu', () => {
    renderField();

    fireEvent.click(screen.getByRole('button', { name: /Change Icon 192×192/i }));

    expect(screen.getByRole('menuitem', { name: /Pick from icon library/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Upload image/i })).toBeTruthy();
  });

  it('uses custom icon urls in the preview endpoint', () => {
    render(
      <SettingsFormGroup sectionId="pwa">
        <PwaIconField
          label="Icon 192×192"
          slot="192"
          pwa={{
            ...DEFAULT_PWA_SETTINGS,
            icon192Url: '/assets/platform/pwa/icon-192.png',
          }}
          onPickFromLibrary={() => undefined}
          onUploadFile={() => undefined}
          onChange={() => undefined}
        />
      </SettingsFormGroup>,
    );

    const preview = screen.getByRole('button', { name: /Change Icon 192×192/i }).querySelector('img');
    expect(preview?.getAttribute('src')).toContain(encodeURIComponent('/assets/platform/pwa/icon-192.png'));
  });
});
