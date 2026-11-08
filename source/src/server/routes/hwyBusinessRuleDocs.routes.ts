import { Router, type Request, type Response } from 'express';

import { requireAuth, requireRole } from '../middleware/auth.middleware';
import {
  ensureHwyBusinessRuleDocCatalogRows,
  listHwyBusinessRuleDocs,
  readHwyBusinessRuleDoc,
  updateHwyBusinessRuleDocMarkdown,
} from '../domain/hwy/hwyBusinessRuleDocs.service';

const readSlugParam = (req: Request): string => String(req.params.slug ?? '').trim();

export const registerHwyBusinessRuleDocsRoutes = (router: Router): void => {
  router.get('/business-rules/docs', requireAuth, async (_req: Request, res: Response) => {
    try {
      await ensureHwyBusinessRuleDocCatalogRows();
      const data = await listHwyBusinessRuleDocs();
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Could not load business rules.',
      });
    }
  });

  router.get('/business-rules/docs/:slug', requireAuth, async (req: Request, res: Response) => {
    try {
      const slug = readSlugParam(req);
      if (!slug) {
        res.status(400).json({ success: false, error: 'Missing slug.' });
        return;
      }
      await ensureHwyBusinessRuleDocCatalogRows();
      const data = await readHwyBusinessRuleDoc(slug);
      if (!data) {
        res.status(404).json({ success: false, error: 'Section not found.' });
        return;
      }
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Could not load business rule section.',
      });
    }
  });

  router.put(
    '/business-rules/docs/:slug',
    requireAuth,
    requireRole('ADMIN', 'DEVELOPER'),
    async (req: Request, res: Response) => {
      try {
        const slug = readSlugParam(req);
        if (!slug) {
          res.status(400).json({ success: false, error: 'Missing slug.' });
          return;
        }
        const body = req.body as {
          title?: string;
          introMarkdown?: string | null;
          bodyMarkdown?: string;
        };
        const bodyMarkdown = typeof body.bodyMarkdown === 'string' ? body.bodyMarkdown : '';
        const updated = await updateHwyBusinessRuleDocMarkdown({
          slug,
          title: typeof body.title === 'string' ? body.title : undefined,
          introMarkdown: body.introMarkdown,
          bodyMarkdown,
          updatedByUsername: req.auth?.email ?? null,
        });
        if (!updated) {
          res.status(404).json({ success: false, error: 'Section not found.' });
          return;
        }
        res.json({ success: true, data: updated });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Could not save business rule section.',
        });
      }
    },
  );
};
