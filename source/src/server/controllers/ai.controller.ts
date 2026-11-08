import type { Request, Response } from 'express';
import type { AiProviderKind } from '../../shared/api/contracts/ai/types';
import { AiValidationError } from '../../shared/api/contracts/ai/validators';
import { isHttpError, HttpError } from '../errors/HttpError';
import { AiService } from '../services/ai.service';
import { AgentService } from '../services/ai/agent.service';
import type { AiSettingsService } from '../services/ai/aiSettings.service';
import { ImageEditorAiService } from '../services/ai/imageEditorAi.service';
import { SshHubAiService } from '../services/ai/sshHubAi.service';
import { FileHubAiService } from '../services/ai/fileHubAi.service';
import { SqlConsoleAiService } from '../services/ai/sqlConsoleAi.service';
import { WorkflowDesignerAiService } from '../services/ai/workflowDesignerAi.service';
import { ServerFunctionAiService } from '../services/ai/serverFunctionAi.service';
import { ClientComponentAiService } from '../services/ai/clientComponentAi.service';
import { AiChatHistoryService } from '../services/ai/chatHistory.service';
import { AgentTraceService } from '../services/ai/agentTrace.service';
import { mcpAccessService } from '../services/ai/mcpAccess.service';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../../core/logging/Logger';
import { hasAdminRole } from '../middleware/auth.middleware';
import { toActorContext } from '../utils/requestContext';
import { toFunctionDocAccessPrincipal } from '../utils/functionDocAccess';
import { parseChatSessionListQuery } from '../../shared/api/contracts/ai/chatHistoryListQuery';
import { getLocalEmbeddingsModelStatus as readLocalEmbeddingsModelStatus } from '../../core/ai/providers/localEmbeddingsModelLifecycle';
import { getWorkspaceEmbeddingsIndexStatus as readWorkspaceEmbeddingsIndexStatus } from '../../core/ai/tools/native/workspaceEmbeddingsIndex';

export class AiController {
  constructor(
    private readonly aiService = new AiService(),
    private readonly aiSettingsService?: AiSettingsService,
    private readonly imageEditorAiService = new ImageEditorAiService(),
    private readonly sshHubAiService = new SshHubAiService(),
    private readonly fileHubAiService = new FileHubAiService(),
    private readonly sqlConsoleAiService?: SqlConsoleAiService,
    private readonly workflowDesignerAiService = new WorkflowDesignerAiService(),
    private readonly chatHistoryService = new AiChatHistoryService(),
    private readonly agentService = new AgentService(),
    private readonly agentTraceService = new AgentTraceService(),
    private readonly serverFunctionAiService = new ServerFunctionAiService(),
    private readonly clientComponentAiService = new ClientComponentAiService(),
  ) {}

  chat = asyncHandler(async (req: Request, res: Response) => {
    const { messages, modelId, pageContext, contextResources } = req.body || {};
    const result = await this.aiService.chat(messages, modelId, pageContext, contextResources);
    res.json(result.body);
  }, 'Failed to process AI chat.', {
    onError: (error, _req, res) => {
      logger.error('AIAPI', 'Chat request failed', { error });
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ error: error.message });
        return true;
      }
      const message = error instanceof Error ? error.message : 'Failed to process AI chat.';
      const status = /not configured|disabled|not found/i.test(message) ? 503 : 500;
      res.status(status).json({ error: message });
      return true;
    },
  });

  imageEdit = asyncHandler(async (req: Request, res: Response) => {
    const { prompt, imageDataUrl, modelId, history } = req.body || {};
    const result = await this.imageEditorAiService.edit({ prompt, imageDataUrl, modelId, history });
    res.json({ success: true, ...result.body });
  }, 'Failed to process AI image edit.', {
    onError: (error, _req, res) => {
      logger.error('AIAPI', 'Image edit request failed', { error });
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return true;
      }
      const message = error instanceof Error ? error.message : 'Failed to process AI image edit.';
      const status = /not configured|disabled|not found/i.test(message) ? 503 : 500;
      res.status(status).json({ success: false, error: message });
      return true;
    },
  });

  sshAssist = asyncHandler(async (req: Request, res: Response) => {
    const { prompt, terminalSnapshot, modelId, history } = req.body || {};
    const result = await this.sshHubAiService.assist({ prompt, terminalSnapshot, modelId, history });
    res.json({ success: true, ...result.body });
  }, 'Failed to process SSH AI assist.', {
    onError: (error, _req, res) => {
      logger.error('AIAPI', 'SSH assist request failed', { error });
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return true;
      }
      const message = error instanceof Error ? error.message : 'Failed to process SSH AI assist.';
      const status = /not configured|disabled|not found/i.test(message) ? 503 : 500;
      res.status(status).json({ success: false, error: message });
      return true;
    },
  });

  fileHubAssist = asyncHandler(async (req: Request, res: Response) => {
    const { prompt, listingSnapshot, modelId, history } = req.body || {};
    const result = await this.fileHubAiService.assist({ prompt, listingSnapshot, modelId, history });
    res.json({ success: true, ...result.body });
  }, 'Failed to process File Hub AI assist.', {
    onError: (error, _req, res) => {
      logger.error('AIAPI', 'File Hub assist request failed', { error });
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return true;
      }
      const message = error instanceof Error ? error.message : 'Failed to process File Hub AI assist.';
      const status = /not configured|disabled|not found/i.test(message) ? 503 : 500;
      res.status(status).json({ success: false, error: message });
      return true;
    },
  });

  sqlConsoleAssist = asyncHandler(async (req: Request, res: Response) => {
    const { prompt, dataSourceId, sqlSnapshot, previousResultPreview, allowWrite, modelId, history } = req.body || {};
    if (!this.sqlConsoleAiService) {
      throw new HttpError(500, 'SQL Console AI assist is not configured.');
    }
    const result = await this.sqlConsoleAiService.assist({ prompt, dataSourceId, sqlSnapshot, previousResultPreview, allowWrite, modelId, history });
    res.json({ success: true, ...result.body });
  }, 'Failed to process SQL Console AI assist.', {
    onError: (error, _req, res) => {
      logger.error('AIAPI', 'SQL Console assist request failed', { error });
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return true;
      }
      const message = error instanceof Error ? error.message : 'Failed to process SQL Console AI assist.';
      const status = /not configured|disabled|not found/i.test(message) ? 503 : 500;
      res.status(status).json({ success: false, error: message });
      return true;
    },
  });

  workflowDesignerAssist = asyncHandler(async (req: Request, res: Response) => {
    const { prompt, workflowSnapshot, modelId, history } = req.body || {};
    const result = await this.workflowDesignerAiService.assist({ prompt, workflowSnapshot, modelId, history });
    res.json({ success: true, ...result.body });
  }, 'Failed to process Workflow Designer AI assist.', {
    onError: (error, _req, res) => {
      logger.error('AIAPI', 'Workflow Designer assist request failed', { error });
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return true;
      }
      const message = error instanceof Error ? error.message : 'Failed to process Workflow Designer AI assist.';
      const status = /not configured|disabled|not found/i.test(message) ? 503 : 500;
      res.status(status).json({ success: false, error: message });
      return true;
    },
  });

  serverFunctionAssist = asyncHandler(async (req: Request, res: Response) => {
    const { prompt, functionSnapshot, modelId, history } = req.body || {};
    const result = await this.serverFunctionAiService.assist({ prompt, functionSnapshot, modelId, history });
    res.json({ success: true, ...result.body });
  }, 'Failed to process Server Function AI assist.', {
    onError: (error, _req, res) => {
      logger.error('AIAPI', 'Server Function assist request failed', { error });
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return true;
      }
      const message = error instanceof Error ? error.message : 'Failed to process Server Function AI assist.';
      const status = /not configured|disabled|not found/i.test(message) ? 503 : 500;
      res.status(status).json({ success: false, error: message });
      return true;
    },
  });

  clientComponentAssist = asyncHandler(async (req: Request, res: Response) => {
    const { prompt, layoutSnapshot, modelId, history } = req.body || {};
    const result = await this.clientComponentAiService.assist({ prompt, layoutSnapshot, modelId, history });
    res.json({ success: true, ...result.body });
  }, 'Failed to process Client Component AI assist.', {
    onError: (error, _req, res) => {
      logger.error('AIAPI', 'Client Component assist request failed', { error });
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return true;
      }
      const message = error instanceof Error ? error.message : 'Failed to process Client Component AI assist.';
      const status = /not configured|disabled|not found/i.test(message) ? 503 : 500;
      res.status(status).json({ success: false, error: message });
      return true;
    },
  });

  chatStream = async (req: Request, res: Response) => {
    const { messages, modelId, pageContext, contextResources } = req.body || {};

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const writeEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const result = await this.aiService.chatStream(messages, modelId, (delta) => {
        writeEvent({ type: 'delta', text: delta });
      }, pageContext, contextResources);
      writeEvent({
        type: 'done',
        text: result.body.text,
        modelId: result.body.modelId,
        streamed: result.body.streamed,
      });
      res.end();
    } catch (error) {
      logger.error('AIAPI', 'Chat stream failed', { error });
      const message = error instanceof HttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Failed to process AI chat stream.';
      const status = error instanceof HttpError
        ? error.statusCode
        : /not configured|disabled|not found/i.test(message)
          ? 503
          : 500;
      if (!res.headersSent) {
        res.status(status).json({ error: message });
        return;
      }
      writeEvent({ type: 'error', error: message });
      res.end();
    }
  };

  agentRun = async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const writeEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const actor = toActorContext(req, hasAdminRole(req));
      await this.agentService.runStream(req.body || {}, actor.userId, (event) => {
        writeEvent(event as Record<string, unknown>);
      }, {
        docAccessPrincipal: toFunctionDocAccessPrincipal(req),
      });
      res.end();
    } catch (error) {
      // Error.message is non-enumerable — logging `{ error }` alone serialized HttpErrors as
      // `{name, statusCode, body:{}}` with the actual reason invisible in app.log.
      logger.error('AIAPI', 'Agent run failed', {
        error,
        message: error instanceof Error ? error.message : String(error),
      });
      const message = error instanceof HttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Failed to process agent run.';
      const status = error instanceof HttpError
        ? error.statusCode
        : /not configured|disabled|not found/i.test(message)
          ? 503
          : 500;
      if (!res.headersSent) {
        res.status(status).json({ error: message });
        return;
      }
      writeEvent({ type: 'error', error: message });
      res.end();
    }
  };

  getAgentTraces = asyncHandler(async (req: Request, res: Response) => {
    const sessionId = Number(req.params.sessionId || 0);
    const result = await this.agentTraceService.listSessionTraces(
      toActorContext(req, hasAdminRole(req)),
      sessionId,
    );
    res.json(result.body);
  }, 'Failed to load agent traces.');

  agentApply = asyncHandler(async (req: Request, res: Response) => {
    const actor = toActorContext(req, hasAdminRole(req));
    const result = await this.agentService.apply(req.body || {}, actor.userId);
    res.json(result.body);
  }, 'Failed to apply agent proposal.', {
    onError: (error, _req, res) => {
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ error: error.message });
        return true;
      }
      return false;
    },
  });

  agentRollback = asyncHandler(async (req: Request, res: Response) => {
    const actor = toActorContext(req, hasAdminRole(req));
    const result = await this.agentService.rollback(req.body || {}, actor.userId);
    res.json(result.body);
  }, 'Failed to rollback agent apply.', {
    onError: (error, _req, res) => {
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ error: error.message });
        return true;
      }
      return false;
    },
  });

  agentProposalFeedback = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.agentService.recordProposalFeedback(req.body || {});
    res.json(result.body);
  }, 'Failed to record proposal feedback.', {
    onError: (error, _req, res) => {
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ error: error.message });
        return true;
      }
      return false;
    },
  });

  agentChatLatency = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.agentService.recordChatPerceivedLatency(req.body || {});
    res.json(result.body);
  }, 'Failed to record chat perceived latency.', {
    onError: (error, _req, res) => {
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ error: error.message });
        return true;
      }
      return false;
    },
  });

  agentPlanApproval = asyncHandler(async (req: Request, res: Response) => {
    const actor = toActorContext(req, hasAdminRole(req));
    const result = await this.agentService.approveSemanticPlan(req.body || {}, actor.userId);
    res.json(result.body);
  }, 'Failed to approve semantic plan.', {
    onError: (error, _req, res) => {
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ error: error.message });
        return true;
      }
      return false;
    },
  });

  agentPlanRepairExecute = asyncHandler(async (req: Request, res: Response) => {
    const actor = toActorContext(req, hasAdminRole(req));
    const result = await this.agentService.executeRepairRevision(req.body || {}, actor.userId);
    res.json(result.body);
  }, 'Failed to execute repair revision.', {
    onError: (error, _req, res) => {
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ error: error.message });
        return true;
      }
      return false;
    },
  });

  getLatestAgentApply = asyncHandler(async (req: Request, res: Response) => {
    const actor = toActorContext(req, hasAdminRole(req));
    const rawSessionId = req.query.sessionId;
    const sessionId = rawSessionId !== undefined && rawSessionId !== ''
      ? Number(rawSessionId)
      : undefined;

    if (sessionId !== undefined && (!Number.isInteger(sessionId) || sessionId < 1)) {
      throw new HttpError(400, 'sessionId must be a positive integer.');
    }

    const result = await this.agentService.getLatestApplyId(sessionId, actor.userId);
    res.json(result.body);
  }, 'Failed to load latest agent apply.', {
    onError: (error, _req, res) => {
      if (isHttpError(error)) {
        res.status(error.statusCode).json({ error: error.message });
        return true;
      }
      return false;
    },
  });

  getSettings = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.requireSettingsService().getSettings();
    res.json(result.body);
  }, 'Failed to load AI settings.');

  replaceSettings = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().replaceSettings(req.body || {});
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to save AI settings.');

  updateGlobalSettings = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().updateGlobalSettings(req.body || {});
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to save AI settings.');

  listModels = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.requireSettingsService().listModels();
    res.json(result.body);
  }, 'Failed to load AI models.');

  getLocalEmbeddingsModelStatus = asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      status: readLocalEmbeddingsModelStatus(),
    });
  }, 'Failed to load local embeddings model status.');

  getWorkspaceEmbeddingsIndexStatus = asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      status: readWorkspaceEmbeddingsIndexStatus(),
    });
  }, 'Failed to load workspace embeddings index status.');

  listAvailableModels = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.requireSettingsService().listAvailableModels();
    res.json(result.body);
  }, 'Failed to load available AI models.');

  addModel = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().addModel(req.body || {});
      res.status(result.statusCode || 201).json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to create AI model.');

  updateModel = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().updateModel(String(req.params.id || ''), req.body || {});
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to update AI model.');

  deleteModel = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().deleteModel(String(req.params.id || ''));
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to delete AI model.');

  deleteProvider = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().deleteProvider(
        String(req.params.provider || '') as AiProviderKind,
      );
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to delete AI provider.');

  addProvider = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().addProvider(
        String(req.params.provider || '') as AiProviderKind,
        req.body || {},
      );
      res.status(result.statusCode ?? 201).json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to add AI provider.');

  updateProvider = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().updateProvider(
        String(req.params.provider || '') as AiProviderKind,
        req.body || {},
      );
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to update AI provider.');

  testProvider = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().testProvider(
        String(req.params.provider || '') as AiProviderKind,
      );
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : 'Connection test failed.';
      res.status(502).json({ success: false, error: message });
      return;
    }
  }, 'Failed to test AI provider connection.');

  testModel = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().testModel(String(req.params.id || ''));
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : 'Connection test failed.';
      res.status(502).json({ success: false, error: message });
      return;
    }
  }, 'Failed to test AI model connection.');

  listProviderRemoteModels = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().listProviderRemoteModels(
        String(req.params.provider || '') as AiProviderKind,
      );
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to list remote models.';
      res.status(502).json({ success: false, error: message });
      return;
    }
  }, 'Failed to list AI provider remote models.');

  listMcpServers = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.requireSettingsService().listMcpServers();
    res.json(result.body);
  }, 'Failed to load MCP servers.');

  addMcpServer = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().addMcpServer(req.body || {});
      res.status(result.statusCode || 201).json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to create MCP server.');

  updateMcpServer = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().updateMcpServer(
        String(req.params.id || ''),
        req.body || {},
      );
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to update MCP server.');

  deleteMcpServer = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().deleteMcpServer(String(req.params.id || ''));
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to delete MCP server.');

  testMcpServer = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().testMcpServer(String(req.params.id || ''));
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : 'Connection test failed.';
      res.status(502).json({ success: false, error: message });
      return;
    }
  }, 'Failed to test MCP server connection.');

  getMcpAccessMe = asyncHandler(async (req: Request, res: Response) => {
    const actor = toActorContext(req, hasAdminRole(req));
    const result = await mcpAccessService.getMe(actor.userId, actor.role);
    res.json(result.body);
  }, 'Failed to load MCP access.');

  getMcpAccessCatalog = asyncHandler(async (_req: Request, res: Response) => {
    const result = await mcpAccessService.getCatalog();
    res.json(result.body);
  }, 'Failed to load MCP access catalog.');

  getRoleMcpAccess = asyncHandler(async (req: Request, res: Response) => {
    const roleName = typeof req.params.roleName === 'string' ? req.params.roleName : '';
    const result = await mcpAccessService.getRoleGrants(roleName);
    res.json(result.body);
  }, 'Failed to load role MCP grants.');

  replaceRoleMcpAccess = asyncHandler(async (req: Request, res: Response) => {
    const roleName = typeof req.params.roleName === 'string' ? req.params.roleName : '';
    const actor = toActorContext(req, hasAdminRole(req));
    const result = await mcpAccessService.replaceRoleGrants(
      roleName,
      req.body || {},
      actor.userId || null,
    );
    res.json(result.body);
  }, 'Failed to update role MCP grants.');

  replaceMcpResourceAccessControl = asyncHandler(async (req: Request, res: Response) => {
    const resourceId = typeof req.params.resourceId === 'string' ? req.params.resourceId : '';
    try {
      const result = await this.requireSettingsService().replaceMcpResourceAccessControl(
        resourceId,
        req.body || {},
      );
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      if (error instanceof HttpError) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to update MCP resource access control.');

  updateWebSearchSettings = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().updateWebSearchSettings(req.body || {});
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to save web search settings.');

  updateAgentSettings = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().updateAgentSettings(req.body || {});
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to save agent settings.');

  updateHttpSettings = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().updateHttpSettings(req.body || {});
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to save HTTP settings.');

  updateInboundHostSettings = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().updateInboundHostSettings(req.body || {});
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to save inbound MCP host settings.');

  updateDefaultCapabilityPacks = asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await this.requireSettingsService().updateDefaultCapabilityPacks(req.body || {});
      res.json(result.body);
    } catch (error) {
      if (error instanceof AiValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      throw error;
    }
  }, 'Failed to save default capability packs.');

  listChatSessions = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.chatHistoryService.listSessions(toActorContext(req, hasAdminRole(req)));
    res.json(result.body);
  }, 'Failed to load chat history.');

  getChatSession = asyncHandler(async (req: Request, res: Response) => {
    const sessionId = Number(req.params.id || 0);
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Invalid chat session id.' });
      return;
    }

    const result = await this.chatHistoryService.getSession(toActorContext(req, hasAdminRole(req)), sessionId);
    res.json(result.body);
  }, 'Failed to load chat session.');

  createChatSession = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.chatHistoryService.createSession(
      toActorContext(req, hasAdminRole(req)),
      req.body || {},
    );
    res.status(result.statusCode || 201).json(result.body);
  }, 'Failed to create chat session.');

  updateChatSession = asyncHandler(async (req: Request, res: Response) => {
    const sessionId = Number(req.params.id || 0);
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Invalid chat session id.' });
      return;
    }

    const result = await this.chatHistoryService.updateSession(
      toActorContext(req, hasAdminRole(req)),
      sessionId,
      req.body || {},
    );
    res.json(result.body);
  }, 'Failed to update chat session.');

  deleteChatSession = asyncHandler(async (req: Request, res: Response) => {
    const sessionId = Number(req.params.id || 0);
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Invalid chat session id.' });
      return;
    }

    const result = await this.chatHistoryService.deleteSession(
      toActorContext(req, hasAdminRole(req)),
      sessionId,
    );
    res.json(result.body);
  }, 'Failed to delete chat session.');


  listAllChatSessions = asyncHandler(async (req: Request, res: Response) => {
    const query = parseChatSessionListQuery(req.query as Record<string, unknown>);
    const result = await this.chatHistoryService.listAllSessions(
      toActorContext(req, hasAdminRole(req)),
      query,
    );
    res.json(result.body);
  }, 'Failed to load admin chat history.');

  getAdminChatSession = asyncHandler(async (req: Request, res: Response) => {
    const sessionId = Number(req.params.id || 0);
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Invalid chat session id.' });
      return;
    }

    const result = await this.chatHistoryService.getSessionAdmin(
      toActorContext(req, hasAdminRole(req)),
      sessionId,
    );
    res.json(result.body);
  }, 'Failed to load admin chat session.');

  deleteAdminChatSession = asyncHandler(async (req: Request, res: Response) => {
    const sessionId = Number(req.params.id || 0);
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Invalid chat session id.' });
      return;
    }

    const result = await this.chatHistoryService.deleteSessionAdmin(
      toActorContext(req, hasAdminRole(req)),
      sessionId,
    );
    res.json(result.body);
  }, 'Failed to delete admin chat session.');

  private requireSettingsService(): AiSettingsService {
    if (!this.aiSettingsService) {
      throw new Error('AI settings service is not configured.');
    }
    return this.aiSettingsService;
  }
}
