import type { Request, Response } from 'express';
import type {
  GitConnectAuthInput,
  GitConnectRequest,
  GitSettings,
  GitWorkflowTemplateApplyRequest,
} from '../../shared/api/contracts/git/types';
import type { GitService } from '../services/git/git.service';
import {
  buildGithubOAuthCallbackHtml,
  completeGithubOAuthCallback,
  getGithubOAuthSessionStatus,
  resolveGithubOAuthAvailability,
  startGithubOAuth,
} from '../services/git/gitGithubOAuth.service';
import { asyncHandler } from '../utils/asyncHandler';

export class GitController {
  constructor(private readonly gitService: GitService) {}

  getSettings = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.gitService.getSettings();
    res.json(result.body);
  }, 'Failed to read git settings.');

  updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.gitService.updateSettings((req.body || {}) as Partial<GitSettings>);
    res.json(result.body);
  }, 'Failed to update git settings.');

  testSettings = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.gitService.testSettings((req.body || {}) as Partial<GitSettings>);
    res.json(result.body);
  }, 'Failed to test git settings.');

  updateCredentials = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.gitService.updateCredentials((req.body || {}) as GitConnectAuthInput);
    res.json(result.body);
  }, 'Failed to update git credentials.');

  connect = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.gitService.connect((req.body || {}) as GitConnectRequest);
    res.json(result.body);
  }, 'Failed to connect git.');

  getStatus = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.gitService.getStatus();
    res.json(result.body);
  }, 'Failed to read git status.');

  getChanges = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.gitService.getChanges();
    res.json(result.body);
  }, 'Failed to read git changes.');

  getBranches = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.gitService.getBranches();
    res.json(result.body);
  }, 'Failed to read git branches.');

  checkout = asyncHandler(async (req: Request, res: Response) => {
    const branch = typeof req.body?.branch === 'string' ? req.body.branch : '';
    if (!branch.trim()) {
      res.status(400).json({ success: false, error: 'branch is required.' });
      return;
    }
    const result = await this.gitService.checkout({ branch });
    res.json(result.body);
  }, 'Failed to checkout git branch.');

  getDiff = asyncHandler(async (req: Request, res: Response) => {
    const path = typeof req.query.path === 'string' ? req.query.path : '';
    const staged = req.query.staged === 'true' || req.query.staged === '1';
    const section = typeof req.query.section === 'string'
      ? req.query.section
      : undefined;
    if (!path.trim()) {
      res.status(400).json({ success: false, error: 'path query parameter is required.' });
      return;
    }
    const parsedSection = section === 'staged' || section === 'unstaged' || section === 'untracked'
      ? section
      : undefined;
    const result = await this.gitService.getDiff(path, staged, parsedSection);
    res.json(result.body);
  }, 'Failed to read git diff.');

  stage = asyncHandler(async (req: Request, res: Response) => {
    const paths = Array.isArray(req.body?.paths) ? req.body.paths as string[] : [];
    const result = await this.gitService.stage(paths);
    res.json(result.body);
  }, 'Failed to stage git changes.');

  unstage = asyncHandler(async (req: Request, res: Response) => {
    const paths = Array.isArray(req.body?.paths) ? req.body.paths as string[] : [];
    const result = await this.gitService.unstage(paths);
    res.json(result.body);
  }, 'Failed to unstage git changes.');

  discard = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.gitService.discard((req.body || {}) as {
      paths?: string[];
      all?: boolean;
      untracked?: boolean;
    });
    res.json(result.body);
  }, 'Failed to discard git changes.');

  fetch = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.gitService.fetch();
    res.json(result.body);
  }, 'Failed to fetch from remote.');

  pull = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.gitService.pull();
    res.json(result.body);
  }, 'Failed to pull from remote.');

  push = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.gitService.push();
    res.json(result.body);
  }, 'Failed to push to remote.');

  sync = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.gitService.sync();
    res.json(result.body);
  }, 'Failed to sync with remote.');

  commit = asyncHandler(async (req: Request, res: Response) => {
    const message = typeof req.body?.message === 'string' ? req.body.message : '';
    if (!message.trim()) {
      res.status(400).json({ success: false, error: 'message is required.' });
      return;
    }
    const result = await this.gitService.commit(message);
    res.json(result.body);
  }, 'Failed to commit changes.');

  suggestCommitMessage = asyncHandler(async (req: Request, res: Response) => {
    const paths = Array.isArray(req.body?.paths) ? req.body.paths as string[] : undefined;
    const result = await this.gitService.suggestCommitMessage(paths);
    res.json(result.body);
  }, 'Failed to suggest commit message.');

  getPrStatus = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.gitService.getPrStatus();
    res.json(result.body);
  }, 'Failed to read GitHub PR status.');

  getWorkflowTemplates = asyncHandler(async (_req: Request, res: Response) => {
    const result = this.gitService.getWorkflowTemplates();
    res.json(result.body);
  }, 'Failed to read git workflow templates.');

  getGithubOAuthAvailability = asyncHandler(async (_req: Request, res: Response) => {
    const availability = await resolveGithubOAuthAvailability();
    res.json({ success: true as const, ...availability });
  }, 'Failed to read GitHub OAuth availability.');

  startGithubOAuth = asyncHandler(async (req: Request, res: Response) => {
    const userId = Number(req.auth?.userId);
    if (!Number.isFinite(userId)) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    const result = await startGithubOAuth(userId);
    res.json({ success: true as const, ...result });
  }, 'Failed to start GitHub OAuth.');

  getGithubOAuthSession = asyncHandler(async (req: Request, res: Response) => {
    const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : '';
    if (!sessionId.trim()) {
      res.status(400).json({ success: false, error: 'sessionId is required.' });
      return;
    }

    const session = getGithubOAuthSessionStatus(sessionId);
    res.json({ success: true as const, session });
  }, 'Failed to read GitHub OAuth session.');

  githubOAuthCallback = asyncHandler(async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    let oauthError: string | undefined;

    if (typeof req.query.error === 'string' && req.query.error.trim()) {
      oauthError = String(req.query.error_description || req.query.error).trim();
    }

    if (oauthError) {
      const sessionId = state.split('.')[0] || 'unknown';
      const html = buildGithubOAuthCallbackHtml(sessionId, {
        status: 'error',
        error: oauthError,
      });
      res.set('Cache-Control', 'no-store');
      res.type('html').send(html);
      return;
    }

    if (!code.trim() || !state.trim()) {
      res.status(400).type('html').send(buildGithubOAuthCallbackHtml('unknown', {
        status: 'error',
        error: 'Missing OAuth callback parameters.',
      }));
      return;
    }

    const { sessionId, result } = await completeGithubOAuthCallback(code, state);
    res.set('Cache-Control', 'no-store');
    res.type('html').send(buildGithubOAuthCallbackHtml(sessionId, result));
  }, 'Failed to complete GitHub OAuth callback.');

  applyWorkflowTemplate = asyncHandler(async (req: Request, res: Response) => {
    const templateId = typeof req.body?.templateId === 'string' ? req.body.templateId : '';
    if (!templateId.trim()) {
      res.status(400).json({ success: false, error: 'templateId is required.' });
      return;
    }

    const result = this.gitService.applyWorkflowTemplate({
      templateId,
      targetPath: typeof req.body?.targetPath === 'string' ? req.body.targetPath : undefined,
      overwrite: req.body?.overwrite === true,
    } satisfies GitWorkflowTemplateApplyRequest);
    res.json(result.body);
  }, 'Failed to apply git workflow template.');

  getWorkflowFile = asyncHandler(async (req: Request, res: Response) => {
    const path = typeof req.query.path === 'string' ? req.query.path : undefined;
    const result = this.gitService.getWorkflowFile(path);
    res.json(result.body);
  }, 'Failed to read git workflow file.');

  saveWorkflowFile = asyncHandler(async (req: Request, res: Response) => {
    const path = typeof req.body?.path === 'string' ? req.body.path : '';
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    if (!path.trim()) {
      res.status(400).json({ success: false, error: 'path is required.' });
      return;
    }

    const result = this.gitService.saveWorkflowFile(path, content);
    res.json(result.body);
  }, 'Failed to save git workflow file.');
}
