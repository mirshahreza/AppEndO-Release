import fs from 'node:fs';
import path from 'node:path';
import type { EuaCapabilityKey } from '../../../shared/api/contracts/ai/euaFieldAssist';

export type EuaUsageLogEntry = {
  timestamp: string;
  userId: string;
  action: string;
  capability?: EuaCapabilityKey;
  modelId?: string;
  formId?: string;
  tokenEstimate?: number;
  surface?: 'admin' | 'published';
  ok: boolean;
  error?: string;
};

const MAX_LOG_BYTES = 2 * 1024 * 1024;

export class EuaUsageLogService {
  constructor(private readonly logPath: string) {}

  append(entry: Omit<EuaUsageLogEntry, 'timestamp'>): void {
    const line = JSON.stringify({
      ...entry,
      timestamp: new Date().toISOString(),
    });

    try {
      const dir = path.dirname(this.logPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.logPath)) {
        const stats = fs.statSync(this.logPath);
        if (stats.size > MAX_LOG_BYTES) {
          const rotated = `${this.logPath}.${Date.now()}.bak`;
          fs.renameSync(this.logPath, rotated);
        }
      }

      fs.appendFileSync(this.logPath, `${line}\n`, 'utf8');
    } catch {
      // Usage logging is best-effort.
    }
  }
}

let sharedLogService: EuaUsageLogService | null = null;

export const getEuaUsageLogService = (dataDir: string): EuaUsageLogService => {
  if (!sharedLogService) {
    sharedLogService = new EuaUsageLogService(path.join(dataDir, 'eua-usage.jsonl'));
  }
  return sharedLogService;
};
