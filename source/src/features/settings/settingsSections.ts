import type { SectionId } from './types';
import {
  DATA_MODEL_SETTINGS_SECTIONS,
  NODE_SETTINGS_SECTIONS,
  PLATFORM_SETTINGS_SECTIONS,
} from '../../shared/api/contracts/settings/scopes';

export type SettingsNavEntry = {
  id: SectionId;
  label: string;
  scope: 'platform' | 'node' | 'data-model';
  description?: string;
};

const PLATFORM_NAV_SECTIONS: SettingsNavEntry[] = PLATFORM_SETTINGS_SECTIONS.map((section) => ({
  id: section.id as SectionId,
  label: section.label,
  scope: 'platform' as const,
  description: section.description,
}));

const NODE_NAV_SECTIONS: SettingsNavEntry[] = NODE_SETTINGS_SECTIONS.map((section) => ({
  id: section.id as SectionId,
  label: section.label,
  scope: 'node' as const,
  description: section.description,
}));

const DATA_MODEL_NAV_SECTIONS: SettingsNavEntry[] = DATA_MODEL_SETTINGS_SECTIONS.map((section) => ({
  id: section.id as SectionId,
  label: section.label,
  scope: 'data-model' as const,
  description: section.description,
}));

/** Platform-wide nav: shared settings plus data-model sections (same control-plane DB). */
const PLATFORM_WIDE_NAV_SECTIONS: SettingsNavEntry[] = [
  ...PLATFORM_NAV_SECTIONS,
  ...DATA_MODEL_NAV_SECTIONS,
];

/** Sidebar/mobile settings nav — Platform Transfer sits last under This node, not in Platform-wide. */
export const SETTINGS_SIDEBAR_PLATFORM_SECTIONS: SettingsNavEntry[] = PLATFORM_WIDE_NAV_SECTIONS.filter(
  (section) => section.id !== 'platform-transfer',
);

export const SETTINGS_SIDEBAR_NODE_SECTIONS: SettingsNavEntry[] = [
  ...NODE_NAV_SECTIONS,
  ...PLATFORM_NAV_SECTIONS.filter((section) => section.id === 'platform-transfer'),
];

/** Visual separators inside the Platform-wide nav group. */
export const PLATFORM_WIDE_NAV_SEPARATORS: SectionId[] = ['auth', 'ai-models', 'session-context', 'profile-fields', 'cultures'];

/** Visual separators inside the This-node nav group. */
export const NODE_NAV_SEPARATORS: SectionId[] = ['platform-transfer'];

/** Flat list for route validation and legacy lookups. */
export const SETTINGS_SECTIONS: SettingsNavEntry[] = [
  ...PLATFORM_WIDE_NAV_SECTIONS,
  ...NODE_NAV_SECTIONS,
];

function isNodeSettingsSection(id: SectionId): boolean {
  return id === 'node-identity' || id === 'node-runtime';
}

/** Sections that persist via inline controls — hide the workspace footer Save/Apply bar. */
export function hasDedicatedSettingsSave(id: SectionId): boolean {
  return id === 'ai-models'
    || id === 'eua-assist'
    || id === 'jwt-secrets'
    || id === 'web-fonts'
    || id === 'feedback'
    || id === 'route-loading'
    || id === 'platform-transfer'
    || isNodeSettingsSection(id);
}

/** Header Save is hidden; a dirty-only sticky bar at the form foot owns Save. */
export function usesStickyDirtySaveBar(id: SectionId): boolean {
  return id === 'logs';
}
