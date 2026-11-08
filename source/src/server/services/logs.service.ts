import { logger } from '../../core/logging/Logger';
import {
  clearAppLogs,
  findAppLogById,
  listAppLogsFiltered,
} from '../domain/logs/appLogRepository';
import { HttpError } from '../errors/HttpError';
import type { ActorContext, RequestDbContext } from '../types/requestContext';
import { parseLogLevel } from '../utils/httpLogging';
import { saveAppLoggingMethodConfigs } from './settings/appSettings.service';
import { parseLogsListQuery } from '../../shared/api/contracts/logs/listQuery';
import { mergeDescendingPage } from '../../shared/lib/mergeArchivePage';

export type LogsServiceDeps = {
  settingsPath: string;
};

export class LogsService {
  constructor(private readonly deps: LogsServiceDeps) {}

  async list(_ctx: RequestDbContext, rawQuery: Record<string, unknown>) {
    const query = parseLogsListQuery(rawQuery);
    if (query.level && !Array.isArray(query.level)) {
      const parsedLevel = parseLogLevel(query.level);
      if (!parsedLevel) {
        throw new HttpError(400, 'Invalid log level filter.');
      }
      query.level = parsedLevel;
    }

    const offset = query.offset ?? 0;
    const limit = query.limit || 200;
    let archiveUnavailable = false;
    if (query.includeArchived) {
      const windowQuery = { ...query, offset: 0, limit: offset + limit };
      const hot = await listAppLogsFiltered(windowQuery);
      const { listArchivedAppLogs } = await import('../domain/retention/archiveLookup');
      const archived = await listArchivedAppLogs(windowQuery);
      archiveUnavailable = archived.unavailable;
      if (!archived.unavailable) {
        const page = mergeDescendingPage(
          hot.items,
          archived.items,
          offset,
          limit,
          (left, right) => String(right.timestamp).localeCompare(String(left.timestamp)),
          hot.totalCount,
          archived.totalCount,
        );
        return {
          body: {
            success: true as const,
            items: page.items,
            totalCount: page.totalCount,
            archiveUnavailable,
          },
        };
      }
      return {
        body: {
          success: true as const,
          items: hot.items.slice(offset, offset + limit),
          totalCount: hot.totalCount,
          archiveUnavailable,
        },
      };
    }

    const hot = await listAppLogsFiltered(query);
    return {
      body: {
        success: true as const,
        items: hot.items,
        totalCount: hot.totalCount,
        archiveUnavailable,
      },
    };
  }

  async getById(_ctx: RequestDbContext, rawId: string) {
    const id = Number(rawId);
    if (!Number.isFinite(id)) {
      throw new HttpError(400, 'Invalid log id.');
    }

    const item = await findAppLogById(id);

    if (!item) {
      const { findArchivedAppLogById } = await import('../domain/retention/archiveLookup');
      const archived = await findArchivedAppLogById(id);
      if (!archived) {
        throw new HttpError(404, 'Log entry not found.');
      }
      let meta: unknown = null;
      if (archived.hasMeta && archived.metaJson) {
        try {
          meta = JSON.parse(archived.metaJson);
        } catch {
          meta = archived.metaJson;
        }
      }
      return {
        body: {
          success: true as const,
          item: {
            id: archived.id,
            timestamp: archived.timestamp,
            actor: archived.actor,
            callSuccess: archived.callSuccess,
            failureReason: archived.failureReason,
            durationMs: archived.durationMs,
            level: archived.level,
            context: archived.context,
            message: archived.message,
            meta,
          },
        },
      };
    }

    const hasMetaValue = item.hasMeta ?? item.hasmeta;
    const metaJsonValue = item.metaJson ?? item.metajson;

    let meta: unknown = null;
    if (hasMetaValue && metaJsonValue) {
      try {
        meta = JSON.parse(metaJsonValue);
      } catch {
        meta = metaJsonValue;
      }
    }

    return {
      body: {
        success: true as const,
        item: {
          id: item.id,
          timestamp: item.timestamp,
          actor: item.actor,
          callSuccess: item.callSuccess,
          failureReason: item.failureReason,
          durationMs: item.durationMs,
          level: item.level,
          context: item.context,
          message: item.message,
          meta,
        },
      },
    };
  }

  async clearAll(_ctx: RequestDbContext) {
    await clearAppLogs();
    logger.clearRecentLogs();
    return { body: { success: true as const } };
  }

  getMethodConfigs() {
    return { body: { success: true as const, items: logger.getMethodConfigs() } };
  }

  async saveMethodConfigs(actor: ActorContext | null, methodConfigs: unknown) {
    const items = await saveAppLoggingMethodConfigs(actor, methodConfigs);
    return { body: { success: true as const, items } };
  }
}
