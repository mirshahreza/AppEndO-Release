/**
 * Theme-ink for form section titles and field labels.
 * Uses the operator accent plus complementary (+42°) and contrast/triadic (+196°) channels.
 * Mix toward black so labels stay readable on white (same recipe as toolbox headers),
 * but keep enough chroma that the three channels stay distinct.
 */
export type FormThemeInk = 'accent' | 'complement' | 'contrast';

export const FORM_THEME_INK_TITLE_CLASS: Record<FormThemeInk, string> = {
  accent: 'text-[color:color-mix(in_srgb,var(--app-accent-700)_86%,black)]',
  complement: 'text-[color:color-mix(in_srgb,rgb(var(--app-accent-secondary-rgb))_78%,black)]',
  contrast: 'text-[color:color-mix(in_srgb,rgb(var(--app-accent-tertiary-rgb))_78%,black)]',
};

export const FORM_THEME_INK_LABEL_CLASS: Record<FormThemeInk, string> = {
  accent: 'text-[color:color-mix(in_srgb,var(--app-accent-700)_82%,black)]',
  complement: 'text-[color:color-mix(in_srgb,rgb(var(--app-accent-secondary-rgb))_72%,black)]',
  contrast: 'text-[color:color-mix(in_srgb,rgb(var(--app-accent-tertiary-rgb))_72%,black)]',
};

export const FORM_THEME_INK_BAR_CLASS: Record<FormThemeInk, string> = {
  accent: 'bg-[color:var(--app-accent-600)]',
  complement: 'bg-[rgb(var(--app-accent-secondary-rgb))]',
  contrast: 'bg-[rgb(var(--app-accent-tertiary-rgb))]',
};

export const FORM_THEME_INK_WASH_CLASS: Record<FormThemeInk, string> = {
  accent: 'bg-[color-mix(in_srgb,var(--app-accent-wash)_55%,transparent)]',
  complement: 'bg-[color-mix(in_srgb,rgb(var(--app-accent-secondary-rgb))_14%,transparent)]',
  contrast: 'bg-[color-mix(in_srgb,rgb(var(--app-accent-tertiary-rgb))_14%,transparent)]',
};

export const FORM_THEME_INK_HINT_CLASS: Record<FormThemeInk, string> = {
  accent:
    'text-[color:color-mix(in_srgb,var(--app-accent-600)_50%,#94a3b8)] hover:bg-[color-mix(in_srgb,var(--app-accent-wash)_80%,white)] hover:text-[color:var(--app-accent-700)]',
  complement:
    'text-[color:color-mix(in_srgb,rgb(var(--app-accent-secondary-rgb))_46%,#94a3b8)] hover:bg-[color-mix(in_srgb,rgb(var(--app-accent-secondary-rgb))_14%,white)] hover:text-[color:color-mix(in_srgb,rgb(var(--app-accent-secondary-rgb))_78%,black)]',
  contrast:
    'text-[color:color-mix(in_srgb,rgb(var(--app-accent-tertiary-rgb))_46%,#94a3b8)] hover:bg-[color-mix(in_srgb,rgb(var(--app-accent-tertiary-rgb))_14%,white)] hover:text-[color:color-mix(in_srgb,rgb(var(--app-accent-tertiary-rgb))_78%,black)]',
};

export const FORM_THEME_INK_HINT_OPEN_CLASS: Record<FormThemeInk, string> = {
  accent: 'bg-[color-mix(in_srgb,var(--app-accent-wash)_80%,white)] text-[color:var(--app-accent-700)]',
  complement:
    'bg-[color-mix(in_srgb,rgb(var(--app-accent-secondary-rgb))_14%,white)] text-[color:color-mix(in_srgb,rgb(var(--app-accent-secondary-rgb))_78%,black)]',
  contrast:
    'bg-[color-mix(in_srgb,rgb(var(--app-accent-tertiary-rgb))_14%,white)] text-[color:color-mix(in_srgb,rgb(var(--app-accent-tertiary-rgb))_78%,black)]',
};
