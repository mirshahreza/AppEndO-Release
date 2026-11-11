import React from 'react';
import { Loader2, Lock, LockOpen } from 'lucide-react';
import type { UserRecord } from '@/src/shared/api/queries/users';
import { useOptionalCulture } from '@/src/core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '@/src/core/culture/cultureShellKeys';
import { AppCultureButton, ConfirmDialogShell, DestructiveConfirmBody } from '@/src/shared/ui';
import { formatProfileDisplayName } from '../utils';

export type UserLockConfirmModalProps = {
  user: UserRecord | null;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const UserLockConfirmModal: React.FC<UserLockConfirmModalProps> = ({
  user,
  isSaving,
  onCancel,
  onConfirm,
}) => {
  const culture = useOptionalCulture();
  const label = (key: string) => (
    culture?.ready ? culture.t(key) : CULTURE_ACTION_FALLBACK_LABELS[key] ?? key
  );
  const textDir = culture?.direction ?? 'ltr';

  if (!user) return null;

  const nextLocked = !user.locked;
  const loginLabel = user.email ?? user.username;
  const displayName = formatProfileDisplayName(user);

  return (
    <ConfirmDialogShell
      size="md"
      tone="default"
      title={label(nextLocked ? 'users.lockTitle' : 'users.unlockTitle')}
      icon={nextLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
      iconToneClassName={nextLocked ? 'text-amber-600' : 'text-emerald-600'}
      onClose={onCancel}
      closeOnEscape={!isSaving}
      footer={(
        <>
          <AppCultureButton intent="cancel" size="sm" onClick={onCancel} disabled={isSaving} />
          <AppCultureButton
            intent={nextLocked ? 'warning' : 'confirm'}
            size="sm"
            onClick={() => void onConfirm()}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {label(nextLocked ? 'users.lockProcessing' : 'users.unlockProcessing')}
              </>
            ) : (
              <>
                {nextLocked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <LockOpen className="h-3.5 w-3.5" />
                )}
                {label(nextLocked ? 'actions.lock' : 'actions.unlock')}
              </>
            )}
          </AppCultureButton>
        </>
      )}
    >
      <DestructiveConfirmBody
        dir={textDir}
        question={label(nextLocked ? 'users.lockQuestion' : 'users.unlockQuestion')}
        warning={label(nextLocked ? 'users.lockWarning' : 'users.unlockWarning')}
        entityName={loginLabel}
        entityDetail={`#${user.id}${displayName ? ` · ${displayName}` : ''}`}
      />
    </ConfirmDialogShell>
  );
};
