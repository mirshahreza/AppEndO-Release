import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Check, Plus, X } from 'lucide-react';
import type { IdeaTeamModel } from '../../../shared/api/contracts/idea-foundry/types';
import {
  AppButton,
  CreateEditModalShell,
  DIALOG_NESTED_BACKDROP_Z_CLASS,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { ideaToneChipClass, resolveIdeaModelProviderChrome } from '../ideaFoundryCatalog';

type IdeaTeamModelPickerDialogProps = {
  open: boolean;
  title?: string;
  multiple?: boolean;
  models: readonly IdeaTeamModel[];
  onClose: () => void;
  onPick: (models: IdeaTeamModel[]) => void;
};

export const IdeaTeamModelPickerDialog: React.FC<IdeaTeamModelPickerDialogProps> = ({
  open,
  title = 'Select models',
  multiple = true,
  models,
  onClose,
  onPick,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
  }, [open]);

  const sorted = useMemo(
    () => [...models].sort((left, right) => left.name.localeCompare(right.name)),
    [models],
  );

  if (!open) return null;

  const toggle = (id: string) => {
    if (!multiple) {
      const model = models.find((item) => item.id === id);
      if (model) onPick([model]);
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const picked = sorted.filter((model) => selectedIds.has(model.id));
    if (picked.length === 0) return;
    onPick(picked);
  };

  return (
    <CreateEditModalShell
      size="lg"
      backdropClassName={DIALOG_NESTED_BACKDROP_Z_CLASS}
      title={(
        <span className="flex min-w-0 items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-slate-500" aria-hidden />
          <span className="truncate">{title}</span>
        </span>
      )}
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          {multiple ? (
            <AppButton intent="primary" size="sm" disabled={selectedIds.size === 0} onClick={handleAdd}>
              <Plus className="h-3.5 w-3.5" />
              Add{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
            </AppButton>
          ) : null}
        </>
      )}
    >
      {sorted.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-500">
          {multiple
            ? 'Every enabled model is already on this idea.'
            : 'No other models to choose as lead.'}
        </div>
      ) : (
        <ul className="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {sorted.map((model) => {
            const selected = selectedIds.has(model.id);
            const chrome = resolveIdeaModelProviderChrome(model);
            const Icon = chrome.icon;
            const version = model.modelId?.trim() || null;
            return (
              <li key={model.id}>
                <button
                  type="button"
                  onClick={() => toggle(model.id)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors',
                    selected ? 'bg-indigo-50/80' : 'hover:bg-slate-50',
                  )}
                >
                  {multiple ? (
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                        selected
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-slate-300 bg-white text-transparent',
                      )}
                      aria-hidden
                    >
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                      ideaToneChipClass(chrome.tone),
                    )}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{model.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {chrome.label}{version ? ` · ${version}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </CreateEditModalShell>
  );
};
