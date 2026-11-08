import { Router, type Express } from 'express';
import { WorkflowProofController } from '../controllers/workflowProof.controller';
import { requireRole } from '../middleware/auth.middleware';

export const mountWorkflowProofRoutes = (app: Express): void => {
  const controller = new WorkflowProofController();
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.get('/instances/:instanceId', controller.getProof);

  app.use('/api/workflow-proof', adminOnly, router);
};
