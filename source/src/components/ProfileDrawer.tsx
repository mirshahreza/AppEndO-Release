import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  KeyRound,
  LogOut,
  Trash2,
} from 'lucide-react';
import { canSelfDeleteAccount } from '../app/guards/roleAccess';
import { usePlatformConfig } from '../app/platform/PlatformConfigProvider';
import { usePlatformMount } from '../app/platform/PlatformMountContext';
import { buildDashboardMyLinks } from '../features/dashboard/dashboardMyLinks';
import type { ProfileDrawerTone } from './profile/profileDrawerUi';
import { useCurrentUserDisplay } from '../hooks/useCurrentUserDisplay';
import { useCultureT, useOptionalCulture } from '../core/culture/CultureContext';
import { profileKey } from '../core/culture/translations/cultureKeyHelpers';
import { useProfileAccount } from '../hooks/useProfileAccount';
import {
  ProfileChangePasswordModal,
  ProfileDeleteAccountModal,
  ProfileMoreModal,
} from './profile/ProfileAccountModals';
import { ProfileAttributesSummary } from './profile/ProfileAttributesSummary';
import { ProfileEditableAttributes } from './profile/ProfileEditableAttributes';
import { ProfilePersonalDetails } from './profile/ProfilePersonalDetails';
import { ProfileLinkedIdentities } from './profile/ProfileLinkedIdentities';
import {
  PROFILE_DRAWER_PANEL_CLASS,
  PROFILE_IDENTITY_BOX_CLASS,
  PROFILE_LOGOUT_BAR_CLASS,
  PROFILE_LOGOUT_ITEM_CLASS,
  PROFILE_NAV_LIST_CLASS,
  PROFILE_ROLE_PILL_CLASS,
  PROFILE_ROLE_PILL_PRIMARY_CLASS,
  ProfileDrawerPatternLayers,
  ProfileNavButton,
} from './profile/profileDrawerUi';
import {
  buildSideHintContent,
  SideHintTooltip,
} from '../shared/ui/SideHintTooltip';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const NavChevron = () => (
  <ChevronRight
    className="h-3.5 w-3.5 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180"
    aria-hidden
  />
);

const PROFILE_ROUTE_LINK_HUE: Record<string, ProfileDrawerTone> = {
  'my-inbox': 'indigo',
  'my-apis': 'cyan',
  'my-workbooks': 'emerald',
};

export const ProfileDrawer = ({
  isOpen,
  onClose,
  onLogout,
}: ProfileDrawerProps) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const t = useCultureT();
  const {
    profile,
    displayName,
    avatarFull,
    avatarInitial,
    roles,
    primaryRole,
    currentUser,
  } = useCurrentUserDisplay();
  const culture = useOptionalCulture();
  const isRtl = culture?.direction === 'rtl';
  const offscreenX = isRtl ? '-100%' : '100%';
  const showDeleteAccount = canSelfDeleteAccount(currentUser);
  const account = useProfileAccount();
  const { config } = usePlatformConfig();
  const { mountId } = usePlatformMount();
  const [isDeleteAccountRevealed, setIsDeleteAccountRevealed] = useState(false);
  const personalRouteLinks = useMemo(
    () => buildDashboardMyLinks({
      config,
      pathname,
      mountId,
      currentUser: currentUser ?? { role: 'USER', roles: [] },
      canDeleteAccount: showDeleteAccount,
    }).filter((link) => link.kind === 'route' && link.path),
    [config, currentUser, mountId, pathname, showDeleteAccount],
  );

  useEffect(() => {
    if (!isOpen) {
      setIsDeleteAccountRevealed(false);
    }
  }, [isOpen]);

  const leadRole = primaryRole || roles[0] || null;
  const extraRoles = useMemo(
    () => (leadRole ? roles.filter((role) => role !== leadRole) : roles),
    [leadRole, roles],
  );

  const emailHint = profile?.email
    ? buildSideHintContent(t(profileKey('fields.email')), profile.email, 'indigo')
    : null;

  const goTo = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleLogoutAfterSensitiveAction = async () => {
    await onLogout();
    navigate('/login');
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.aside
              initial={{ x: offscreenX, opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: offscreenX, opacity: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className={PROFILE_DRAWER_PANEL_CLASS}
            >
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-5">
                <div className={PROFILE_IDENTITY_BOX_CLASS}>
                  <ProfileDrawerPatternLayers />
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="relative mb-2 h-14 w-14 overflow-hidden rounded-full bg-indigo-100 ring-2 ring-white">
                    {avatarFull ? (
                      <img
                        src={avatarFull}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-lg font-bold text-indigo-700">
                        {avatarInitial}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold tracking-tight text-indigo-950">{displayName}</h3>

                  {profile?.username ? (
                    <SideHintTooltip
                      content={emailHint}
                      placement={isRtl ? 'right' : 'left'}
                      isRtl={isRtl}
                      className="mt-0.5 inline-flex"
                    >
                      <span className="text-xs font-semibold text-indigo-600">@{profile.username}</span>
                    </SideHintTooltip>
                  ) : profile?.email ? (
                    <SideHintTooltip
                      content={emailHint}
                      placement={isRtl ? 'right' : 'left'}
                      isRtl={isRtl}
                      className="mt-0.5 inline-flex"
                    >
                      <span className="text-xs font-semibold text-indigo-600">{t(profileKey('fields.email'))}</span>
                    </SideHintTooltip>
                  ) : null}

                  {leadRole || extraRoles.length > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                      {leadRole ? (
                        <span className={PROFILE_ROLE_PILL_PRIMARY_CLASS}>{leadRole}</span>
                      ) : null}
                      {extraRoles.map((role) => (
                        <span key={role} className={PROFILE_ROLE_PILL_CLASS}>
                          {role}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <ProfilePersonalDetails
                    profile={profile}
                    userId={currentUser?.id}
                    enabled={isOpen}
                    onOpenMore={account.openMore}
                  />
                  <ProfileEditableAttributes userId={currentUser?.id} enabled={isOpen} />
                  <ProfileAttributesSummary userId={currentUser?.id} enabled={isOpen} />
                  <ProfileLinkedIdentities enabled={isOpen} />
                </div>

                <div className="mx-1 border-t border-slate-100" role="separator" />

                <nav className={PROFILE_NAV_LIST_CLASS} aria-label={t('dashboard.myLinks.title')}>
                  {personalRouteLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                      <ProfileNavButton
                        key={link.id}
                        hue={PROFILE_ROUTE_LINK_HUE[link.id] ?? 'slate'}
                        icon={<Icon className="h-3.5 w-3.5" />}
                        trailing={<NavChevron />}
                        onClick={() => goTo(link.path!)}
                      >
                        {t(link.labelKey)}
                      </ProfileNavButton>
                    );
                  })}
                  <ProfileNavButton
                    hue="amber"
                    icon={<KeyRound className="h-3.5 w-3.5" />}
                    onClick={account.openChangePassword}
                  >
                    {t(profileKey('actions.changePassword'))}
                  </ProfileNavButton>
                  {showDeleteAccount ? (
                    !isDeleteAccountRevealed ? (
                      <div className="px-2.5 pt-1">
                        <p className="pb-1 text-xs leading-relaxed text-slate-400">
                          {t('dashboard.myLinks.deleteAccount.hint')}
                        </p>
                        <ProfileNavButton
                          tone="muted"
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          onDoubleClick={() => setIsDeleteAccountRevealed(true)}
                        >
                          {t('dashboard.myLinks.deleteAccount')}
                        </ProfileNavButton>
                      </div>
                    ) : (
                      <ProfileNavButton
                        tone="danger"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={account.openDeleteAccount}
                      >
                        {t('dashboard.myLinks.deleteAccount')}
                      </ProfileNavButton>
                    )
                  ) : null}
                </nav>
              </div>

              <div className={PROFILE_LOGOUT_BAR_CLASS}>
                <ProfileNavButton
                  tone="muted"
                  className={PROFILE_LOGOUT_ITEM_CLASS}
                  icon={<LogOut className="h-3.5 w-3.5" />}
                  onClick={onLogout}
                >
                  {t('dashboard.myLinks.logout')}
                </ProfileNavButton>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <ProfileMoreModal
        open={account.isMoreOpen}
        profile={profile}
        userId={currentUser?.id}
        onClose={account.closeMore}
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
