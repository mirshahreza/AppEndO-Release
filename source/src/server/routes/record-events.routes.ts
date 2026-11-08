import { Router, type Express } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { RecordEventsController } from '../controllers/record-events.controller';

export const mountRecordEventsRoutes = (app: Express): void => {
  const controller = new RecordEventsController();
  const router = Router();
  const auditee = requireRole('ADMIN');

  router.get('/', requireAuth, controller.list);
  router.get('/export', requireAuth, controller.exportList);
  router.post('/export/verify', requireAuth, controller.verifyExport);
  router.get('/devices', requireAuth, controller.devices);
  router.get('/http-log', requireAuth, controller.logLink);
  router.post('/holds', auditee, controller.putHold);
  router.delete('/holds', auditee, controller.deleteHold);
  router.post('/erase', auditee, controller.erase);
  router.delete('/', auditee, controller.clearAll);
  router.get('/:id', requireAuth, controller.getById);

  app.use('/api/record-events', router);
};
