import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import {
  ProfileChangePasswordModal,
  ProfileDeleteAccountModal,
} from '../../../components/profile/ProfileAccountModals';
import { ProfileActiveSessionsModal } from '../../../components/profile/ProfileActiveSessions';
import { useCultureT } from '../../../core/culture/CultureContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useCurrentUserDisplay } from '../../../hooks/useCurrentUserDisplay';
import { useProfileAccount } from '../../../hooks/useProfileAccount';
import { cn } from '../../../lib/utils';
import type { DashboardMyLink, DashboardMyLinkTone } from '../dashboardMyLinks';
import {
  DASHBOARD_BODY_PAD_STRIP_CLASS,
  DASHBOARD_CAPTION_ACTION_GLYPH_CLASS,
  DASHBOARD_HEADER_ICON_CLASS,
  dashboardFitCaptionGridClass,
} from '../dashboardDensity';
import { DashboardFitAction } from './DashboardFitAction';
import { useDashboardWidgetFit } from './DashboardWidgetFitContext';
import { DashboardWidgetShell } from './DashboardWidgetShell';

type DashboardMyLinksProps = {
  links: DashboardMyLink[];
  className?: string;
};

const resolveLinkIconClass = (tone: DashboardMyLinkTone): string => {
  if (tone === 'danger') {
    return 'text-rose-600';
  }
  if (tone === 'muted') {
    return 'text-slate-400';
  }
  return DASHBOARD_CAPTION_ACTION_GLYPH_CLASS;
};

export const DashboardMyLinks: React.FC<DashboardMyLinksProps> = ({ links, className }) => {
  const t = useCultureT();
  const fit = useDashboardWidgetFit();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { currentUser } = useCurrentUserDisplay();
  const account = useProfileAccount();
  const [isDeleteAccountRevealed, setIsDeleteAccountRevealed] = useState(false);

  useEffect(() => {
    setIsDeleteAccountRevealed(false);
  }, [currentUser?.id]);

  const handleLogoutAfterSensitiveAction = async () => {
    await logout();
    navigate('/login');
  };

  const handleActivate = (link: DashboardMyLink) => {
    if (link.kind === 'sessions') {
      account.openActiveSessions();
      return;
    }
    if (link.kind === 'password') {
      account.openChangePassword();
      return;
    }
    if (link.kind === 'delete') {
      account.openDeleteAccount();
      return;
    }
    if (link.kind === 'logout') {
      void (async () => {
        await logout();
        navigate('/login');
      })();
    }
  };

  return (
    <>
      <DashboardWidgetShell
        title={t('dashboard.myLinks.title')}
        headerIcon={<UserRound className={DASHBOARD_HEADER_ICON_CLASS} />}
        className={className}
        bodyClassName={DASHBOARD_BODY_PAD_STRIP_CLASS}
      >
        <div className={dashboardFitCaptionGridClass(fit.iconColumns)}>
          {links.map((link) => {
            const Icon = link.icon;
            const isDelete = link.kind === 'delete';
            const tone = isDelete && isDeleteAccountRevealed ? 'danger' : link.tone;
            const label = t(link.labelKey);
            const description = isDelete && !isDeleteAccountRevealed
              ? t('dashboard.myLinks.deleteAccount.hint')
              : t(link.descriptionKey);

            return (
              <DashboardFitAction
                key={link.id}
                layout="caption"
                iconOnly
                icon={<Icon className={cn(DASHBOARD_CAPTION_ACTION_GLYPH_CLASS, 'shrink-0', resolveLinkIconClass(tone))} />}
                label={label}
                description={description}
                tone={tone}
                to={link.kind === 'route' && link.path ? link.path : undefined}
                onClick={() => {
                  if (isDelete && !isDeleteAccountRevealed) {
                    return;
                  }
                  handleActivate(link);
                }}
                onDoubleClick={() => {
                  if (isDelete && !isDeleteAccountRevealed) {
                    setIsDeleteAccountRevealed(true);
                  }
                }}
              />
            );
          })}
        </div>
      </DashboardWidgetShell>

      <ProfileActiveSessionsModal
        open={account.isActiveSessionsOpen}
        userId={currentUser?.id}
        onClose={account.closeActiveSessions}
      />

      <ProfileChangePasswordModal
        open={account.isChangePasswordOpen}
        error={account.changePasswordError}
        isSaving={account.isChangingPassword}
        currentPassword={account.currentPassword}
        newPassword={account.newPassword}
        confirmPassword={account.confirmPassword}
        onCurrentPasswordChange={account.setCurrentPassword}
        onNewPasswordChange={account.setNewPassword}
        onConfirmPasswordChange={account.setConfirmPassword}
        onClose={account.closeChangePassword}
        onSubmit={() => {
          void (async () => {
            const result = await account.submitChangePassword();
            if (result.requiresLogout) {
              await handleLogoutAfterSensitiveAction();
            }
          })();
        }}
      />

      <ProfileDeleteAccountModal
        open={account.isDeleteAccountOpen}
        error={account.deleteError}
        isSaving={account.isDeletingAccount}
        password={account.deletePassword}
        acknowledged={account.deleteAcknowledged}
        onPasswordChange={account.setDeletePassword}
        onAcknowledgedChange={account.setDeleteAcknowledged}
        onClose={account.closeDeleteAccount}
        onSubmit={() => {
          void (async () => {
            const result = await account.submitDeleteAccount();
            if (result.requiresLogout) {
              await handleLogoutAfterSensitiveAction();
            }
          })();
        }}
      />
    </>
  );
};
