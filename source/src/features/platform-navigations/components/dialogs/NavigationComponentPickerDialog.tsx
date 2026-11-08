import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { AppButton, CreateEditModalShell, UiInput } from '../../../../shared/ui';
import { APP_TABLE_GRID_CELL_PR_CLASS, APP_TABLE_GRID_HEADER_CELL_CLASS, APP_TABLE_GRID_TABLE_CLASS } from '../../../../shared/ui/surfaceClasses';
import { cn } from '../../../../lib/utils';
import type { NavigationComponentOption } from '../../hooks/useNavigationEditorOptions';
import {
  navigationComponentKindLabel,
} from '../../hooks/useNavigationEditorOptions';

type NavigationComponentPickerDialogProps = {
  open: boolean;
  components: NavigationComponentOption[];
  selectedPageKey?: string;
  onClose: () => void;
  onSelect: (pageKey: string) => void;
};

export const NavigationComponentPickerDialog: React.FC<NavigationComponentPickerDialogProps> = ({
  open,
  components,
  selectedPageKey,
  onClose,
  onSelect,
}) => {
  const [search, setSearch] = useState('');

  const filteredComponents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return components;
    }

    return components.filter((component) => (
      component.pageKey.toLowerCase().includes(needle)
      || component.title.toLowerCase().includes(needle)
      || component.loaderRef.toLowerCase().includes(needle)
      || navigationComponentKindLabel(component.kind).toLowerCase().includes(needle)
    ));
  }, [components, search]);

  if (!open) {
    return null;
  }

  const handleSelect = (pageKey: string) => {
    onSelect(pageKey);
    setSearch('');
    onClose();
  };

  return (
    <CreateEditModalShell
      size="2xl"
      title="Select component"
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <AppButton intent="cancel" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
          Cancel
        </AppButton>
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-[2px]">
          <label className="ps-[4px] text-sm text-slate-600">Search</label>
          <UiInput
            size="sm"
            value={search}
            placeholder="Title, page key, path, or source…"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-200">
          <table className={cn(APP_TABLE_GRID_TABLE_CLASS, 'border-collapse')}>
            <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
              <tr>
                <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'py-2')}>Title</th>
                <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'py-2 w-[140px]')}>Page key</th>
                <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'py-2 w-[100px]')}>Source</th>
                <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'py-2 w-[180px]')}>Path</th>
              </tr>
            </thead>
            <tbody>
              {filteredComponents.map((component) => {
                const isSelected = component.pageKey === selectedPageKey?.trim();
                return (
                  <tr
                    key={component.pageKey}
                    className={cn(
                      'cursor-pointer border-b border-slate-100 transition-colors hover:bg-indigo-50/60',
                      isSelected ? 'bg-indigo-50/80' : '',
                    )}
                    onClick={() => handleSelect(component.pageKey)}
                  >
                    <td className={cn(APP_TABLE_GRID_CELL_PR_CLASS, 'py-2 text-sm font-medium text-slate-800')}>
                      {component.title}
                    </td>
                    <td className={cn(APP_TABLE_GRID_CELL_PR_CLASS, 'py-2 font-mono text-[11px] text-slate-600')}>
                      {component.pageKey}
                    </td>
                    <td className={cn(APP_TABLE_GRID_CELL_PR_CLASS, 'py-2 text-xs text-slate-600')}>
                      {navigationComponentKindLabel(component.kind)}
                    </td>
                    <td className={cn(APP_TABLE_GRID_CELL_PR_CLASS, 'py-2 font-mono text-[11px] text-slate-500')}>
                      {component.loaderRef}
                    </td>
                  </tr>
                );
              })}
              {filteredComponents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">
                    No matching components.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </CreateEditModalShell>
  );
};
