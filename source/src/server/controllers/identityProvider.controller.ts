import type { Request, Response } from 'express';
import { completeOAuthCallback, startOAuthFlow } from '../../core/identity/OAuthFlowEngine';
import { IdentityProviderSettingsService } from '../services/auth/identityProviderSettings.service';
import { asyncHandler } from '../utils/asyncHandler';
import { applyAuthSideEffects } from '../utils/authCookies';
import { sendHttpError } from '../utils/controllerHttp';
import { toAuthAuditContext } from '../utils/requestContext';
import { isHttpError } from '../errors/HttpError';

export class IdentityProviderController {
  constructor(private readonly settingsService = new IdentityProviderSettingsService()) {}

  listProviders = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.settingsService.listProviders();
    res.json(result.body);
  }, 'Failed to load identity providers.');

  createProvider = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.settingsService.createProvider(req.body);
    res.status(result.statusCode ?? 200).json(result.body);
  }, 'Failed to create identity provider.');

  updateProvider = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.settingsService.updateProvider(String(req.params.id), req.body);
    res.json(result.body);
  }, 'Failed to update identity provider.');

  deleteProvider = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.settingsService.deleteProvider(String(req.params.id));
    res.json(result.body);
  }, 'Failed to delete identity provider.');

  testProvider = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.settingsService.testProvider(String(req.params.id));
    res.json(result.body);
  }, 'Failed to test identity provider.');

  startOAuth = asyncHandler(async (req: Request, res: Response) => {
    const result = await startOAuthFlow(String(req.params.providerId));
    res.redirect(result.authorizeUrl);
  }, 'Failed to start OAuth flow.', {
    onError: (error, _req, res) => {
      if (isHttpError(error)) {
        sendHttpError(res, error, 'Failed to start OAuth flow.');
        return true;
      }
      res.redirect(`/login?error=oauth_provider`);
      return true;
    },
  });

  oauthCallback = asyncHandler(async (req: Request, res: Response) => {
    const providerId = String(req.params.providerId);
    const result = await completeOAuthCallback({
      providerId,
      code: typeof req.query.code === 'string' ? req.query.code : undefined,
      error: typeof req.query.error === 'string' ? req.query.error : undefined,
      stateParam: typeof req.query.state === 'string' ? req.query.state : undefined,
      audit: toAuthAuditContext(req),
    });

    if ('errorCode' in result && result.errorCode) {
      res.redirect(`/login?error=${encodeURIComponent(result.errorCode)}`);
      return;
    }

    if ('sessionResult' in result && result.sessionResult) {
      applyAuthSideEffects(res, result.sessionResult);
      res.redirect('/');
      return;
    }

    res.redirect('/login?error=oauth_provider');
  }, 'OAuth callback failed.', {
    onError: (_error, _req, res) => {
      res.redirect('/login?error=oauth_provider');
      return true;
    },
  });
}
