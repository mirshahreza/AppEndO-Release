import { DEFAULT_RGB_VARIABLES, type RgbVariableOption } from './rgbDefinition';

export type RgbPresetCategoryId =
  | 'theme'
  | 'glow'
  | 'brand'
  | 'neutral';

export type RgbPreset = {
  id: string;
  name: string;
  category: RgbPresetCategoryId;
  css: string;
};

export const RGB_PRESET_CATEGORIES: Array<{ id: RgbPresetCategoryId | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'theme', label: 'Theme' },
  { id: 'glow', label: 'Glow' },
  { id: 'brand', label: 'Brand' },
  { id: 'neutral', label: 'Neutral' },
];

const variableCss = (variable: string, alpha: number): string => (
  alpha >= 1 ? `rgb(var(${variable}))` : `rgb(var(${variable}) / ${alpha})`
);

export const RGB_PRESETS: RgbPreset[] = [
  { id: 'accent-solid', name: 'Accent', category: 'theme', css: variableCss('--app-accent-rgb', 1) },
  { id: 'secondary-solid', name: 'Secondary', category: 'theme', css: variableCss('--app-accent-secondary-rgb', 1) },
  { id: 'tertiary-solid', name: 'Tertiary', category: 'theme', css: variableCss('--app-accent-tertiary-rgb', 1) },
  { id: 'accent-wash', name: 'Accent wash', category: 'theme', css: variableCss('--app-accent-rgb', 0.14) },
  { id: 'secondary-wash', name: 'Secondary wash', category: 'theme', css: variableCss('--app-accent-secondary-rgb', 0.12) },
  { id: 'tertiary-wash', name: 'Tertiary wash', category: 'theme', css: variableCss('--app-accent-tertiary-rgb', 0.15) },

  { id: 'accent-glow-soft', name: 'Accent glow soft', category: 'glow', css: variableCss('--app-accent-rgb', 0.07) },
  { id: 'accent-glow', name: 'Accent glow', category: 'glow', css: variableCss('--app-accent-rgb', 0.16) },
  { id: 'accent-glow-strong', name: 'Accent glow strong', category: 'glow', css: variableCss('--app-accent-rgb', 0.24) },
  { id: 'secondary-glow', name: 'Secondary glow', category: 'glow', css: variableCss('--app-accent-secondary-rgb', 0.18) },
  { id: 'tertiary-glow', name: 'Tertiary glow', category: 'glow', css: variableCss('--app-accent-tertiary-rgb', 0.19459694989106752) },
  { id: 'tertiary-glow-soft', name: 'Tertiary glow soft', category: 'glow', css: variableCss('--app-accent-tertiary-rgb', 0.014) },

  { id: 'teal-ink', name: 'Teal ink', category: 'brand', css: 'rgb(0 162 138 / 1)' },
  { id: 'indigo-ink', name: 'Indigo ink', category: 'brand', css: 'rgb(99 102 241 / 1)' },
  { id: 'violet-ink', name: 'Violet ink', category: 'brand', css: 'rgb(124 58 237 / 1)' },
  { id: 'sky-ink', name: 'Sky ink', category: 'brand', css: 'rgb(14 165 233 / 1)' },
  { id: 'rose-ink', name: 'Rose ink', category: 'brand', css: 'rgb(244 63 94 / 1)' },
  { id: 'amber-ink', name: 'Amber ink', category: 'brand', css: 'rgb(245 158 11 / 1)' },

  { id: 'white-solid', name: 'White', category: 'neutral', css: 'rgb(255 255 255 / 1)' },
  { id: 'white-wash', name: 'White wash', category: 'neutral', css: 'rgb(255 255 255 / 0.94)' },
  { id: 'slate-ink', name: 'Slate ink', category: 'neutral', css: 'rgb(15 23 42 / 1)' },
  { id: 'black-wash', name: 'Black wash', category: 'neutral', css: 'rgb(0 0 0 / 0.06)' },
  { id: 'black-veil', name: 'Black veil', category: 'neutral', css: 'rgb(0 0 0 / 0.32)' },
  { id: 'transparent', name: 'Transparent', category: 'neutral', css: 'rgb(0 0 0 / 0)' },
];

export const getRgbPresetsByCategory = (category: RgbPresetCategoryId | 'all'): RgbPreset[] => (
  category === 'all' ? RGB_PRESETS : RGB_PRESETS.filter((preset) => preset.category === category)
);

export const getRgbVariableOptions = (
  extras: readonly RgbVariableOption[] = [],
): RgbVariableOption[] => {
  const merged = new Map<string, RgbVariableOption>();
  for (const option of [...DEFAULT_RGB_VARIABLES, ...extras]) {
    merged.set(option.name, option);
  }
  return [...merged.values()];
};
