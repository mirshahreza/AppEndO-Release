import { MessageSquare, ScrollText, Wrench } from 'lucide-react';
import type { AgentMode } from '../../../shared/api/contracts/ai/agentTypes';

export const PANEL_CHAT_MODES: Array<{
  id: Extract<AgentMode, 'ask' | 'agent' | 'plan'>;
  label: string;
  description: string;
}> = [
  { id: 'ask', label: 'Ask', description: 'Read-only chat with search and file tools' },
  { id: 'agent', label: 'Agent', description: 'Tools and proposals — engineering changes use the V3 pipeline' },
  { id: 'plan', label: 'Plan', description: 'Design documents in plans/core/todo/, plans/core/next/, and plans/packages/' },
];

export type PanelChatMode = (typeof PANEL_CHAT_MODES)[number]['id'];

export const getPanelChatModeIcon = (mode: PanelChatMode) => {
  if (mode === 'agent') return Wrench;
  if (mode === 'plan') return ScrollText;
  return MessageSquare;
};
