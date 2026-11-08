import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHAT_AGENCY_MODE,
  isUiContextChatAgencyMode,
  resolveChatAgencyMode,
  shouldAutoRunChatCommand,
  UI_CONTEXT_CHAT_AGENCY_MODES,
} from '../chatAgency';

describe('chatAgency', () => {
  it('accepts the three standard modes', () => {
    expect(isUiContextChatAgencyMode('ask')).toBe(true);
    expect(isUiContextChatAgencyMode('read-only')).toBe(true);
    expect(isUiContextChatAgencyMode('agentic')).toBe(true);
    expect(isUiContextChatAgencyMode('read-write')).toBe(false);
    expect(isUiContextChatAgencyMode('auto')).toBe(false);
  });

  it('clamps to the host-allowed set', () => {
    expect(resolveChatAgencyMode('read-only', ['ask', 'agentic'])).toBe('ask');
    expect(resolveChatAgencyMode('agentic', ['ask', 'agentic'])).toBe('agentic');
    expect(resolveChatAgencyMode(undefined)).toBe(DEFAULT_CHAT_AGENCY_MODE);
  });

  it('uses an explicit fallback when the stored value is missing', () => {
    expect(resolveChatAgencyMode(undefined, UI_CONTEXT_CHAT_AGENCY_MODES, 'read-only')).toBe('read-only');
    expect(resolveChatAgencyMode(null, UI_CONTEXT_CHAT_AGENCY_MODES, 'read-only')).toBe('read-only');
    expect(resolveChatAgencyMode('ask', UI_CONTEXT_CHAT_AGENCY_MODES, 'read-only')).toBe('ask');
    expect(resolveChatAgencyMode(undefined, ['ask', 'agentic'], 'read-only')).toBe('ask');
  });

  it('never auto-runs in ask, only reads in read-only, and everything in agentic', () => {
    expect(shouldAutoRunChatCommand('read', 'ask')).toBe(false);
    expect(shouldAutoRunChatCommand('write', 'ask')).toBe(false);
    expect(shouldAutoRunChatCommand('read', 'read-only')).toBe(true);
    expect(shouldAutoRunChatCommand('write', 'read-only')).toBe(false);
    expect(shouldAutoRunChatCommand('write', 'agentic')).toBe(true);
  });
});
