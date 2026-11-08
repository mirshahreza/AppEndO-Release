import {
  getWorkspaceSectionNavToneActiveClass,
  getWorkspaceSectionNavToneIconClass,
  type AppSurfaceBoxTone,
} from '../../shared/ui/surfaceClasses';
import { PRIMITIVE_SECTION_IDS } from './catalog/sections/primitiveSections.options';
import type { SectionId } from './types';

/**
 * Per-section accents for BaseComponents.
 * Large surfaces stay neutral (see baseComponentsVisualTokens / data-studio-modeler.md).
 * Only small icons use hue for wayfinding; FormSection tones inside demos may
 * still teach the tone map independently.
 */
export type BaseComponentsSectionTheme = {
  /** Optional FormSection / surface teaching tone for the section’s demos */
  tone: AppSurfaceBoxTone;
  /** JSON preview shell tone in Preview config dialog */
  jsonTone: AppSurfaceBoxTone;
  /** Small icon accent in header + nav (text-* only) */
  iconClass: string;
};

const theme = (
  tone: AppSurfaceBoxTone,
  jsonTone: AppSurfaceBoxTone = 'slate',
): BaseComponentsSectionTheme => ({
  tone,
  jsonTone,
  iconClass: getWorkspaceSectionNavToneIconClass(tone),
});

export const BASE_COMPONENTS_SECTION_THEME: Record<SectionId, BaseComponentsSectionTheme> = {
  dialog: theme('indigo', 'violet'),
  'floating-panel': theme('amber', 'violet'),
  'canvas-toolbar': theme('cyan', 'indigo'),
  'toolbox-panel': theme('violet', 'indigo'),
  'sidebar-menu': theme('indigo', 'cyan'),
  'create-edit': theme('violet', 'indigo'),
  confirm: theme('rose', 'slate'),
  wizard: theme('violet', 'indigo'),
  grid: theme('cyan', 'slate'),
  treegrid: theme('emerald', 'slate'),
  'crud-set': theme('cyan', 'slate'),
  'edit-view': theme('indigo', 'slate'),
  'text-fields': theme('emerald', 'indigo'),
  'choice-fields': theme('emerald', 'slate'),
  'selection-fields': theme('cyan', 'indigo'),
  'structured-fields': theme('violet', 'indigo'),
  'ai-fields': theme('indigo', 'violet'),
  'ai-chat-panel': theme('indigo', 'violet'),
  'where-builder': theme('cyan', 'indigo'),
  relations: theme('violet', 'indigo'),
  toolbar: theme('indigo', 'cyan'),
  buttons: theme('indigo', 'slate'),
  search: theme('emerald', 'slate'),
  'surface-box': theme('amber', 'slate'),
  'scroll-area': theme('amber', 'cyan'),
  'dock-pane': theme('amber', 'indigo'),
  toast: theme('emerald', 'rose'),
  'orbit-border': theme('violet', 'cyan'),
  'orbit-bg': theme('cyan', 'violet'),
  'icon-sets': theme('slate', 'indigo'),
  'markdown-editor': theme('cyan', 'slate'),
  'html-editor': theme('violet', 'slate'),
  avatar: theme('rose', 'slate'),
  'appendoo-companion': theme('rose', 'amber'),
  chip: theme('rose', 'indigo'),
  'phone-number': theme('sky', 'emerald'),
  skeleton: theme('emerald', 'slate'),
  progress: theme('emerald', 'indigo'),
  breadcrumbs: theme('amber', 'slate'),
  tabs: theme('amber', 'indigo'),
  'accordion-disclosure': theme('amber', 'indigo'),
  'popover-tooltip': theme('violet', 'slate'),
  'date-time': theme('cyan', 'indigo'),
  'file-media-input': theme('emerald', 'slate'),
  'loading-error-empty': theme('emerald', 'rose'),
  chart: theme('indigo', 'slate'),
  kanban: theme('indigo', 'cyan'),
  spreadsheet: theme('emerald', 'cyan'),
  'shell-foundation': theme('violet', 'indigo'),
  'shell-navigation': theme('cyan', 'violet'),
  'shell-effects': theme('amber', 'violet'),
  'landing-widgets': theme('cyan', 'indigo'),
  'motion-behaviors': theme('violet', 'cyan'),
  'creative-scenes': theme('indigo', 'violet'),
  'visual-engines': theme('emerald', 'cyan'),
  'color-picker': theme('rose', 'violet'),
  'variable-color-picker': theme('cyan', 'indigo'),
  'gradient-picker': theme('violet', 'indigo'),
  'border-shadow-picker': theme('violet', 'indigo'),
  'transfer-list': theme('emerald', 'cyan'),
  'component-layout': theme('amber', 'indigo'),
  'client-component': theme('amber', 'slate'),
  map: theme('cyan', 'indigo'),
  codes: theme('indigo', 'slate'),
  'media-players': theme('violet', 'cyan'),
  ...Object.fromEntries(PRIMITIVE_SECTION_IDS.map((id) => [id, theme('slate', 'slate')])),
  'notification-badge': theme('rose', 'slate'),
  'calendar-grid': theme('indigo', 'cyan'),
  'range-calendar-grid': theme('indigo', 'cyan'),
  kbd: theme('cyan', 'slate'),
  'user-card': theme('rose', 'indigo'),
  'hwy-member-face': theme('sky', 'rose'),
  snippet: theme('cyan', 'slate'),
  'hover-card': theme('violet', 'slate'),
  'context-menu': theme('violet', 'slate'),
  'command-palette': theme('indigo', 'violet'),
  'sortable-list': theme('emerald', 'cyan'),
  'comparison-slider': theme('cyan', 'indigo'),
  'mermaid-diagram': theme('cyan', 'indigo'),
  'virtualized-list': theme('emerald', 'cyan'),
  'signature-pad': theme('amber', 'slate'),
  menubar: theme('indigo', 'slate'),
  'code-scanner': theme('cyan', 'indigo'),
  'document-viewer': theme('indigo', 'slate'),
} as Record<SectionId, BaseComponentsSectionTheme>;

export function getBaseComponentsSectionTheme(sectionId: SectionId): BaseComponentsSectionTheme {
  return BASE_COMPONENTS_SECTION_THEME[sectionId];
}

export function getBaseComponentsSectionNavActiveClass(sectionId: SectionId): string {
  return getWorkspaceSectionNavToneActiveClass(BASE_COMPONENTS_SECTION_THEME[sectionId].tone);
}
