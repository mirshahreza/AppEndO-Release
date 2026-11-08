/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { UiContextChatPanel } from '../UiContextChatPanel';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 1, email: 'demo@example.com', role: 'admin', roles: ['admin'] } }),
}));

vi.mock('../../../core/culture/CultureContext', () => ({
  useOptionalCultureT: () => (key: string) => key,
}));

const MODELS = [{ id: 'demo-chat', name: 'Demo chat' }];

describe('UiContextChatPanel', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });
  it('sends a managed turn from the split console chrome', async () => {
    const onSend = vi.fn(async () => ({ text: 'pong' }));
    render(
      <div style={{ height: 400 }}>
        <UiContextChatPanel
          welcomeText="Hello console"
          placeholder="Ask…"
          promptAriaLabel="SQL prompt"
          models={MODELS}
          aiEnabled
          panelKey="sql-console.ai-panel"
          onSend={onSend}
        />
      </div>,
    );

    expect(screen.getByText('Hello console').closest('[data-chat-role="assistant"]')).toHaveClass('w-full');
    expect(screen.getByText('Hello console').closest('[data-chat-role="assistant"]')).not.toHaveClass('ml-auto');
    expect(screen.getByRole('button', { name: 'appendoo.panel.newChat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'appendoo.panel.chatHistory' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('SQL prompt'), { target: { value: 'list tables' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send prompt' }));
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'list tables',
      modelId: 'demo-chat',
      agencyMode: 'ask',
    }));
    expect(await screen.findByText('pong')).toBeInTheDocument();
    expect(screen.getAllByText('list tables').some((node) => node.closest('[data-chat-role="user"]'))).toBe(true);
    expect(screen.getByText('pong').closest('[data-chat-role="assistant"]')).toHaveClass('w-full');
  });

  it('restores the latest chat when the panel remounts', async () => {
    const onSend = vi.fn(async () => ({ text: 'saved reply' }));
    const { unmount } = render(
      <div style={{ height: 400 }}>
        <UiContextChatPanel
          welcomeText="Welcome"
          placeholder="Ask…"
          promptAriaLabel="SQL prompt"
          models={MODELS}
          aiEnabled
          panelKey="sql-console.ai-panel"
          sessionHistoryKey="sql-console:test-restore"
          onSend={onSend}
        />
      </div>,
    );

    fireEvent.change(screen.getByLabelText('SQL prompt'), { target: { value: 'remember this' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send prompt' }));
    expect(await screen.findByText('saved reply')).toBeInTheDocument();
    unmount();

    render(
      <div style={{ height: 400 }}>
        <UiContextChatPanel
          welcomeText="Welcome"
          placeholder="Ask…"
          promptAriaLabel="SQL prompt"
          models={MODELS}
          aiEnabled
          panelKey="sql-console.ai-panel"
          sessionHistoryKey="sql-console:test-restore"
          onSend={onSend}
        />
      </div>,
    );

    expect(screen.getAllByText('remember this').some((node) => node.closest('[data-chat-role="user"]'))).toBe(true);
    expect(screen.getByText('saved reply').closest('[data-chat-role="assistant"]')).toBeTruthy();
  });

  it('mounts fill placement with host-owned body, composer slots, and submit', () => {
    const onSubmitPrompt = vi.fn();
    render(
      <div style={{ height: 400 }}>
        <UiContextChatPanel
          placement="fill"
          placeholder="Ask AppEndO…"
          promptAriaLabel="Agent prompt"
          models={MODELS}
          modelId="demo-chat"
          onModelChange={() => undefined}
          aiEnabled
          showModelPicker={false}
          promptValue="patch the form"
          onPromptChange={() => undefined}
          bodySlot={<p>Host message list</p>}
          promptToolbarStart={<span>Ask mode</span>}
          promptComposerStart={<span>Page context</span>}
          onSubmitPrompt={onSubmitPrompt}
        />
      </div>,
    );

    expect(screen.getByText('Host message list')).toBeInTheDocument();
    expect(screen.getByText('Ask mode')).toBeInTheDocument();
    expect(screen.getByText('Page context')).toBeInTheDocument();
    expect(screen.queryByLabelText(/AI model/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'appendoo.panel.newChat' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send prompt' }));
    expect(onSubmitPrompt).toHaveBeenCalledWith({ prompt: 'patch the form', modelId: 'demo-chat' });
  });

  it('lets the host restrict agency and sends the selected mode with the turn', async () => {
    const onSend = vi.fn(async () => ({ text: 'ok' }));
    const onAgencyModeChange = vi.fn();
    render(
      <div style={{ height: 400 }}>
        <UiContextChatPanel
          welcomeText="Hello"
          placeholder="Ask…"
          promptAriaLabel="SQL prompt"
          models={MODELS}
          aiEnabled
          panelKey="sql-console.ai-panel"
          agencyModes={['ask', 'agentic']}
          agencyMode="ask"
          onAgencyModeChange={onAgencyModeChange}
          onSend={onSend}
        />
      </div>,
    );

    expect(screen.getByRole('radiogroup', { name: 'Chat agency' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Ask' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Agentic' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Read only' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Agentic' }));
    expect(onAgencyModeChange).toHaveBeenCalledWith('agentic');
  });

  it('places agency next to the model as a dropdown when the host asks', () => {
    const onAgencyModeChange = vi.fn();
    render(
      <div style={{ height: 400 }}>
        <UiContextChatPanel
          welcomeText="Hello"
          placeholder="Ask…"
          promptAriaLabel="SQL prompt"
          models={MODELS}
          aiEnabled
          panelKey="sql-console.ai-panel"
          agencyModes={['ask', 'read-only', 'agentic']}
          agencyMode="ask"
          agencyPickerVariant="dropdown"
          onAgencyModeChange={onAgencyModeChange}
          onSend={async () => ({ text: 'ok' })}
        />
      </div>,
    );

    expect(screen.queryByRole('radiogroup', { name: 'Chat agency' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat agency: Ask' })).toHaveClass('text-rose-600');
    fireEvent.click(screen.getByRole('button', { name: 'Chat agency: Ask' }));
    fireEvent.click(screen.getByRole('option', { name: 'Read only' }));
    expect(onAgencyModeChange).toHaveBeenCalledWith('read-only');
  });

  it('hides the composer when showComposer is false', () => {
    render(
      <UiContextChatPanel
        placement="fill"
        placeholder="Ask…"
        promptAriaLabel="Agent prompt"
        models={MODELS}
        aiEnabled
        showComposer={false}
        bodySlot={<p>Host message list</p>}
        onSubmitPrompt={() => undefined}
      />,
    );

    expect(screen.getByText('Host message list')).toBeInTheDocument();
    expect(screen.queryByLabelText('Agent prompt')).not.toBeInTheDocument();
  });

  it('renders a full handler dump as a collapsed changed-line diff', async () => {
    const before = [
      'async function handler(): Promise<void> {',
      '  edgeRes.status(400).json({ error: "a" });',
      '}',
      '(async () => { await handler(); })();',
    ].join('\n');
    const after = [
      'async function handler(): Promise<void> {',
      '  const a = 1;',
      '  const b = 2;',
      '  const c = 3;',
      '  const d = 4;',
      '  const e = 5;',
      '  const f = 6;',
      '  edgeRes.json({ ok: true });',
      '}',
      '(async () => { await handler(); })();',
    ].join('\n');
    const onSend = vi.fn(async () => ({
      text: `Here is the patch.\n\n\`\`\`typescript\n${after}\n\`\`\``,
    }));

    render(
      <div style={{ height: 400 }}>
        <UiContextChatPanel
          welcomeText="Hello console"
          placeholder="Ask…"
          promptAriaLabel="SQL prompt"
          models={MODELS}
          aiEnabled
          panelKey="sql-console.ai-panel"
          codeDiffBaseline={before}
          onSend={onSend}
        />
      </div>,
    );

    fireEvent.change(screen.getByLabelText('SQL prompt'), { target: { value: 'fix it' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send prompt' }));

    expect(await screen.findByText('Diff')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show \d+ more lines/ })).toBeInTheDocument();
    expect(screen.queryByText('async function handler(): Promise<void> {')).not.toBeInTheDocument();
  });
});
