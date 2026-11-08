import {
  getWorkspaceSectionNavToneActiveClass,
  getWorkspaceSectionNavToneIconClass,
  type AppSurfaceBoxTone,
} from '../../shared/ui/surfaceClasses';
import type { SectionId } from './types';

/** Concept-matched tone per settings section — reuses AppSurfaceBox palette. */
export const SETTINGS_SECTION_TONE: Record<SectionId, AppSurfaceBoxTone> = {
  'server-functions': 'slate',
  logs: 'amber',
  auth: 'emerald',
  'jwt-secrets': 'emerald',
  'identity-providers': 'indigo',
  cultures: 'cyan',
  'web-fonts': 'violet',
  feedback: 'indigo',
  'route-loading': 'cyan',
  email: 'rose',
  pwa: 'violet',
  cache: 'slate',
  'ai-models': 'violet',
  'eua-assist': 'indigo',
  'mcp-servers': 'amber',
  'platform-transfer': 'cyan',
  'profile-fields': 'indigo',
  'user-attributes': 'emerald',
  'role-attributes': 'rose',
  'session-context': 'cyan',
  'node-identity': 'slate',
  'node-runtime': 'slate',
};

export function getSettingsSectionTone(sectionId: SectionId): AppSurfaceBoxTone {
  return SETTINGS_SECTION_TONE[sectionId];
}

export function getSettingsSectionIconClass(sectionId: SectionId): string {
  return getWorkspaceSectionNavToneIconClass(SETTINGS_SECTION_TONE[sectionId]);
}

export function getSettingsSectionNavActiveClass(sectionId: SectionId): string {
  return getWorkspaceSectionNavToneActiveClass(SETTINGS_SECTION_TONE[sectionId]);
}
