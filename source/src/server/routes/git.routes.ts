import { Router, type Express } from 'express';
import { GitController } from '../controllers/git.controller';
import { requireRole } from '../middleware/auth.middleware';
import { SETTINGS_PATH } from '../config/settingsFile';
import { GitService } from '../services/git/git.service';

export const mountGitRoutes = (app: Express): void => {
  const service = new GitService({ settingsPath: SETTINGS_PATH });
  const controller = new GitController(service);
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/oauth/github/availability', controller.getGithubOAuthAvailability);
  router.post('/oauth/github/start', controller.startGithubOAuth);
  router.get('/oauth/github/session/:sessionId', controller.getGithubOAuthSession);

  router.get('/settings', controller.getSettings);
  router.put('/settings', controller.updateSettings);
  router.put('/credentials', controller.updateCredentials);
  router.post('/connect', controller.connect);
  router.post('/settings/test', controller.testSettings);
  router.get('/status', controller.getStatus);
  router.get('/changes', controller.getChanges);
  router.get('/branches', controller.getBranches);
  router.post('/checkout', controller.checkout);
  router.get('/diff', controller.getDiff);
  router.post('/stage', controller.stage);
  router.post('/unstage', controller.unstage);
  router.post('/discard', controller.discard);
  router.post('/fetch', controller.fetch);
  router.post('/pull', controller.pull);
  router.post('/push', controller.push);
  router.post('/sync', controller.sync);
  router.post('/commit', controller.commit);
  router.post('/commit-message/suggest', controller.suggestCommitMessage);
  router.get('/pr-status', controller.getPrStatus);
  router.get('/workflow-templates', controller.getWorkflowTemplates);
  router.post('/workflow-templates/apply', controller.applyWorkflowTemplate);
  router.get('/workflow-file', controller.getWorkflowFile);
  router.put('/workflow-file', controller.saveWorkflowFile);

  app.get('/api/git/oauth/github/callback', controller.githubOAuthCallback);
  app.use('/api/git', adminOnly, router);
};
