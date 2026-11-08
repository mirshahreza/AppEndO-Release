import {
  createDefaultBorderShadow,
  cloneBorderShadowDefinition,
  updateBorder,
  type BorderShadowDefinition,
} from './borderShadowDefinition';

export type BorderShadowPresetCategoryId =
  | 'card'
  | 'subtle'
  | 'elevated'
  | 'outline'
  | 'glow'
  | 'brand'
  | 'rounded'
  | 'sharp';

export type BorderShadowPreset = {
  id: string;
  name: string;
  category: BorderShadowPresetCategoryId;
  definition: BorderShadowDefinition;
};

const preset = (
  id: string,
  name: string,
  category: BorderShadowPresetCategoryId,
  apply: (base: BorderShadowDefinition) => BorderShadowDefinition,
): BorderShadowPreset => ({
  id,
  name,
  category,
  definition: apply(createDefaultBorderShadow()),
});

export const BORDER_SHADOW_PRESET_CATEGORIES: Array<{ id: BorderShadowPresetCategoryId | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'card', label: 'Card' },
  { id: 'subtle', label: 'Subtle' },
  { id: 'elevated', label: 'Elevated' },
  { id: 'outline', label: 'Outline' },
  { id: 'glow', label: 'Glow' },
  { id: 'brand', label: 'Brand' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'sharp', label: 'Sharp' },
];

export const BORDER_SHADOW_PRESETS: BorderShadowPreset[] = [
  preset('card-default', 'Default card', 'card', (base) => cloneBorderShadowDefinition({
    ...base,
    border: updateBorder(base.border, { width: 1, radius: 12, color: '#e2e8f0' }),
  })),
  preset('card-elevated', 'Elevated card', 'card', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 0, style: 'none', radius: 16 });
    next.shadow.layers = [
      { id: 's1', offsetX: 0, offsetY: 8, blur: 24, spread: -4, color: 'rgba(15, 23, 42, 0.12)', inset: false },
      { id: 's2', offsetX: 0, offsetY: 4, blur: 8, spread: -2, color: 'rgba(15, 23, 42, 0.06)', inset: false },
    ];
    return next;
  }),
  preset('card-panel', 'Panel', 'card', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 1, radius: 10, color: '#cbd5e1' });
    next.shadow.layers = [
      { id: 's1', offsetX: 0, offsetY: 4, blur: 14, spread: 0, color: 'rgba(15, 23, 42, 0.08)', inset: false },
    ];
    return next;
  }),

  preset('subtle-xs', 'Subtle XS', 'subtle', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 1, radius: 6, color: '#f1f5f9' });
    next.shadow.layers = [
      { id: 's1', offsetX: 0, offsetY: 1, blur: 2, spread: 0, color: 'rgba(0, 0, 0, 0.05)', inset: false },
    ];
    return next;
  }),
  preset('subtle-sm', 'Subtle SM', 'subtle', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 1, radius: 8, color: '#e2e8f0' });
    next.shadow.layers = [
      { id: 's1', offsetX: 0, offsetY: 1, blur: 3, spread: 0, color: 'rgba(0, 0, 0, 0.1)', inset: false },
      { id: 's2', offsetX: 0, offsetY: 1, blur: 2, spread: 0, color: 'rgba(0, 0, 0, 0.06)', inset: false },
    ];
    return next;
  }),

  preset('elevated-modal', 'Modal', 'elevated', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 0, style: 'none', radius: 16 });
    next.shadow.layers = [
      { id: 's1', offsetX: 0, offsetY: 24, blur: 48, spread: -12, color: 'rgba(15, 23, 42, 0.18)', inset: false },
      { id: 's2', offsetX: 0, offsetY: 12, blur: 24, spread: -8, color: 'rgba(15, 23, 42, 0.12)', inset: false },
    ];
    return next;
  }),
  preset('elevated-dropdown', 'Dropdown', 'elevated', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 1, radius: 10, color: '#e2e8f0' });
    next.shadow.layers = [
      { id: 's1', offsetX: 0, offsetY: 12, blur: 28, spread: -6, color: 'rgba(15, 23, 42, 0.16)', inset: false },
    ];
    return next;
  }),

  preset('outline-indigo', 'Indigo outline', 'outline', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 2, radius: 10, color: '#6366f1', style: 'solid' });
    next.shadow.layers = [];
    return next;
  }),
  preset('outline-dashed', 'Dashed outline', 'outline', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 2, radius: 8, color: '#94a3b8', style: 'dashed' });
    next.shadow.layers = [];
    return next;
  }),
  preset('outline-ring', 'Focus ring', 'outline', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 2, radius: 8, color: '#6366f1' });
    next.shadow.layers = [
      { id: 's1', offsetX: 0, offsetY: 0, blur: 0, spread: 3, color: 'rgba(99, 102, 241, 0.25)', inset: false },
    ];
    return next;
  }),

  preset('glow-soft', 'Soft glow', 'glow', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 1, radius: 12, color: '#e0e7ff' });
    next.shadow.layers = [
      { id: 's1', offsetX: 0, offsetY: 0, blur: 20, spread: 0, color: 'rgba(99, 102, 241, 0.3)', inset: false },
    ];
    return next;
  }),
  preset('glow-neon', 'Neon glow', 'glow', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 1, radius: 12, color: '#8b5cf6' });
    next.shadow.layers = [
      { id: 's1', offsetX: 0, offsetY: 0, blur: 16, spread: 0, color: 'rgba(139, 92, 246, 0.6)', inset: false },
      { id: 's2', offsetX: 0, offsetY: 0, blur: 32, spread: 0, color: 'rgba(139, 92, 246, 0.3)', inset: false },
    ];
    return next;
  }),

  preset('brand-popover', 'Brand popover', 'brand', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 1, radius: 12, color: '#e2e8f0' });
    next.shadow.layers = [
      { id: 's1', offsetX: 0, offsetY: 24, blur: 64, spread: -16, color: 'rgba(15, 23, 42, 0.32)', inset: false },
      { id: 's2', offsetX: 0, offsetY: 12, blur: 28, spread: -12, color: 'rgba(99, 102, 241, 0.18)', inset: false },
    ];
    return next;
  }),
  preset('brand-accent', 'Brand accent', 'brand', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 2, radius: 10, color: '#6366f1' });
    next.shadow.layers = [
      { id: 's1', offsetX: 0, offsetY: 8, blur: 24, spread: -4, color: 'rgba(99, 102, 241, 0.28)', inset: false },
    ];
    return next;
  }),

  preset('rounded-pill', 'Pill', 'rounded', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 1, radius: 999, color: '#e2e8f0' });
    next.shadow.layers = [
      { id: 's1', offsetX: 0, offsetY: 2, blur: 8, spread: 0, color: 'rgba(15, 23, 42, 0.08)', inset: false },
    ];
    return next;
  }),
  preset('rounded-soft', 'Soft round', 'rounded', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 1, radius: 24, color: '#f1f5f9' });
    next.shadow.layers = [
      { id: 's1', offsetX: 0, offsetY: 8, blur: 32, spread: 0, color: 'rgba(148, 163, 184, 0.2)', inset: false },
    ];
    return next;
  }),

  preset('sharp-edge', 'Sharp edge', 'sharp', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 1, radius: 0, color: '#cbd5e1' });
    next.shadow.layers = [
      { id: 's1', offsetX: 0, offsetY: 2, blur: 0, spread: 0, color: 'rgba(0, 0, 0, 0.15)', inset: false },
    ];
    return next;
  }),
  preset('sharp-offset', 'Offset drop', 'sharp', (base) => {
    const next = cloneBorderShadowDefinition(base);
    next.border = updateBorder(next.border, { width: 2, radius: 0, color: '#0f172a' });
    next.shadow.layers = [
      { id: 's1', offsetX: 4, offsetY: 4, blur: 0, spread: 0, color: 'rgba(15, 23, 42, 0.15)', inset: false },
    ];
    return next;
  }),
];

export const getBorderShadowPresetsByCategory = (
  category: BorderShadowPresetCategoryId | 'all',
): BorderShadowPreset[] => (
  category === 'all'
    ? BORDER_SHADOW_PRESETS
    : BORDER_SHADOW_PRESETS.filter((preset) => preset.category === category)
);
