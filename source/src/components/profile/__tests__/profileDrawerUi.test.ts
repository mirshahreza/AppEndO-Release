/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  PROFILE_DRAWER_PANEL_CLASS,
  PROFILE_IDENTITY_BOX_CLASS,
  PROFILE_PATTERN_HOST_CLASS,
  PROFILE_SECTION_BOX_CLASS,
  ProfileDrawerPatternLayers,
} from '../profileDrawerUi';

describe('PROFILE_DRAWER_PANEL_CLASS', () => {
  it('leaves a page peek on compact viewports instead of covering the full width', () => {
    expect(PROFILE_DRAWER_PANEL_CLASS).toContain(
      'w-[min(400px,calc(100vw-var(--admin-shell-sidebar-width-collapsed,81px)))]',
    );
    expect(PROFILE_DRAWER_PANEL_CLASS).not.toMatch(/(?:^|\s)w-full(?:\s|$)/);
    expect(PROFILE_DRAWER_PANEL_CLASS).not.toContain('sm:w-[400px]');
  });

  it('uses the dashboard shell wash instead of a heavy white slab', () => {
    expect(PROFILE_DRAWER_PANEL_CLASS).toContain('bg-surface-shell');
  });
});

describe('profile drawer surfaces', () => {
  it('keeps identity and section wells free of outline boxes', () => {
    expect(PROFILE_IDENTITY_BOX_CLASS).not.toMatch(/\bborder\b/);
    expect(PROFILE_SECTION_BOX_CLASS).not.toMatch(/\bborder\b/);
    expect(PROFILE_SECTION_BOX_CLASS).toContain('bg-slate-50/80');
  });

  it('tints the identity stack with a small indigo wash', () => {
    expect(PROFILE_IDENTITY_BOX_CLASS).toContain('bg-indigo-50/70');
  });

  it('hosts sidebar chrome so atmosphere can clip into the well', () => {
    expect(PROFILE_IDENTITY_BOX_CLASS).toContain(PROFILE_PATTERN_HOST_CLASS);
  });
});

describe('ProfileDrawerPatternLayers', () => {
  it('reuses the sidebar atmosphere without the dotted menu texture', () => {
    const { container } = render(React.createElement(ProfileDrawerPatternLayers));
    expect(container.querySelector('.install-wizard-backdrop--sidebar-lower')).toBeTruthy();
    expect(container.querySelector('.menu-line-pattern')).toBeNull();
  });
});
