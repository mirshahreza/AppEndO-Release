import * as React from 'react';
import type { DesignerNode } from './types';
import type { RuntimeRenderOptions } from './runtimeTypes';
import { getNodePaletteItemId, readString } from './runtimeShared';
import { isPlatformChromePaletteItemId } from './platformChromePalette';
import {
  DesignerChatWidget,
  DesignerCommandPalette,
  DesignerNotificationBell,
  DesignerUserMenu,
  resolveChatWidgetPropsFromNode,
  resolveCommandPalettePropsFromNode,
  resolveNotificationBellPropsFromNode,
  resolveUserMenuPropsFromNode,
} from './DesignerRuntimePlatformChrome';
import {
  buildLiveStreamUrl,
  isActiveLiveMode,
} from './liveDataSource';
import { normalizeBindingDefinitions } from './bindingRegistry';

const styleFromOptions = (options: RuntimeRenderOptions) => options.style;

/**
 * Resolve session/store-backed display fields for user-menu when preview bindings are present.
 */
const resolveUserMenuDisplay = (node: DesignerNode, options: RuntimeRenderOptions) => {
  const base = resolveUserMenuPropsFromNode(node);
  const previewBindings = options.previewBindings;
  if (!previewBindings?.resolveTextProp) {
    return base;
  }
  return {
    ...base,
    displayName: previewBindings.resolveTextProp(node, 'displayName', base.displayName || 'User'),
    avatarUrl: previewBindings.resolveTextProp(node, 'avatarUrl', base.avatarUrl || ''),
  };
};

export const renderPlatformChromePaletteNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): React.ReactNode | null => {
  const paletteItemId = getNodePaletteItemId(node);
  if (!paletteItemId) {
    return null;
  }

  const style = styleFromOptions(options);
  const className = readString(node.props.className);

  if (paletteItemId === 'heroui.chat-widget') {
    const props = resolveChatWidgetPropsFromNode(node);
    const registry = normalizeBindingDefinitions(options.bindingDefinitions ?? {});
    const dataSourceId = props.messagesDataSource?.trim();
    const dataSource = dataSourceId ? registry.dataSources[dataSourceId] : undefined;
    const liveMode = dataSource?.liveMode;
    const liveUrl = dataSource && isActiveLiveMode(liveMode)
      ? buildLiveStreamUrl(dataSource.endpoint, liveMode)
      : undefined;
    return (
      <DesignerChatWidget
        channelRef={props.channelRef}
        messagesDataSource={props.messagesDataSource}
        messages={props.messages}
        liveUrl={liveUrl}
        liveType={isActiveLiveMode(liveMode) ? liveMode.type : undefined}
        showTypingIndicator={props.showTypingIndicator}
        className={className || props.className}
        style={style}
      />
    );
  }

  if (!isPlatformChromePaletteItemId(paletteItemId)) {
    return null;
  }

  switch (paletteItemId) {
    case 'platform-navigation.command-palette': {
      const props = resolveCommandPalettePropsFromNode(node);
      return (
        <DesignerCommandPalette
          hotkey={props.hotkey}
          searchScopes={props.searchScopes}
          recentItemsCount={props.recentItemsCount}
          items={props.items}
          className={className || props.className}
          style={style}
        />
      );
    }
    case 'platform-navigation.notification-bell': {
      const props = resolveNotificationBellPropsFromNode(node);
      return (
        <DesignerNotificationBell
          unreadCount={Number.isFinite(props.unreadCount) ? props.unreadCount : undefined}
          maxItemsShown={props.maxItemsShown}
          items={props.items}
          className={className || props.className}
          style={style}
        />
      );
    }
    case 'platform-navigation.user-menu': {
      const props = resolveUserMenuDisplay(node, options);
      return (
        <DesignerUserMenu
          displayName={props.displayName}
          avatarUrl={props.avatarUrl}
          menuItems={props.menuItems}
          className={className || props.className}
          style={style}
        />
      );
    }
    default:
      return null;
  }
};
