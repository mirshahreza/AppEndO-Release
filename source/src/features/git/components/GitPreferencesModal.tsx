import React from 'react';
import { LogOut, Save, Upload, Wifi } from 'lucide-react';
import { AppButton, AppToast, CreateEditModalShell } from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { useGitStatusQuery } from '../../../shared/api/queries/git';
import type { GitPreferencesModel } from '../hooks/useGitPreferences';
import { GitConnectionAdvancedFields } from './GitConnectionAdvancedFields';
import { GitNativeStatusFields } from './GitNativeStatusFields';

type GitPreferencesModalProps = {
  open: boolean;
  preferences: GitPreferencesModel;
  onClose: () => void;
  onSaved?: () => void;
  showDisconnect?: boolean;
  disconnectLabel?: string;
  onDisconnect?: () => void;
  isDisconnecting?: boolean;
  showConnectRemotePrompt?: boolean;
  onConnectRemote?: () => void;
};

export const GitPreferencesModal: React.FC<GitPreferencesModalProps> = ({
  open,
  preferences,
  onClose,
  onSaved,
  showDisconnect = false,
  disconnectLabel = 'GitHub',
  onDisconnect,
  isDisconnecting = false,
  showConnectRemotePrompt = false,
  onConnectRemote,
}) => {
  const statusQuery = useGitStatusQuery();

  if (!open) {
    return null;
  }

  const handleSave = async () => {
    const saved = await preferences.handleSave();
    if (saved) {
      onSaved?.();
    }
  };

  const handleConnectRemote = () => {
    onClose();
    onConnectRemote?.();
  };

  return (
    <>
      <CreateEditModalShell
        size="2xl"
        title="Git preferences"
        onClose={onClose}
        onBackdropClick={onClose}
        footer={(
          <div className="flex w-full items-center justify-end gap-2">
            <AppButton
              intent="utility"
              size="sm"
              onClick={() => { void preferences.handleTest(); }}
              disabled={preferences.isTesting || preferences.isSaving}
            >
              <Wifi className={cn('w-3.5 h-3.5', preferences.isTesting && 'animate-pulse')} />
              Test connection
            </AppButton>
            <AppButton
              intent="primary"
              size="sm"
              onClick={() => { void handleSave(); }}
              disabled={!preferences.isDirty || preferences.isSaving}
            >
              <Save className="w-3.5 h-3.5" />
              {preferences.isSaving ? 'Saving…' : 'Save preferences'}
            </AppButton>
          </div>
        )}
      >
        {preferences.formError ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {preferences.formError}
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {showConnectRemotePrompt && onConnectRemote ? (
            <AppButton intent="secondary" size="sm" onClick={handleConnectRemote}>
              <Upload className="w-3.5 h-3.5" />
              Connect to Remote
            </AppButton>
          ) : null}
          {showDisconnect && onDisconnect ? (
            <AppButton
              intent="cancel"
              size="sm"
              onClick={onDisconnect}
              disabled={isDisconnecting}
            >
              <LogOut className="w-3.5 h-3.5" />
              {isDisconnecting ? 'Disconnecting…' : `Disconnect from ${disconnectLabel}`}
            </AppButton>
          ) : null}
        </div>

        <GitNativeStatusFields status={statusQuery.data} />

        <GitConnectionAdvancedFields
          form={preferences.draftForm}
          onFormChange={preferences.setDraftForm}
        />
      </CreateEditModalShell>

      {preferences.testMessage ? (
        <AppToast type={preferences.testMessage.type} text={preferences.testMessage.text} />
      ) : null}
    </>
  );
};
