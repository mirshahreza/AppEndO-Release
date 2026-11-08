import React from 'react';
import { Bot, Database, Cpu, ArrowDownUp, Key, KeyRound, Languages, LoaderCircle, Mail, MessageSquare, Network, PlugZap, ScrollText, Server, ShieldCheck, Smartphone, Sparkles, Tags, Terminal, Type, UserCircle, Users } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getSettingsSectionIconClass } from './settingsSectionSemantics';
import type { SectionId } from './types';

const SECTION_ICON_MAP: Record<SectionId, React.ComponentType<{ className?: string }>> = {
  'server-functions': Terminal,
  logs: ScrollText,
  auth: ShieldCheck,
  'jwt-secrets': Key,
  'identity-providers': KeyRound,
  cultures: Languages,
  'web-fonts': Type,
  feedback: MessageSquare,
  'route-loading': LoaderCircle,
  email: Mail,
  pwa: Smartphone,
  cache: Database,
  'ai-models': Bot,
  'eua-assist': Sparkles,
  'mcp-servers': PlugZap,
  'platform-transfer': ArrowDownUp,
  'user-attributes': Users,
  'role-attributes': Tags,
  'session-context': Network,
  'profile-fields': UserCircle,
  'node-identity': Server,
  'node-runtime': Cpu,
};

type SettingsSectionIconProps = {
  sectionId: SectionId;
  className?: string;
};

export const SettingsSectionIcon: React.FC<SettingsSectionIconProps> = ({ sectionId, className }) => {
  const Icon = SECTION_ICON_MAP[sectionId];
  return (
    <Icon
      className={cn('w-4 h-4 shrink-0', getSettingsSectionIconClass(sectionId), className)}
      aria-hidden="true"
    />
  );
};
