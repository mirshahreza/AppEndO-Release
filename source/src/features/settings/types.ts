export type { AppSettings } from '../../shared/api/contracts/settings/types';
export type {
  NodeSettingsSectionId,
  SettingsWorkspaceSectionId,
} from '../../shared/api/contracts/settings/scopes';

export type SectionId =
  | import('../../shared/api/contracts/settings/scopes').SettingsWorkspaceSectionId
  | import('../../shared/api/contracts/settings/scopes').NodeSettingsSectionId;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
