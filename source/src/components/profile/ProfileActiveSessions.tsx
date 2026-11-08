import React, { useMemo, useState } from 'react';
import { LogOut, MonitorSmartphone, Trash2, X } from 'lucide-react';
import {
  useMyAuthSessionsQuery,
  useRevokeAllAuthSessionsMutation,
  useRevokeAuthSessionMutation,
  type AuthSessionRecord,
} from '../../shared/api/queries/profile';
import { AppButton, ConfirmDialogShell, CreateEditModalShell } from '../../shared/ui';
import { useCultureT } from '../../core/culture/CultureContext';
import { profileKey } from '../../core/culture/translations/cultureKeyHelpers';

type ProfileActiveSessionsProps = {
  userId?: number | null;
  enabled?: boolean;
  confirmBackdropClassName?: string;
};

const formatSessionDate = (value: string | null | undefined): string => {
  if (!value) {
    return '—';
  }
  const trimmed = value.trim();
  if (trimmed.length >= 10) {
    return trimmed.slice(0, 10);
  }
  return trimmed || '—';
};

const summarizeUserAgent = (userAgent: string | null, unknownDeviceLabel: string): string => {
  if (!userAgent?.trim()) {
    return unknownDeviceLabel;
  }
  const trimmed = userAgent.trim();
  return trimmed.length > 72 ? `${trimmed.slice(0, 69)}…` : trimmed;
};

const isActiveSession = (session: AuthSessionRecord): boolean =>
  !session.revokedAt && Number(session.expiresAt) > Date.now();

type RevokeAllConfirmModalProps = {
  open: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  backdropClassName?: string;
  t: ReturnType<typeof useCultureT>;
};

const RevokeAllConfirmModal: React.FC<RevokeAllConfirmModalProps> = ({
  open,
  isSaving,
  onCancel,
  onConfirm,
  backdropClassName,
  t,
}) => (
  <ConfirmDialogShell
    open={open}
    title={t(profileKey('modals.signOutOtherDevices'))}
    icon={<LogOut className="h-4 w-4" />}
    backdropClassName={backdropClassName}
    onClose={onCancel}
    onConfirm={onConfirm}
    confirmLabel={t(profileKey('actions.revokeAll'))}
    isConfirming={isSaving}
    confirmingLabel={t(profileKey('actions.revoking'))}
    cancelDisabled={isSaving}
    confirmDisabled={isSaving}
  >
    {t(profileKey('modals.signOutOtherDevicesBody'))}
  </ConfirmDialogShell>
);

const ProfileActiveSessionsContent: React.FC<ProfileActiveSessionsProps> = ({
  userId,
  enabled = true,
  confirmBackdropClassName,
}) => {
  const t = useCultureT();
  const sessionsQuery = useMyAuthSessionsQuery(userId, enabled);
  const revokeSessionMutation = useRevokeAuthSessionMutation();
  const revokeAllMutation = useRevokeAllAuthSessionsMutation();
  const [confirmRevokeAllOpen, setConfirmRevokeAllOpen] = useState(false);
  const [revokingJti, setRevokingJti] = useState<string | null>(null);

  const activeSessions = useMemo(
    () => (sessionsQuery.data ?? []).filter(isActiveSession),
    [sessionsQuery.data],
  );

  const otherActiveCount = activeSessions.filter((session) => !session.isCurrent).length;

  const handleRevokeSession = async (jti: string) => {
    setRevokingJti(jti);
    try {
      await revokeSessionMutation.mutateAsync(jti);
    } finally {
      setRevokingJti(null);
    }
  };

  const handleRevokeAll = async () => {
    try {
      await revokeAllMutation.mutateAsync();
      setConfirmRevokeAllOpen(false);
    } catch {
      // Error surfaced via mutation state if needed.
    }
  };

  return (
    <>
      {otherActiveCount > 0 ? (
        <div className="flex justify-end mb-3">
          <AppButton
            intent="destructive-soft"
            size="sm"
            onClick={() => setConfirmRevokeAllOpen(true)}
          >
            {t(profileKey('actions.signOutOthers'))}
          </AppButton>
        </div>
      ) : null}

      <div className="space-y-2">
        {sessionsQuery.isLoading ? (
          <p className="text-xs text-slate-500">{t(profileKey('loading.sessions'))}</p>
        ) : sessionsQuery.isError ? (
          <p className="text-xs text-rose-600">{t(profileKey('errors.loadSessions'))}</p>
        ) : activeSessions.length === 0 ? (
          <p className="text-xs text-slate-500">{t(profileKey('sessions.none'))}</p>
        ) : (
          activeSessions.map((session) => (
            <div
              key={session.jti}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200/80 bg-white px-3 py-2.5"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold text-slate-800 truncate" title={session.userAgent ?? undefined}>
                    {summarizeUserAgent(session.userAgent, t(profileKey('sessions.unknownDevice')))}
                  </p>
                  {session.isCurrent ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                      {t(profileKey('sessions.currentBadge'))}
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-500">
                  {t(profileKey('sessions.ipPrefix'))} {session.ipAddress?.trim() || t(profileKey('emptyValue'))}
                </p>
                <p className="text-[11px] text-slate-500">
                  {t(profileKey('sessions.startedPrefix'))} {formatSessionDate(session.createdAt)}
                </p>
              </div>

              {!session.isCurrent ? (
                <AppButton
                  intent="destructive-soft"
                  size="icon-sm"
                  aria-label={t(profileKey('actions.revokeSession'))}
                  title={t(profileKey('actions.revokeSession'))}
                  disabled={revokingJti === session.jti || revokeSessionMutation.isPending}
                  onClick={() => {
                    void handleRevokeSession(session.jti);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </AppButton>
              ) : null}
            </div>
          ))
        )}
      </div>

      <RevokeAllConfirmModal
        open={confirmRevokeAllOpen}
        isSaving={revokeAllMutation.isPending}
        onCancel={() => setConfirmRevokeAllOpen(false)}
        onConfirm={() => {
          void handleRevokeAll();
        }}
        backdropClassName={confirmBackdropClassName}
        t={t}
      />
    </>
  );
};

export type ProfileActiveSessionsModalProps = {
  open: boolean;
  userId?: number | null;
  onClose: () => void;
};

export const ProfileActiveSessionsModal: React.FC<ProfileActiveSessionsModalProps> = ({
  open,
  userId,
  onClose,
}) => {
  const t = useCultureT();
  if (!open) {
    return null;
  }

  return (
    <CreateEditModalShell
      size="md"
      backdropClassName="z-[170]"
      title={(
        <span className="inline-flex items-center gap-2">
          <MonitorSmartphone className="w-4 h-4 text-primary-700" />
          {t(profileKey('sections.activeSessions'))}
        </span>
      )}
      onClose={onClose}
      footer={(
        <AppButton intent="cancel" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
          {t(profileKey('actions.close'))}
        </AppButton>
      )}
    >
      <p className="text-xs text-slate-600 mb-4">
        {t(profileKey('modals.activeSessionsIntro'))}
      </p>
      <ProfileActiveSessionsContent
        userId={userId}
        enabled={open}
        confirmBackdropClassName="z-[180]"
      />
    </CreateEditModalShell>
  );
};
