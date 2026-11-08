import multer from 'multer';
import { Router, type Express } from 'express';
import { PackageController } from '../controllers/package.controller';
import { requireRole } from '../middleware/auth.middleware';
import { PACKAGE_ARTIFACT_MAX_BYTES } from '../../core/packages/packageArtifactLimits';

const packageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PACKAGE_ARTIFACT_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      cb(new Error('Only .zip files are accepted.'));
      return;
    }
    cb(null, true);
  },
});

export const mountPackageRoutes = (app: Express): void => {
  const controller = new PackageController();
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.post('/export/functions/preview', adminOnly, controller.previewFunctionExport);
  router.post('/export/functions', adminOnly, controller.exportFunctions);
  router.post('/import/preview', adminOnly, packageUpload.single('file'), controller.previewImport);
  router.post('/install/preview', adminOnly, controller.previewInstall);
  router.post('/bundle/download-plan', adminOnly, controller.bundleDownloadPlan);

  app.use('/api/package', router);
};
