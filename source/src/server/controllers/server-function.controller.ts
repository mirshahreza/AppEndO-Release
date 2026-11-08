import type { Request, Response } from 'express';
import { isHttpError } from '../errors/HttpError';
import { normalizeAuthRoles } from '../middleware/auth.middleware';
import { getSessionContextForUser } from '../services/attributes/sessionContext.service';
import type { EdgeDbQueryFn, ServerFunctionService } from '../services/server-function.service';
import { asyncHandler } from '../utils/asyncHandler';

export class ServerFunctionController {
  constructor(
    private readonly edgeService: ServerFunctionService,
    private readonly edgeDbQuery: EdgeDbQueryFn,
  ) {}

  execute = asyncHandler(async (req: Request, res: Response) => {
    await this.edgeService.execute(req, res, {
      code: req.body?.code,
      timeoutMs: req.body?.timeoutMs,
      memoryLimit: req.body?.memoryLimit ?? req.body?.runRam,
      runtimeVersion: req.body?.runtimeVersion ?? req.body?.vmMode,
      language: req.body?.language,
      useGlobalConfig: req.body?.useGlobalConfig,
      enableLogs: req.body?.enableLogs,
      dbContext: req.body?.dbContext,
      edgeCache: req.body?.edgeCache,
      engineType: req.body?.engineType ?? req.body?.engine_type,
      metadataJson: req.body?.metadataJson ?? req.body?.metadata_json,
      functionId: req.body?.functionId ?? req.body?.function_id,
      actorUserId: req.auth?.userId,
      authRoles: normalizeAuthRoles(req),
      sessionContextLoader: (userId) => getSessionContextForUser(userId, req.auth?.role),
    }, this.edgeDbQuery);
  }, 'Request failed.', {
    onError: (error, _req, res) => {
      if (res.headersSent) {
        return true;
      }
      if (isHttpError(error)) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          ...error.body,
        });
        return true;
      }
      const message = error instanceof Error ? error.message : 'Request failed.';
      res.status(500).json({ success: false, error: message });
      return true;
    },
  });
}
