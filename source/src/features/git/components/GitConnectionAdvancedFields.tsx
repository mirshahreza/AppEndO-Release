import React from 'react';
import { UiCheckboxChoice, UiInput } from '../../../shared/ui';
import type { GitSettingsFormState } from '../gitSettingsForm';

type GitConnectionAdvancedFieldsProps = {
  form: GitSettingsFormState;
  onFormChange: (next: GitSettingsFormState) => void;
};

export const GitConnectionAdvancedFields: React.FC<GitConnectionAdvancedFieldsProps> = ({
  form,
  onFormChange,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="md:col-span-2 pt-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider ps-[4px]">Advanced</p>
    </div>

    <div className="md:col-span-2">
      <UiCheckboxChoice
        id="git-auto-commit-message"
        checked={form.autoGenerateCommitMessage}
        onChange={(checked) => onFormChange({ ...form, autoGenerateCommitMessage: checked })}
        className="h-10 max-w-xl rounded-md border border-slate-200 px-3"
      >
        <span className="text-sm font-semibold text-slate-700">Auto-generate commit messages</span>
      </UiCheckboxChoice>
    </div>

    <div className="flex flex-col gap-[2px] md:col-span-2">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ps-[4px]">Commit message template prefix</label>
      <UiInput
        value={form.commitMessageTemplate}
        onChange={(event) => onFormChange({ ...form, commitMessageTemplate: event.target.value })}
        placeholder="Optional prefix for suggested messages"
        ariaLabel="Git commit message template"
        size="sm"
      />
    </div>

    <div className="flex flex-col gap-[2px]">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ps-[4px]">GitHub owner</label>
      <UiInput
        value={form.prOwner}
        onChange={(event) => onFormChange({ ...form, prOwner: event.target.value })}
        placeholder="org"
        ariaLabel="GitHub owner"
        size="sm"
        autoDir={false}
      />
    </div>

    <div className="flex flex-col gap-[2px]">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ps-[4px]">GitHub repo</label>
      <UiInput
        value={form.prRepo}
        onChange={(event) => onFormChange({ ...form, prRepo: event.target.value })}
        placeholder="repo"
        ariaLabel="GitHub repository"
        size="sm"
        autoDir={false}
      />
    </div>
  </div>
);
