import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils';
import { harmonizeAccentHex, normalizeHex } from '../theme/accentColorUtils';
import { STEP_WIZARD_HEADER_TITLE_INK_CLASS } from './surfaceClasses';

export type StepWizardTabColorPreset = 'gray' | 'theme';

export type StepWizardTabColorCustom = {
  selected: string;
  unselected: string;
};

/** Step-tab tint. Default `theme` follows the active accent. */
export type StepWizardTabColor = StepWizardTabColorPreset | StepWizardTabColorCustom;

export type StepWizardTabState = 'selected' | 'unselected' | 'disabled';

type TabCssVars = CSSProperties & {
  '--step-tab-fill'?: string;
  '--step-tab-ink'?: string;
  '--step-tab-fill-hover'?: string;
  '--step-tab-icon'?: string;
};

export type StepWizardTabAppearance = {
  className: string;
  iconClassName: string;
  style?: TabCssVars;
};

export const isStepWizardTabColorCustom = (
  value: StepWizardTabColor | undefined,
): value is StepWizardTabColorCustom => (
  typeof value === 'object' && value != null && typeof value.selected === 'string'
);

export const resolveStepWizardTabColorMode = (
  tabColor: StepWizardTabColor | undefined,
): StepWizardTabColorPreset | 'custom' => {
  if (!tabColor || tabColor === 'theme') return 'theme';
  if (tabColor === 'gray') return 'gray';
  return 'custom';
};

const GRAY_DISABLED = { cell: 'bg-slate-50/90 text-slate-400', icon: 'text-slate-300' };
const GRAY_SELECTED = { cell: 'bg-slate-200/90 text-slate-900', icon: 'text-slate-800' };
const GRAY_UNSELECTED = { cell: 'text-text-nav', icon: 'text-text-nav-icon' };

const THEME_SELECTED = {
  cell: `bg-[color:var(--app-accent-subtle)] ${STEP_WIZARD_HEADER_TITLE_INK_CLASS}`,
  icon: STEP_WIZARD_HEADER_TITLE_INK_CLASS,
};
const THEME_UNSELECTED = {
  cell: `bg-[color:color-mix(in_srgb,var(--app-accent-500)_10%,white)] ${STEP_WIZARD_HEADER_TITLE_INK_CLASS}`,
  icon: STEP_WIZARD_HEADER_TITLE_INK_CLASS,
};

const customWash = (hex: string, percent: number): string => {
  const normalized = normalizeHex(hex) ?? '#94A3B8';
  return `color-mix(in srgb, ${normalized} ${percent}%, white)`;
};

const customInk = (hex: string): string => {
  const active = harmonizeAccentHex(hex, true).active;
  return `color-mix(in srgb, ${active} 64%, black)`;
};

export const resolveStepWizardTabAppearance = (
  tabColor: StepWizardTabColor | undefined,
  state: StepWizardTabState,
  clickable: boolean,
): StepWizardTabAppearance => {
  const hoverable = clickable && state === 'unselected';
  const pointer = clickable && state !== 'disabled' ? 'cursor-pointer' : undefined;
  const mode = resolveStepWizardTabColorMode(tabColor);

  if (mode === 'gray') {
    const pair = state === 'disabled'
      ? GRAY_DISABLED
      : state === 'selected'
        ? GRAY_SELECTED
        : GRAY_UNSELECTED;
    return {
      className: cn(pair.cell, pointer, hoverable && 'hover:bg-slate-50/80'),
      iconClassName: pair.icon,
    };
  }

  if (mode === 'theme') {
    if (state === 'disabled') {
      return { className: cn(GRAY_DISABLED.cell, pointer), iconClassName: GRAY_DISABLED.icon };
    }
    const pair = state === 'selected' ? THEME_SELECTED : THEME_UNSELECTED;
    return {
      className: cn(
        pair.cell,
        pointer,
        hoverable && 'hover:bg-[color:color-mix(in_srgb,var(--app-accent-500)_16%,white)]',
      ),
      iconClassName: pair.icon,
    };
  }

  if (state === 'disabled') {
    return { className: cn(GRAY_DISABLED.cell, pointer), iconClassName: GRAY_DISABLED.icon };
  }

  const custom = tabColor as StepWizardTabColorCustom;
  const hex = state === 'selected' ? custom.selected : custom.unselected;
  const fill = customWash(hex, state === 'selected' ? 22 : 10);
  const fillHover = customWash(hex, 16);
  const ink = customInk(hex);

  return {
    className: cn(
      'bg-[var(--step-tab-fill)] text-[var(--step-tab-ink)]',
      pointer,
      hoverable && 'hover:bg-[var(--step-tab-fill-hover)]',
    ),
    iconClassName: 'text-[var(--step-tab-icon)]',
    style: {
      '--step-tab-fill': fill,
      '--step-tab-ink': ink,
      '--step-tab-fill-hover': fillHover,
      '--step-tab-icon': ink,
    },
  };
};
