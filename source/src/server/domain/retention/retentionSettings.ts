import { getCachedFlatSettings } from '../../services/settings/appSettingsCache';
import {
  parseLogRetentionSettings,
  type LogRetentionSettings,
} from '../../../shared/api/contracts/settings/retention';

export function loadLogRetentionSettings(
  snapshot: Record<string, unknown> = getCachedFlatSettings(),
): LogRetentionSettings {
  return parseLogRetentionSettings(snapshot.logRetention, snapshot.logRetentionDays);
}
