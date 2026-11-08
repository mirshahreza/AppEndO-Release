import { Router, type Express } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { IdentityProviderController } from '../controllers/identityProvider.controller';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.middleware';
import { resolveAuthRateLimitKey } from '../middleware/authRateLimitKey';
import { createKeyedRateLimiter } from '../middleware/rateLimit';

const authMutationRateLimit = createKeyedRateLimiter({
  keyPrefix: 'auth-mutation',
  maxPerMinute: 10,
  keyFor: resolveAuthRateLimitKey,
});

const authRefreshRateLimit = createKeyedRateLimiter({
  keyPrefix: 'auth-refresh',
  maxPerMinute: 30,
  keyFor: resolveAuthRateLimitKey,
});

const authLoginAsRateLimit = createKeyedRateLimiter({
  keyPrefix: 'auth-loginas',
  maxPerMinute: 10,
  keyFor: resolveAuthRateLimitKey,
});

export const mountAuthRoutes = (app: Express, controller = new AuthController()): void => {
  const router = Router();
  const identityController = new IdentityProviderController();
  const adminOnly = requireRole('ADMIN');

  router.get('/config', controller.getPublicConfig);
  router.get('/oauth/:providerId/start', identityController.startOAuth);
  router.get('/oauth/:providerId/callback', identityController.oauthCallback);
  router.get('/identity-providers', requireAuth, adminOnly, identityController.listProviders);
  router.post('/identity-providers', requireAuth, adminOnly, identityController.createProvider);
  router.put('/identity-providers/:id', requireAuth, adminOnly, identityController.updateProvider);
  router.delete('/identity-providers/:id', requireAuth, adminOnly, identityController.deleteProvider);
  router.post('/identity-providers/:id/test', requireAuth, adminOnly, identityController.testProvider);
  router.post('/login', authMutationRateLimit, controller.login);
  router.post('/register', authMutationRateLimit, controller.register);
  router.post('/resend-verification', authMutationRateLimit, controller.resendVerification);
  router.post('/forgot-password', authMutationRateLimit, controller.forgotPassword);
  router.post('/reset-password', authMutationRateLimit, controller.resetPassword);
  router.post('/verify-email', authMutationRateLimit, controller.verifyEmail);
  router.get('/verify-email', authMutationRateLimit, controller.verifyEmail);
  router.post('/login-as/:id', requireAuth, requireRole('ADMIN'), authLoginAsRateLimit, controller.loginAs);
  router.post('/loginas/:id', requireAuth, requireRole('ADMIN'), authLoginAsRateLimit, controller.loginAs);
  router.post('/refresh', authRefreshRateLimit, controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/change-password', requireAuth, controller.changePassword);
  router.delete('/account', requireAuth, controller.deleteAccount);
  router.get('/me', optionalAuth, controller.me);
  router.get('/context', requireAuth, controller.context);
  router.get('/sessions', requireAuth, controller.listSessions);
  router.delete('/sessions/:jti', requireAuth, controller.revokeSession);
  router.delete('/sessions', requireAuth, controller.revokeAllSessions);
  router.get('/my-audit-logs', requireAuth, controller.myAuditLogs);
  router.get('/audit-logs', requireAuth, requireRole('ADMIN'), controller.adminAuditLogs);

  app.use('/api/auth', router);
};
