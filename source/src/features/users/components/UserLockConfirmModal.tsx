import React from 'react';
import { Loader2, Lock, LockOpen } from 'lucide-react';
import type { UserRecord } from '../../../shared/api/queries/users';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../../core/culture/cultureShellKeys';
import {
  AppCultureButton,
  ChangeReasonFields,
  ConfirmDialogShell,
  DestructiveConfirmBody,
  type ChangeReasonValue,
} from '../../../shared/ui';
import {
  RECORD_CHANGE_REASON_LOCK,
  RECORD_CHANGE_REASON_UNLOCK,
  USERS_LOCK_CHANGE_REASON,
  changeReasonValueSatisfiesPolicy,
} from '../../../shared/api/contracts/record-events';
import { useNamedApiChangeReasonPolicy } from '../../../shared/api/queries/namedApiChangeReason';
import { formatProfileDisplayName } from '../utils';

export type UserLockConfirmModalProps = {
  user: UserRecord | null;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: (reason: ChangeReasonValue) => void;
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
  const policy = useNamedApiChangeReasonPolicy('PATCH', '/api/users/:id/locked', USERS_LOCK_CHANGE_REASON);
  const [reason, setReason] = React.useState<ChangeReasonValue>({
    code: user?.locked ? RECORD_CHANGE_REASON_UNLOCK : RECORD_CHANGE_REASON_LOCK,
    text: '',
  });

  const reasonRequired = policy.reasonAsk === 'required';
  const canConfirm = changeReasonValueSatisfiesPolicy(reason, policy);

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
            onClick={() => void onConfirm(reason)}
            disabled={isSaving || !canConfirm}
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
      <div className="flex flex-col gap-3">
        <DestructiveConfirmBody
          dir={textDir}
          question={label(nextLocked ? 'users.lockQuestion' : 'users.unlockQuestion')}
          warning={label(nextLocked ? 'users.lockWarning' : 'users.unlockWarning')}
          entityName={loginLabel}
          entityDetail={`#${user.id}${displayName ? ` · ${displayName}` : ''}`}
        />
        <ChangeReasonFields
          required={reasonRequired}
          capture={policy.reasonCapture}
          vocabNodeId={policy.reasonVocabNodeId}
          includeGeneral={policy.reasonIncludeGeneral}
          value={reason}
          onChange={setReason}
        />
      </div>
    </ConfirmDialogShell>
  );
};
