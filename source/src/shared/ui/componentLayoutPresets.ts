export type ComponentLayoutPreset =
  | 'form'
  | 'editor-rail'
  | 'inspector'
  | 'settings-nav'
  | 'dashboard'
  | 'single';

export type ComponentLayoutPresetDefaults = {
  showHeader: boolean;
  showFooter: boolean;
  showStartAside: boolean;
  showEndAside: boolean;
  startAsideSplit: boolean;
  endAsideSplit: boolean;
};

export const COMPONENT_LAYOUT_PRESET_MAP: Record<ComponentLayoutPreset, ComponentLayoutPresetDefaults> = {
  form: {
    showHeader: true,
    showFooter: true,
    showStartAside: false,
    showEndAside: false,
    startAsideSplit: false,
    endAsideSplit: false,
  },
  'editor-rail': {
    showHeader: true,
    showFooter: true,
    showStartAside: false,
    showEndAside: true,
    startAsideSplit: false,
    endAsideSplit: true,
  },
  inspector: {
    showHeader: true,
    showFooter: false,
    showStartAside: true,
    showEndAside: true,
    startAsideSplit: true,
    endAsideSplit: true,
  },
  'settings-nav': {
    showHeader: false,
    showFooter: false,
    showStartAside: true,
    showEndAside: false,
    startAsideSplit: true,
    endAsideSplit: false,
  },
  dashboard: {
    showHeader: true,
    showFooter: false,
    showStartAside: false,
    showEndAside: false,
    startAsideSplit: false,
    endAsideSplit: false,
  },
  single: {
    showHeader: false,
    showFooter: false,
    showStartAside: false,
    showEndAside: false,
    startAsideSplit: false,
    endAsideSplit: false,
  },
};

export function resolveComponentLayoutPreset(
  preset: ComponentLayoutPreset,
  overrides?: Partial<ComponentLayoutPresetDefaults>,
): ComponentLayoutPresetDefaults {
  return { ...COMPONENT_LAYOUT_PRESET_MAP[preset], ...overrides };
}
