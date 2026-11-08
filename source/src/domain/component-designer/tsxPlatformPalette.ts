import type { DesignerNode } from './types';
import type { TsxBindingRenderContext } from './bindingCodegen';
import { resolveNodePropertyBindingExpression } from './bindingCodegen';
import { buildNodeJsxAttributesWithBindings, jsxAttributeStringValue, renderNodeJsxAttributes } from './tsxPropMapper';
import { readBoolean, readNumber, readString } from './runtimeShared';
import { isSlotPaletteItemId } from './slotPalette';
import { isPlatformNavPaletteItemId } from './navigationComponentPalette';
import { isPlatformChromePaletteItemId } from './platformChromePalette';
import {
  SHELL_CHROME_DEFAULT_NAVIGATION_REF,
  SHELL_NAVIGATION_COMPONENT_KEY_PROP,
  SHELL_NAVIGATION_REF_PROP,
} from '../../shared/lib/shellNavigationProps';
import {
  SHELL_LOGO_ALT_PROP,
  SHELL_LOGO_HREF_PROP,
  SHELL_LOGO_SRC_PROP,
} from '../../shared/lib/shellLogoProps';
import { SHELL_NAV_SLOT_NAVIGATION_REF_PROP } from '../../shared/lib/shellNavSlotProps';

/**
 * Codegen for the "Platform Navigation" and "Platform Slots" dynamic palette categories,
 * plus Phase 53 platform chrome widgets (command palette / notification / user menu / chat stub).
 *
 * Bug found (cluster F — viz/dynamic-palette audit): before this fix, `platform.nav.*` and
 * `platform.slot.*` nodes fell through to the generic HTML-container path in
 * tsxNodeRenderer.ts (nothing in tsxComponentRegistry.ts recognized these palette-id
 * prefixes), so `generateDesignerTsx` emitted a plain `<div componentKey="..." ...>` /
 * `<div slotId="..." ...>` — a DOM element with non-standard attributes and none of the
 * actual navigation/slot resolution logic. This only affects the *exported* `.tsx` package
 * artifact (used by the Package Manager "export component" feature); the live in-app
 * designer canvas/preview and published pages/shells render these nodes correctly via
 * `designerRuntimePreview.tsx`, which already imports the real `PlatformNavigationHost` /
 * slot-resolution components. This fix makes the exported code use the same real runtime
 * components so packaged/exported components actually work outside the designer.
 */

const PLATFORM_NAV_IMPORT_SOURCE = '@/layouts/adminShell/nav/PlatformNavigationHost';
const PLATFORM_NAV_REACT_TAG = 'PlatformNavigationHost';

const PLATFORM_SLOT_IMPORT_SOURCE = '@/features/component-designer/components/DesignerSlotPreview';
const PLATFORM_SLOT_REACT_TAG = 'DesignerSlotPreview';

const PLATFORM_CHROME_IMPORT_SOURCE = '@/domain/component-designer/DesignerRuntimePlatformChrome';

const toJsxAttr = (value: string): string => jsxAttributeStringValue(value);

const renderAttrs = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  excludeKeys: ReadonlySet<string>,
): string => (bindingContext
  ? buildNodeJsxAttributesWithBindings(node, bindingContext, { excludeKeys })
  : renderNodeJsxAttributes(node, { excludeKeys }));

/** Literal string attr, or empty when a property binding already emits it via renderAttrs. */
const literalOrBoundSkip = (
  node: DesignerNode,
  bindingContext: TsxBindingRenderContext | undefined,
  prop: string,
  fallbackLiteral: string,
): string => {
  if (bindingContext && resolveNodePropertyBindingExpression(node.id, prop, bindingContext)) {
    return '';
  }
  return fallbackLiteral.trim().length > 0 ? ` ${prop}=${toJsxAttr(fallbackLiteral)}` : '';
};

export const renderPlatformPaletteJsx = (
  paletteItemId: string,
  node: DesignerNode,
  bindingContext?: TsxBindingRenderContext,
): string | null => {
  if (isPlatformNavPaletteItemId(paletteItemId)) {
    const excludeKeys = new Set([SHELL_NAVIGATION_COMPONENT_KEY_PROP, SHELL_NAVIGATION_REF_PROP]);
    const attrs = renderAttrs(node, bindingContext, excludeKeys);
    const componentKey = readString(node.props[SHELL_NAVIGATION_COMPONENT_KEY_PROP]);
    const navigationRef = readString(node.props[SHELL_NAVIGATION_REF_PROP], SHELL_CHROME_DEFAULT_NAVIGATION_REF);
    return `<${PLATFORM_NAV_REACT_TAG}${attrs} componentKey=${toJsxAttr(componentKey)} navigationRef=${toJsxAttr(navigationRef)} />`;
  }

  if (isSlotPaletteItemId(paletteItemId)) {
    // Bug found (parity audit item 4): `slotProps` was never passed at all — only slotId/
    // label/surface were excluded from the generic attrs pass, so slot-specific config props
    // (currently just the header slot's showLogo/showBreadcrumb/showActions) leaked as flat,
    // unrecognized DOM attributes on `DesignerSlotPreview`'s wrapper `<div>` (via its
    // `...domProps` spread) instead of reaching `slotProps`, the only prop
    // `DesignerSlotPreview`'s shell-chrome branches actually read. Matches
    // `canvasNodes.tsx`'s `slotProps={node.props}` exactly (a literal snapshot of the node's
    // props at export time — these are simple config toggles, not expected to carry a Property
    // Binding).
    // Bug found (parity audit item 86): logo (`logoSrc`/`logoAlt`/`logoHref`) and nav-region
    // (`navigationRef`) config keys were still missing from excludeKeys, so they double-emitted
    // as flat attributes in addition to the correct `slotProps` object.
    const excludeKeys = new Set([
      'slotId',
      'label',
      'surface',
      'showLogo',
      'showBreadcrumb',
      'showActions',
      SHELL_LOGO_SRC_PROP,
      SHELL_LOGO_ALT_PROP,
      SHELL_LOGO_HREF_PROP,
      SHELL_NAV_SLOT_NAVIGATION_REF_PROP,
    ]);
    const attrs = renderAttrs(node, bindingContext, excludeKeys);
    const slotId = readString(node.props.slotId);
    const label = readString(node.props.label);
    const surface = readString(node.props.surface);
    const slotPropsLiteral = JSON.stringify(node.props);
    return `<${PLATFORM_SLOT_REACT_TAG}${attrs} slotId=${toJsxAttr(slotId)} label=${toJsxAttr(label)} surface=${toJsxAttr(surface)} slotProps={${slotPropsLiteral}} />`;
  }

  if (paletteItemId === 'platform-navigation.command-palette') {
    const excludeKeys = new Set(['hotkey', 'searchScopes', 'recentItemsCount', 'items', '_chromeDescription']);
    const attrs = renderAttrs(node, bindingContext, excludeKeys);
    return `<DesignerCommandPalette${attrs}${literalOrBoundSkip(node, bindingContext, 'hotkey', readString(node.props.hotkey, 'mod+k'))}${literalOrBoundSkip(node, bindingContext, 'searchScopes', readString(node.props.searchScopes, 'pages,records,actions'))}${` recentItemsCount={${readNumber(node.props.recentItemsCount, 5)}}`}${literalOrBoundSkip(node, bindingContext, 'items', readString(node.props.items))} />`;
  }

  if (paletteItemId === 'platform-navigation.notification-bell') {
    const excludeKeys = new Set(['unreadCount', 'maxItemsShown', 'items', '_chromeDescription']);
    const attrs = renderAttrs(node, bindingContext, excludeKeys);
    const unread = readNumber(node.props.unreadCount, Number.NaN);
    const unreadAttr = Number.isFinite(unread) ? ` unreadCount={${unread}}` : '';
    return `<DesignerNotificationBell${attrs}${unreadAttr}${` maxItemsShown={${readNumber(node.props.maxItemsShown, 5)}}`}${literalOrBoundSkip(node, bindingContext, 'items', readString(node.props.items))} />`;
  }

  if (paletteItemId === 'platform-navigation.user-menu') {
    const excludeKeys = new Set(['displayName', 'avatarUrl', 'menuItems', '_chromeDescription']);
    const attrs = renderAttrs(node, bindingContext, excludeKeys);
    return `<DesignerUserMenu${attrs}${literalOrBoundSkip(node, bindingContext, 'displayName', readString(node.props.displayName, 'User'))}${literalOrBoundSkip(node, bindingContext, 'avatarUrl', readString(node.props.avatarUrl))}${literalOrBoundSkip(node, bindingContext, 'menuItems', readString(node.props.menuItems))} />`;
  }

  if (paletteItemId === 'heroui.chat-widget') {
    const excludeKeys = new Set(['channelRef', 'messagesDataSource', 'showTypingIndicator', 'messages', 'liveUrl', 'liveType']);
    const attrs = renderAttrs(node, bindingContext, excludeKeys);
    return `<DesignerChatWidget${attrs}${literalOrBoundSkip(node, bindingContext, 'channelRef', readString(node.props.channelRef, 'support'))}${literalOrBoundSkip(node, bindingContext, 'messagesDataSource', readString(node.props.messagesDataSource))}${literalOrBoundSkip(node, bindingContext, 'messages', readString(node.props.messages))}${` showTypingIndicator={${readBoolean(node.props.showTypingIndicator)}}`} />`;
  }

  return null;
};

export const resolvePlatformImportSource = (paletteItemId: string): string | null => {
  if (isPlatformNavPaletteItemId(paletteItemId)) return PLATFORM_NAV_IMPORT_SOURCE;
  if (isSlotPaletteItemId(paletteItemId)) return PLATFORM_SLOT_IMPORT_SOURCE;
  if (isPlatformChromePaletteItemId(paletteItemId) || paletteItemId === 'heroui.chat-widget') {
    return PLATFORM_CHROME_IMPORT_SOURCE;
  }
  return null;
};

export const resolvePlatformImportSymbol = (paletteItemId: string): string | null => {
  if (isPlatformNavPaletteItemId(paletteItemId)) return PLATFORM_NAV_REACT_TAG;
  if (isSlotPaletteItemId(paletteItemId)) return PLATFORM_SLOT_REACT_TAG;
  if (paletteItemId === 'platform-navigation.command-palette') return 'DesignerCommandPalette';
  if (paletteItemId === 'platform-navigation.notification-bell') return 'DesignerNotificationBell';
  if (paletteItemId === 'platform-navigation.user-menu') return 'DesignerUserMenu';
  if (paletteItemId === 'heroui.chat-widget') return 'DesignerChatWidget';
  return null;
};

export const isPlatformPaletteItemId = (paletteItemId: string | null | undefined): boolean =>
  typeof paletteItemId === 'string'
  && (
    isPlatformNavPaletteItemId(paletteItemId)
    || isSlotPaletteItemId(paletteItemId)
    || isPlatformChromePaletteItemId(paletteItemId)
  );
