import React from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import type { UserRecord } from '@/src/shared/api/queries/users';
import { useOptionalCulture } from '@/src/core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '@/src/core/culture/cultureShellKeys';
import { AppCultureButton, ConfirmDialogShell, DestructiveConfirmBody } from '@/src/shared/ui';
import { formatProfileDisplayName } from '../utils';

export type UserDeleteConfirmModalProps = {
  user: UserRecord | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const UserDeleteConfirmModal: React.FC<UserDeleteConfirmModalProps> = ({
  user,
  isDeleting,
  onCancel,
  onConfirm,
}) => {
  const culture = useOptionalCulture();
  const label = (key: string) => (
    culture?.ready ? culture.t(key) : CULTURE_ACTION_FALLBACK_LABELS[key] ?? key
  );
  const textDir = culture?.direction ?? 'ltr';

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
      footer={(
        <>
          <AppCultureButton intent="cancel" size="sm" onClick={onCancel} disabled={isDeleting} />
          <AppCultureButton
            intent="destructive"
            size="sm"
            onClick={() => void onConfirm()}
            disabled={isDeleting}
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
    </ConfirmDialogShell>
  );
};
