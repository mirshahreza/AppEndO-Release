import { HttpError } from '../errors/HttpError';
import type { ActorContext } from '../types/requestContext';
import {
  readAppSettingsSnapshot,
  saveAppSettings,
} from './settings/appSettings.service';

export type SettingsServiceDeps = {
  settingsPath: string;
};

export class SettingsService {
  constructor(private readonly deps: SettingsServiceDeps) {}

  read() {
    return readAppSettingsSnapshot();
  }

  async merge(payload: Record<string, unknown>, actor: ActorContext | null = null) {
    const saved = await saveAppSettings(actor, payload);
    return { body: { success: true as const, ...saved } };
  }

  readSafe() {
    try {
      return { body: this.read() };
    } catch {
      throw new HttpError(500, 'Failed to read application settings.');
    }
  }

  async writeSafe(payload: Record<string, unknown>, actor: ActorContext | null = null) {
    try {
      return await this.merge(payload, actor);
    } catch {
      throw new HttpError(500, 'Failed to save application settings.');
    }
  }
}
