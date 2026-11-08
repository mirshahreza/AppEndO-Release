import { getGitSettingsFromFile, saveGitSettingsToFile } from '../../db/gitSettingsStore';
import { SETTINGS_PATH } from '../../config/settingsFile';
import type { GitAuthSettings } from '../../../shared/api/contracts/git/types';
import { writeGitCredentials } from './gitCredentialStore';

export const persistGitAuthCredentials = async (
  auth: GitAuthSettings,
  _settingsPath: string = SETTINGS_PATH,
): Promise<void> => {
  await writeGitCredentials(auth);
};
