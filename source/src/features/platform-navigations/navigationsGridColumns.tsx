import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { TranslationFn } from "../../core/culture/TranslationRuntime";
import { columnCommonKey } from "../../core/culture/translations/cultureKeyHelpers";
import {
  navigationManifestIdSortKey,
  type NavigationManifestSummary,
} from "../../shared/api/contracts/platform/navigation";
import type { AppTableGridColumnDef } from "../../shared/lib/appTableGridQuery";
import { BuiltInBadge } from "../../shared/ui";
import { ActionTooltip } from "../../shared/ui/ActionTooltip";
import { NativeButton } from "../../shared/ui/NativeButton";
import {
  NAVIGATIONS_ACTION_COLUMN_WIDTH,
  NAVIGATIONS_GRID_ACTION_BUTTON_CLASS,
} from "./constants";

export type NavigationsGridHandlers = {
  onEdit: (row: NavigationManifestSummary) => void;
  onDelete: (row: NavigationManifestSummary) => void;
};

export function createNavigationsGridColumns(
  handlers: NavigationsGridHandlers,
  t: TranslationFn,
): AppTableGridColumnDef<NavigationManifestSummary>[] {
  return [
    {
      id: "id",
      label: t(columnCommonKey('id')),
      filter: false,
      card: { role: 'title' },
      getSortValue: (row) => navigationManifestIdSortKey(row),
      renderCell: (row) => (
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono text-slate-700">{row.id}</code>
          {row.builtIn ? (
            <BuiltInBadge />
          ) : null}
        </div>
      ),
    },
    {
      id: "groups",
      label: t(columnCommonKey('groups')),
      filter: false,
      card: { role: 'field', label: t(columnCommonKey('groups')) },
      getSortValue: (row) => row.groupCount,
      renderCell: (row) => (
        <span className="text-sm text-slate-700">{row.groupCount}</span>
      ),
    },
    {
      id: "items",
      label: t(columnCommonKey('items')),
      filter: false,
      card: { role: 'field', label: t(columnCommonKey('items')) },
      getSortValue: (row) => row.itemCount,
      renderCell: (row) => (
        <span className="text-sm text-slate-700">{row.itemCount}</span>
      ),
    },
    {
      id: "actions",
      label: "",
      sort: false,
      filter: false,
      layout: { hideable: false },
      width: NAVIGATIONS_ACTION_COLUMN_WIDTH,
      headerClassName: "text-end",
      cellClassName: "text-end",
      card: { role: 'actions' },
      renderCell: (row) => (
        <div className="flex items-center justify-end">
          <ActionTooltip content={t('actions.edit')}>
            <NativeButton
              onClick={() => handlers.onEdit(row)}
              className={`${NAVIGATIONS_GRID_ACTION_BUTTON_CLASS} text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50`}
              aria-label={t('actions.edit')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </NativeButton>
          </ActionTooltip>
          <span className="mx-[3px] h-3 border-s border-slate-200" aria-hidden="true" />
          <ActionTooltip content={row.builtIn ? t('grid.hint.navigations.builtinCannotDelete') : t('actions.delete')}>
            <NativeButton
              onClick={() => handlers.onDelete(row)}
              disabled={row.builtIn}
              className={`${NAVIGATIONS_GRID_ACTION_BUTTON_CLASS} text-rose-600 hover:text-rose-700 hover:bg-rose-50 disabled:text-slate-400 disabled:hover:bg-transparent`}
              aria-label={t('actions.delete')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </NativeButton>
          </ActionTooltip>
        </div>
      ),
    },
  ];
}
