import React, { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import type { UserRecord } from '../../../shared/api/queries/users';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../../core/culture/cultureShellKeys';
import { USERS_PROFILE_CHANGE_REASON, changeReasonAskIsOn, changeReasonValueSatisfiesPolicy } from '../../../shared/api/contracts/record-events';
import { useNamedApiChangeReasonPolicy } from '../../../shared/api/queries/namedApiChangeReason';
import {
  AppCultureButton,
  ChangeReasonFields,
  ConfirmDialogShell,
  DestructiveConfirmBody,
  emptyChangeReason,
  type ChangeReasonValue,
} from '../../../shared/ui';
import { formatProfileDisplayName } from '../utils';

export type UserDeleteConfirmModalProps = {
  user: UserRecord | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: (reason: ChangeReasonValue) => void;
};

export const UserDeleteConfirmModal: React.FC<UserDeleteConfirmModalProps> = ({
  user,
  isDeleting,
  onCancel,
  onConfirm,
}) => {
  const culture = useOptionalCulture();
  const [reason, setReason] = useState<ChangeReasonValue>(emptyChangeReason());
  const policy = useNamedApiChangeReasonPolicy('DELETE', '/api/users/:id', USERS_PROFILE_CHANGE_REASON);
  const reasonAskOn = changeReasonAskIsOn(policy.reasonAsk);
  const canConfirm = changeReasonValueSatisfiesPolicy(reason, policy);
  const label = (key: string) => (
    culture?.ready ? culture.t(key) : CULTURE_ACTION_FALLBACK_LABELS[key] ?? key
  );
  const textDir = culture?.direction ?? 'ltr';

  useEffect(() => {
    setReason(emptyChangeReason());
  }, [user?.id]);

  if (!user) return null;

  const loginLabel = user.email ?? user.username;
  const displayName = formatProfileDisplayName(user);

  return (
    <ConfirmDialogShell
      size="md"
      title={label('users.deleteTitle')}
      icon={<Trash2 className="h-4 w-4" />}
      onClose={onCancel}
      closeOnEscape={!isDeleting}
      confirmDisabled={!canConfirm}
      footer={(
        <>
          <AppCultureButton intent="cancel" size="sm" onClick={onCancel} disabled={isDeleting} />
          <AppCultureButton
            intent="destructive"
            size="sm"
            onClick={() => {
              if (!canConfirm) return;
              void onConfirm(reason);
            }}
            disabled={isDeleting || !canConfirm}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                {label('actions.delete')}
              </>
            )}
          </AppCultureButton>
        </>
      )}
    >
      <DestructiveConfirmBody
        dir={textDir}
        question={label('users.deleteQuestion')}
        warning={label('users.deleteWarning')}
        entityName={loginLabel}
        entityDetail={`#${user.id}${displayName ? ` · ${displayName}` : ''}`}
      />
      {reasonAskOn ? (
        <div className="mt-4">
          <ChangeReasonFields
            required={policy.reasonAsk === 'required'}
            capture={policy.reasonCapture}
            vocabNodeId={policy.reasonVocabNodeId}
            includeGeneral={policy.reasonIncludeGeneral}
            value={reason}
            onChange={setReason}
          />
        </div>
      ) : null}
    </ConfirmDialogShell>
  );
};
