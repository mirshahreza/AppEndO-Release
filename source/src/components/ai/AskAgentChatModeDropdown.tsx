import React from 'react';
import { ChatModeDropdown } from '../../features/ai-chat';

export type AskAgentChatMode = 'ask' | 'agent';

export type AskAgentChatModeDropdownProps = {
  mode: AskAgentChatMode;
  onChange: (mode: AskAgentChatMode) => void;
  compact?: boolean;
};

const ASK_AGENT_IDS = ['ask', 'agent'] as const;

export const AskAgentChatModeDropdown: React.FC<AskAgentChatModeDropdownProps> = ({
  mode,
  onChange,
  compact = false,
}) => (
  <ChatModeDropdown
    mode={mode}
    onChange={(next) => {
      if (next === 'ask' || next === 'agent') {
        onChange(next);
      }
    }}
    compact={compact}
    allowedIds={ASK_AGENT_IDS}
  />
);
