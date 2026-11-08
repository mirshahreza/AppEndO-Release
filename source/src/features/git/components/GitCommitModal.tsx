import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { AppButton, CreateEditModalShell, UiTextarea } from '../../../shared/ui';
import type { GitPageModel } from '../hooks/useGitPage';

type GitCommitModalProps = {
  page: GitPageModel;
};

export const GitCommitModal: React.FC<GitCommitModalProps> = ({ page }) => {
  const [message, setMessage] = useState('');
  const {
    commitModalOpen,
    closeCommitModal,
    executeCommit,
    isCommitting,
    suggestCommitMessage,
  } = page;

  useEffect(() => {
    if (!commitModalOpen) {
      return;
    }

    setMessage('');
    let cancelled = false;
    void (async () => {
      try {
        const suggestion = await suggestCommitMessage();
        if (!cancelled) {
          setMessage(suggestion.message);
        }
      } catch {
        // User can type manually if suggest fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [commitModalOpen, suggestCommitMessage]);

  if (!commitModalOpen) {
    return null;
  }

  return (
    <CreateEditModalShell
      size="md"
      title="Commit changes"
      onClose={closeCommitModal}
      footer={(
        <>
          <AppButton intent="cancel" onClick={closeCommitModal}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="confirm"
            onClick={() => void executeCommit(message)}
            disabled={!message.trim() || isCommitting}
          >
            <Check className="h-3.5 w-3.5" />
            {isCommitting ? 'Confirming…' : 'Confirm'}
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col">
        <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ps-[4px]">
          Commit message
        </label>
        <UiTextarea
          className="mt-[2px]"
          size="sm"
          rows={5}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Describe the changes…"
        />
      </div>
    </CreateEditModalShell>
  );
};
