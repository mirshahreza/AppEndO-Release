import { Router, type Express } from 'express';
import { requireRole } from '../middleware/auth.middleware';
import { toAuthAuditContext } from '../utils/requestContext';
import { logAuthEvent } from '../services/auth/sessionAudit.service';
import { findAuthUserById } from '../domain/users/userRepository';
import {
  createImpersonationGrant,
  endImpersonationGrant,
} from '../services/dev-toolbar/impersonationGrantStore';

export const mountDevToolbarRoutes = (app: Express): void => {
  const adminOnly = requireRole('ADMIN');
  const router = Router();

  router.post('/impersonate', async (req, res) => {
    const impersonatorId = req.auth?.userId;
    if (!impersonatorId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const targetUserIdRaw = req.body?.targetUserId;
    const targetRoleRaw = typeof req.body?.targetRole === 'string' ? req.body.targetRole.trim() : '';
    const durationMinutes = Number(req.body?.durationMinutes) || undefined;

    let targetUserId: number | null = null;
    let targetEmail: string | null = null;
    let targetRoles: string[] = [];

    if (targetUserIdRaw != null && targetUserIdRaw !== '') {
      targetUserId = Number(targetUserIdRaw);
      if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
        res.status(400).json({ success: false, error: 'Invalid target user id.' });
        return;
      }
      const targetUser = await findAuthUserById(targetUserId);
      if (!targetUser) {
        res.status(404).json({ success: false, error: 'Target user was not found.' });
        return;
      }
      targetEmail = targetUser.email;
      targetRoles = targetUser.roles.length > 0 ? targetUser.roles : [targetUser.role];
    } else if (targetRoleRaw) {
      targetRoles = [targetRoleRaw];
    } else {
      res.status(400).json({ success: false, error: 'targetUserId or targetRole is required.' });
      return;
    }

    const grant = createImpersonationGrant({
      impersonatorId,
      impersonatorEmail: req.auth?.email ?? null,
      targetUserId,
      targetEmail,
      targetRoles,
      durationMinutes,
    });

    await logAuthEvent(toAuthAuditContext(req), 'IMPERSONATE_START', {
      userId: targetUserId ?? undefined,
      email: targetEmail ?? undefined,
      success: true,
      metadata: {
        impersonatorId,
        impersonatorEmail: req.auth?.email ?? null,
        targetRoles,
        grantId: grant.id,
        expiresAt: new Date(grant.expiresAt).toISOString(),
      },
    });

    res.json({
      success: true,
      grantId: grant.id,
      expiresAt: new Date(grant.expiresAt).toISOString(),
      targetUserId,
      targetEmail,
      targetRoles,
    });
  });

  router.delete('/impersonate/:grantId', async (req, res) => {
    const impersonatorId = req.auth?.userId;
    if (!impersonatorId) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const grant = endImpersonationGrant(req.params.grantId, impersonatorId);
    if (grant) {
      await logAuthEvent(toAuthAuditContext(req), 'IMPERSONATE_END', {
        userId: grant.targetUserId ?? undefined,
        email: grant.targetEmail ?? undefined,
        success: true,
        metadata: { impersonatorId, grantId: grant.id },
      });
    }

    res.json({ success: true });
  });

  app.use('/api/dev-toolbar', adminOnly, router);
};
