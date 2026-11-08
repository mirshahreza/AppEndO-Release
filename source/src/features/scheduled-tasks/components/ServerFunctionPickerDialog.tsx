import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { AppButton } from '../../../shared/ui/AppButton';
import { CreateEditModalShell } from '../../../shared/ui/CreateEditModalShell';
import { UiInput } from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';

export type ServerFunctionPickerItem = {
  id: string;
  name: string;
  method: string;
  path: string;
};

export type ServerFunctionPickerDialogProps = {
  open: boolean;
  functions: ServerFunctionPickerItem[];
  selectedId: string;
  onClose: () => void;
  onSelect: (functionId: string) => void;
};

export const ServerFunctionPickerDialog: React.FC<ServerFunctionPickerDialogProps> = ({
  open,
  functions,
  selectedId,
  onClose,
  onSelect,
}) => {
  const t = useCultureT();
  const [search, setSearch] = useState('');

  const filteredFunctions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return functions;
    return functions.filter((item) => (
      item.id.toLowerCase().includes(needle)
      || item.name.toLowerCase().includes(needle)
      || item.path.toLowerCase().includes(needle)
      || item.method.toLowerCase().includes(needle)
    ));
  }, [functions, search]);

  if (!open) return null;

  const handleSelect = (functionId: string) => {
    onSelect(functionId);
    onClose();
  };

  return (
    <CreateEditModalShell
      size="2xl"
      title={t(operationsKey('scheduler.functionPickerTitle'))}
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <AppButton intent="cancel" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
          {t('actions.cancel')}
        </AppButton>
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-[2px]">
          <label className="ps-[4px] text-sm text-slate-600">{t(operationsKey('common.search'))}</label>
          <UiInput
            size="sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t(operationsKey('scheduler.functionPickerSearch'))}
            ariaLabel={t(operationsKey('scheduler.functionPickerSearchAria'))}
          />
        </div>

        <div className="max-h-[min(52vh,420px)] overflow-auto rounded-lg border border-slate-200">
          {filteredFunctions.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              {t(operationsKey('common.noMatchingFunctions'))}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredFunctions.map((item) => {
                const isSelected = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={cn(
                        'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors',
                        isSelected ? 'bg-indigo-50/80' : 'hover:bg-slate-50',
                      )}
                    >
                      <Search className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        isSelected ? 'text-indigo-600' : 'text-slate-400',
                      )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{item.id}</span>
                        <span className="block truncate text-xs text-slate-500">{item.name}</span>
                        <span className="mt-0.5 block truncate font-mono text-xs text-slate-600">
                          {item.method} {item.path}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </CreateEditModalShell>
  );
};
