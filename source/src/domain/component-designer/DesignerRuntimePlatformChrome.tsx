import * as React from 'react';
import { Bell, Command, LogOut, Search, Settings, User } from 'lucide-react';
import { useLiveDataSource } from './liveDataSource';
import { readBoolean, readNumber, readString } from './runtimeShared';
import type { DesignerNode } from './types';

type StyleProps = {
  className?: string;
  style?: React.CSSProperties;
};

const parseJsonArray = <T,>(raw: unknown, fallback: T[]): T[] => {
  if (Array.isArray(raw)) {
    return raw as T[];
  }
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
};

const parseCsv = (raw: unknown, fallback: string[]): string[] => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return fallback;
  }
  return raw.split(',').map((part) => part.trim()).filter(Boolean);
};

type CommandItem = { id: string; label: string; scope?: string };
type NotificationItem = { id: string; title: string; body?: string; unread?: boolean };
type MenuItem = { id: string; label: string };

export const DesignerCommandPalette: React.FC<{
  hotkey?: string;
  searchScopes?: string;
  recentItemsCount?: number;
  items?: string | CommandItem[];
} & StyleProps> = ({
  hotkey = 'mod+k',
  searchScopes = 'pages,records,actions',
  recentItemsCount = 5,
  items,
  className,
  style,
}) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const scopes = parseCsv(searchScopes, ['pages', 'records', 'actions']);
  const allItems = parseJsonArray<CommandItem>(items, []);
  const filtered = allItems
    .filter((item) => !item.scope || scopes.includes(item.scope))
    .filter((item) => {
      if (!query.trim()) return true;
      return item.label.toLowerCase().includes(query.trim().toLowerCase());
    })
    .slice(0, Math.max(1, recentItemsCount));

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const wantsMeta = hotkey.toLowerCase().includes('mod') || hotkey.toLowerCase().includes('cmd') || hotkey.toLowerCase().includes('ctrl');
      const key = hotkey.split('+').pop()?.toLowerCase() || 'k';
      if (wantsMeta && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === key) {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hotkey]);

  return (
    <div
      className={className}
      style={style}
      data-designer-component="platform-navigation.command-palette"
      data-hotkey={hotkey}
    >
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm"
        data-testid="command-palette-trigger"
        onClick={() => setOpen(true)}
      >
        <Command className="h-3.5 w-3.5" />
        <span>Search…</span>
        <kbd className="ms-2 rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] text-slate-500">
          {hotkey.replace('mod', '⌘/Ctrl')}
        </kbd>
      </button>
      {open ? (
        <div
          className="mt-2 w-full max-w-md rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
          data-testid="command-palette-panel"
          role="dialog"
          aria-label="Command palette"
        >
          <label className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              className="w-full border-0 bg-transparent text-sm outline-none"
              placeholder="Jump to page, record, or action…"
              value={query}
              data-testid="command-palette-input"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <ul className="mt-2 max-h-48 overflow-auto">
            {filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-100"
                  onClick={() => setOpen(false)}
                >
                  <span>{item.label}</span>
                  {item.scope ? <span className="text-[10px] uppercase text-slate-400">{item.scope}</span> : null}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-2 py-3 text-center text-xs text-slate-500">No matches</li>
            ) : null}
          </ul>
          <button
            type="button"
            className="mt-1 w-full rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
};

export const DesignerNotificationBell: React.FC<{
  unreadCount?: number;
  maxItemsShown?: number;
  items?: string | NotificationItem[];
} & StyleProps> = ({
  unreadCount,
  maxItemsShown = 5,
  items,
  className,
  style,
}) => {
  const [open, setOpen] = React.useState(false);
  const notifications = parseJsonArray<NotificationItem>(items, []);
  const derivedUnread = typeof unreadCount === 'number' && Number.isFinite(unreadCount)
    ? unreadCount
    : notifications.filter((item) => item.unread).length;
  const shown = notifications.slice(0, Math.max(1, maxItemsShown));

  return (
    <div
      className={`relative inline-flex ${className ?? ''}`}
      style={style}
      data-designer-component="platform-navigation.notification-bell"
      data-unread-count={derivedUnread}
    >
      <button
        type="button"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
        data-testid="notification-bell-trigger"
        aria-label="Notifications"
        onClick={() => setOpen((previous) => !previous)}
      >
        <Bell className="h-4 w-4" />
        {derivedUnread > 0 ? (
          <span
            className="absolute -end-0.5 -top-0.5 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white"
            data-testid="notification-unread-badge"
          >
            {derivedUnread > 99 ? '99+' : derivedUnread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className="absolute end-0 top-10 z-20 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
          data-testid="notification-panel"
        >
          <div className="mb-1 flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notifications</p>
            <button type="button" className="text-[10px] text-sky-600" onClick={() => setOpen(false)}>
              Mark all read
            </button>
          </div>
          <ul className="max-h-56 overflow-auto">
            {shown.map((item) => (
              <li
                key={item.id}
                className={`rounded px-2 py-1.5 ${item.unread ? 'bg-sky-50' : ''}`}
              >
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                {item.body ? <p className="text-xs text-slate-500">{item.body}</p> : null}
              </li>
            ))}
            {shown.length === 0 ? (
              <li className="px-2 py-4 text-center text-xs text-slate-500">No notifications</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export const DesignerUserMenu: React.FC<{
  displayName?: string;
  avatarUrl?: string;
  menuItems?: string | MenuItem[];
} & StyleProps> = ({
  displayName = 'User',
  avatarUrl,
  menuItems,
  className,
  style,
}) => {
  const [open, setOpen] = React.useState(false);
  const items = parseJsonArray<MenuItem>(menuItems, [
    { id: 'profile', label: 'Profile' },
    { id: 'settings', label: 'Settings' },
    { id: 'logout', label: 'Logout' },
  ]);
  const initials = displayName.trim().slice(0, 1).toUpperCase() || 'U';

  return (
    <div
      className={`relative inline-flex ${className ?? ''}`}
      style={style}
      data-designer-component="platform-navigation.user-menu"
      data-display-name={displayName}
    >
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pe-3 ps-1 text-sm text-slate-800"
        data-testid="user-menu-trigger"
        onClick={() => setOpen((previous) => !previous)}
      >
        {avatarUrl?.trim() ? (
          <img src={avatarUrl.trim()} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
            {initials}
          </span>
        )}
        <span>{displayName}</span>
      </button>
      {open ? (
        <ul
          className="absolute end-0 top-10 z-20 min-w-[10rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          data-testid="user-menu-panel"
        >
          {items.map((item) => {
            const Icon = item.id === 'logout' ? LogOut : item.id === 'settings' ? Settings : User;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};

type ChatMessage = {
  id?: string;
  author?: string;
  text?: string;
  body?: string;
};

const isChatMessage = (value: unknown): value is ChatMessage =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && ('text' in (value as object) || 'body' in (value as object)));

const normalizeChatMessages = (payload: unknown): ChatMessage[] | null => {
  if (Array.isArray(payload)) {
    return payload.filter(isChatMessage);
  }
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of ['data', 'messages', 'items', 'rows'] as const) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value.filter(isChatMessage);
      }
    }
    if (isChatMessage(payload)) {
      return [payload];
    }
  }
  return null;
};

/**
 * Chat widget with optional live push feed (Phase 55).
 * When `liveUrl` + `liveType` are set, snapshots/appends update the message list in place.
 */
export const DesignerChatWidget: React.FC<{
  channelRef?: string;
  messagesDataSource?: string;
  messages?: string | ChatMessage[];
  liveUrl?: string;
  liveType?: 'sse' | 'websocket';
  showTypingIndicator?: boolean;
} & StyleProps> = ({
  channelRef = 'support',
  messagesDataSource,
  messages,
  liveUrl,
  liveType,
  showTypingIndicator = false,
  className,
  style,
}) => {
  const [liveMessages, setLiveMessages] = React.useState<ChatMessage[]>(() =>
    parseJsonArray<ChatMessage>(messages, []),
  );
  const [draft, setDraft] = React.useState('');

  React.useEffect(() => {
    setLiveMessages(parseJsonArray<ChatMessage>(messages, []));
  }, [messages]);

  useLiveDataSource({
    url: liveUrl ?? '',
    type: liveType ?? 'sse',
    enabled: Boolean(liveUrl?.trim() && liveType),
    onSnapshot: (payload) => {
      const next = normalizeChatMessages(payload);
      if (next) {
        setLiveMessages(next);
      }
    },
    onAppend: (payload) => {
      const incoming = normalizeChatMessages(payload) ?? (isChatMessage(payload) ? [payload] : null);
      if (!incoming) {
        return;
      }
      setLiveMessages((current) => [...current, ...incoming]);
    },
  });

  return (
    <div
      className={`flex min-h-[180px] flex-col rounded-lg border border-indigo-200 bg-white p-3 ${className ?? ''}`}
      style={style}
      data-designer-component="heroui.chat-widget"
      data-channel-ref={channelRef}
      data-live={liveUrl ? 'true' : 'false'}
      data-testid="designer-chat-widget"
    >
      <p className="text-sm font-semibold text-slate-900">Chat · {channelRef}</p>
      {messagesDataSource ? (
        <p className="mt-0.5 text-[10px] text-slate-500">Data source: {messagesDataSource}</p>
      ) : null}
      <ul
        className="mt-2 flex-1 space-y-1.5 overflow-auto rounded-md border border-slate-100 bg-slate-50/80 p-2"
        data-testid="chat-message-list"
      >
        {liveMessages.length === 0 ? (
          <li className="py-4 text-center text-xs text-slate-500">No messages yet</li>
        ) : (
          liveMessages.map((message, index) => (
            <li
              key={message.id ?? `${message.author ?? 'anon'}-${index}`}
              className="rounded-md bg-white px-2 py-1.5 text-xs text-slate-800 shadow-sm"
              data-testid="chat-message"
            >
              {message.author ? (
                <span className="me-1 font-semibold text-indigo-700">{message.author}:</span>
              ) : null}
              {message.text ?? message.body ?? ''}
            </li>
          ))
        )}
        {showTypingIndicator ? (
          <li className="italic text-indigo-600" data-testid="chat-typing-indicator">Someone is typing…</li>
        ) : null}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-sm"
          placeholder="Type a message…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Chat message"
        />
        <button
          type="button"
          className="rounded bg-indigo-600 px-3 py-1 text-sm text-white"
          onClick={() => {
            const text = draft.trim();
            if (!text) {
              return;
            }
            setLiveMessages((current) => [
              ...current,
              { id: `local-${Date.now()}`, author: 'You', text },
            ]);
            setDraft('');
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

/** @deprecated Phase 53 stub name — prefer DesignerChatWidget. */
export const DesignerChatWidgetStub = DesignerChatWidget;

export const resolveCommandPalettePropsFromNode = (node: DesignerNode) => ({
  hotkey: readString(node.props.hotkey, 'mod+k'),
  searchScopes: readString(node.props.searchScopes, 'pages,records,actions'),
  recentItemsCount: readNumber(node.props.recentItemsCount, 5),
  items: typeof node.props.items === 'string' ? node.props.items : undefined,
  className: readString(node.props.className),
});

export const resolveNotificationBellPropsFromNode = (node: DesignerNode) => ({
  unreadCount: readNumber(node.props.unreadCount, Number.NaN),
  maxItemsShown: readNumber(node.props.maxItemsShown, 5),
  items: typeof node.props.items === 'string' ? node.props.items : undefined,
  className: readString(node.props.className),
});

export const resolveUserMenuPropsFromNode = (node: DesignerNode) => ({
  displayName: readString(node.props.displayName, 'User'),
  avatarUrl: readString(node.props.avatarUrl),
  menuItems: typeof node.props.menuItems === 'string' ? node.props.menuItems : undefined,
  className: readString(node.props.className),
});

export const resolveChatWidgetPropsFromNode = (node: DesignerNode) => ({
  channelRef: readString(node.props.channelRef, 'support'),
  messagesDataSource: readString(node.props.messagesDataSource),
  messages: typeof node.props.messages === 'string' ? node.props.messages : undefined,
  showTypingIndicator: readBoolean(node.props.showTypingIndicator),
  className: readString(node.props.className),
});
