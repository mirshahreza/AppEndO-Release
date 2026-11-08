/**
 * T1-11e — multi-role capability tags for palette items.
 * Inspector section visibility (container Layout, Data tier, …) checks these
 * instead of a single exclusive nodeClass.
 */

export const DESIGNER_PALETTE_CAPABILITIES = [
  'container',
  'leaf-content',
  'bindable',
  'repeatable',
  'resizable',
  'overlay',
  'navigation',
  'dataSource',
  'shell',
] as const;

export type DesignerPaletteCapability = (typeof DESIGNER_PALETTE_CAPABILITIES)[number];

/** Legacy exclusive classes from inspector redesign spec §4 (derived from capabilities). */
export const DESIGNER_NODE_CLASSES = [
  'container',
  'leaf-content',
  'form-input',
  'data-widget',
  'overlay-nav',
] as const;

export type DesignerNodeClass = (typeof DESIGNER_NODE_CLASSES)[number];

/** Flex/Grid layout controls that only belong on true layout containers. */
export const INSPECTOR_CONTAINER_LAYOUT_FIELD_KEYS = new Set<string>([
  'twFlexDirection',
  'twItems',
  'twJustify',
  'twGap',
  'twGridCols',
  'layoutGridDirection',
  'layoutGridColumnWidths',
]);

const FORM_INPUT_PALETTE_IDS = new Set<string>([
  'heroui.input-text',
  'heroui.textarea',
  'heroui.number-input',
  'heroui.select',
  'heroui.autocomplete',
  'heroui.entity-picker',
  'heroui.date-picker',
  'form.date-range',
  'form.code-editor',
  'form.html-editor',
  'form.markdown-editor',
  'form.mask-input',
  'form.calculator',
  'form.relation-tags-list',
  'form.related-contents-list',
  'form.cms-content-assets',
  'form.base-info-record',
  'form.otp-input',
  'form.time-input',
  'form.datetime-input',
  'form.rating',
  'heroui.color-control',
  'heroui.tags-input',
  'heroui.checkbox-group',
  'heroui.radio-group',
  'heroui.switch',
  'heroui.slider',
]);

const uniqueCapabilities = (
  values: readonly DesignerPaletteCapability[],
): DesignerPaletteCapability[] => {
  const seen = new Set<DesignerPaletteCapability>();
  const result: DesignerPaletteCapability[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
};

export const hasPaletteCapability = (
  capabilities: readonly DesignerPaletteCapability[] | undefined,
  capability: DesignerPaletteCapability,
): boolean => Boolean(capabilities?.includes(capability));

export const deriveDefaultCapabilities = (item: {
  id: string;
  canHaveChildren: boolean;
  category?: string;
}): DesignerPaletteCapability[] => {
  const { id, canHaveChildren, category } = item;
  const caps: DesignerPaletteCapability[] = [];

  if (id.startsWith('shell.') || category === 'shell-chrome') {
    caps.push('shell');
    if (canHaveChildren) {
      caps.push('container');
    }
    return uniqueCapabilities(caps);
  }

  if (
    id.startsWith('viz.')
    || id.includes('data-grid')
    || id.includes('app-table-grid')
    || id.includes('.chart')
    || category === 'data-visualization'
  ) {
    caps.push('dataSource', 'bindable');
    return uniqueCapabilities(caps);
  }

  if (
    id.includes('modal')
    || id.includes('drawer')
    || id.includes('alert-dialog')
    || id.includes('popover')
    || id.includes('overlay')
  ) {
    caps.push('overlay');
    if (canHaveChildren) {
      caps.push('container');
    }
    return uniqueCapabilities(caps);
  }

  if (
    id.includes('tabs')
    || id.includes('breadcrumb')
    || id.includes('navbar')
    || id === 'heroui.link'
    || id === 'html.link'
    || category === 'platform-navigation'
    || category === 'platform-workspace'
    || id.startsWith('platform.nav')
  ) {
    caps.push('navigation');
    if (canHaveChildren) {
      caps.push('container');
    }
    return uniqueCapabilities(caps);
  }

  if (canHaveChildren) {
    caps.push('container');
    if (id === 'html.form' || id === 'html.container' || id.startsWith('layout.')) {
      caps.push('bindable');
    }
    if (id === 'logic.repeater') {
      caps.push('repeatable', 'bindable');
    }
    if (
      id.startsWith('content.')
      || id.startsWith('marketing.')
      || category === 'content-media'
      || category === 'marketing'
    ) {
      caps.push('bindable');
    }
    return uniqueCapabilities(caps);
  }

  caps.push('leaf-content');
  if (
    FORM_INPUT_PALETTE_IDS.has(id)
    || category === 'heroui-forms-inputs'
    || id.startsWith('form.')
    || id.startsWith('content.')
    || id.startsWith('marketing.')
    || category === 'content-media'
    || category === 'marketing'
  ) {
    caps.push('bindable');
  }

  return uniqueCapabilities(caps);
};

export const deriveNodeClass = (
  capabilities: readonly DesignerPaletteCapability[],
  paletteItemId?: string,
): DesignerNodeClass => {
  const id = paletteItemId ?? '';

  if (
    FORM_INPUT_PALETTE_IDS.has(id)
    || id.startsWith('form.')
    || (capabilities.includes('leaf-content')
      && capabilities.includes('bindable')
      && !capabilities.includes('container')
      && !capabilities.includes('dataSource')
      && (id.startsWith('heroui.input')
        || id.startsWith('heroui.textarea')
        || id.startsWith('heroui.number')
        || id.startsWith('heroui.select')
        || id.startsWith('heroui.auto')
        || id.startsWith('heroui.entity')
        || id.startsWith('heroui.date')
        || id.startsWith('heroui.color')
        || id.startsWith('heroui.tags')
        || id.startsWith('heroui.checkbox')
        || id.startsWith('heroui.radio')
        || id.startsWith('heroui.switch')
        || id.startsWith('heroui.slider')))
  ) {
    return 'form-input';
  }

  if (capabilities.includes('dataSource')) {
    return 'data-widget';
  }

  if (capabilities.includes('overlay') || capabilities.includes('navigation')) {
    return 'overlay-nav';
  }

  if (capabilities.includes('container')) {
    return 'container';
  }

  return 'leaf-content';
};

export type PaletteCapabilityFields = {
  capabilities: DesignerPaletteCapability[];
  /** Derived exclusive class kept for callers that still expect a single kind. */
  nodeClass: DesignerNodeClass;
};

export const finalizePaletteCapabilities = <T extends {
  id: string;
  canHaveChildren: boolean;
  category?: string;
  capabilities?: readonly DesignerPaletteCapability[];
  nodeClass?: DesignerNodeClass;
}>(items: readonly T[]): Array<T & PaletteCapabilityFields> => (
  items.map((item) => {
    const capabilities = item.capabilities
      ? uniqueCapabilities(item.capabilities)
      : deriveDefaultCapabilities(item);
    const nodeClass = item.nodeClass ?? deriveNodeClass(capabilities, item.id);
    return {
      ...item,
      capabilities,
      nodeClass,
    };
  })
);
