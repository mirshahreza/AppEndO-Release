import React, { useState } from 'react';
import { Check, GripVertical, Pencil, Trash2, X } from 'lucide-react';
import { ActionTooltip } from '../../../../shared/ui/ActionTooltip';
import { BuiltInBadge } from '../../../../shared/ui';
import { QueryErrorPanel } from '../../../../shared/ui/QueryErrorPanel';
import { cn } from '../../../../lib/utils';
import { useCultureT } from '../../../../core/culture/CultureContext';
import { getUserEditPolicyLabel } from '../../settingsLabelsI18n';
import {
  APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
  APP_TABLE_GRID_CELL_CLIP_CLASS,
  APP_TABLE_GRID_CELL_PR_CLASS,
  APP_TABLE_GRID_HEADER_CELL_CLASS,
  APP_TABLE_GRID_TABLE_CLASS,
  FLOATING_ACTION_SEPARATOR_CLASS,
} from '../../../../shared/ui/surfaceClasses';
import type { SettingsAttributeRecord, AttributeScope } from '../../../../shared/api/contracts/attributes/types';
import {
  ACTION_BUTTON_BASE_CLASS,
  ACTION_COLUMN_WIDTH,
} from './constants';
import { getSettingsTypographyForAttributeScope } from '../../settingsSectionTypography';
import { displayLabel, displaySource, formatDateYmd } from './utils';

type ReorderDropPosition = 'before' | 'after';

/** Fixed widths for `table-fixed` — Label column has no width so it absorbs leftover space. */
const GRID_COL = {
  reorder: 32,
  rowId: 52,
  key: 220,
  source: 96,
  cardinality: 120,
  visibility: 96,
  userEditPolicy: 152,
  active: 68,
} as const;

const GRID_LABEL_MIN_WIDTH = 160;

const settingsAttributesTableMinWidth = (
  scope: AttributeScope,
  includeReorder: boolean,
): number => (
  GRID_COL.rowId
  + GRID_COL.key
  + GRID_LABEL_MIN_WIDTH
  + GRID_COL.source
  + GRID_COL.cardinality
  + GRID_COL.visibility
  + GRID_COL.active
  + APP_TABLE_GRID_AUDIT_COLUMN_WIDTH * 2
  + ACTION_COLUMN_WIDTH
  + (scope === 'USER' ? GRID_COL.userEditPolicy : 0)
  + (includeReorder ? GRID_COL.reorder : 0)
);

const BODY_CELL_CLASS = cn(
  APP_TABLE_GRID_CELL_PR_CLASS,
  'min-w-0 overflow-hidden align-middle py-2.5 text-start',
);

export type SettingsAttributesTableGridProps = {
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  definitions: SettingsAttributeRecord[];
  canReorder?: boolean;
  isReordering?: boolean;
  onReorder?: (orderedIds: number[]) => void | Promise<void>;
  renderActorLabel: (username?: string | null, actorId?: number | null) => React.ReactNode;
  onEdit: (record: SettingsAttributeRecord) => void;
  onDelete: (id: number) => void;
  scope: AttributeScope;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
};

export const SettingsAttributesTableGrid: React.FC<SettingsAttributesTableGridProps> = ({
  isLoading,
  isError,
  error,
  onRetry,
  isRetrying = false,
  definitions,
  canReorder = false,
  isReordering = false,
  onReorder,
  renderActorLabel,
  onEdit,
  onDelete,
  scope,
  onScroll,
}) => {
  const t = useCultureT();
  const typo = getSettingsTypographyForAttributeScope(scope);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<ReorderDropPosition>('before');

  const clearDragState = () => {
    setDraggingId(null);
    setDropTargetId(null);
    setDropPosition('before');
  };

  const resolveDropPosition = (
    event: React.DragEvent<HTMLTableRowElement>,
  ): ReorderDropPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = (event.clientY - rect.top) / Math.max(rect.height, 1);
    return relativeY < 0.5 ? 'before' : 'after';
  };

  const commitReorder = async (
    sourceId: number,
    targetId: number,
    position: ReorderDropPosition,
  ) => {
    if (!onReorder || sourceId === targetId) {
      clearDragState();
      return;
    }

    const currentIds = definitions.map((record) => Number(record.id));
    const sourceIndex = currentIds.indexOf(sourceId);
    let targetIndex = currentIds.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) {
      clearDragState();
      return;
    }

    if (position === 'after') {
      targetIndex += 1;
    }

    const nextIds = [...currentIds];
    const [moved] = nextIds.splice(sourceIndex, 1);
    if (sourceIndex < targetIndex) {
      targetIndex -= 1;
    }
    nextIds.splice(targetIndex, 0, moved);

    clearDragState();
    await onReorder(nextIds);
  };

  return (
    <div className="flex-1 overflow-auto" onScroll={onScroll}>
      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-sm text-slate-400">{t('settingsAttributes.grid.loading')}</div>
      ) : isError && error ? (
        <QueryErrorPanel
          message={t('settingsAttributes.grid.loadFailed')}
          detail={error}
          onRetry={onRetry}
          isRetrying={isRetrying}
        />
      ) : definitions.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-sm text-slate-400">{t('settingsAttributes.grid.empty')}</div>
      ) : (
        <table
          className={cn(APP_TABLE_GRID_TABLE_CLASS, 'text-xs')}
          style={{ minWidth: settingsAttributesTableMinWidth(scope, canReorder) }}
        >
          <colgroup>
            {canReorder ? <col style={{ width: GRID_COL.reorder }} /> : null}
            <col style={{ width: GRID_COL.rowId }} />
            <col style={{ width: GRID_COL.key }} />
            <col />
            <col style={{ width: GRID_COL.source }} />
            <col style={{ width: GRID_COL.cardinality }} />
            <col style={{ width: GRID_COL.visibility }} />
            {scope === 'USER' ? <col style={{ width: GRID_COL.userEditPolicy }} /> : null}
            <col style={{ width: GRID_COL.active }} />
            <col style={{ width: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH }} />
            <col style={{ width: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH }} />
            <col style={{ width: ACTION_COLUMN_WIDTH }} />
          </colgroup>
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
            <tr>
              {canReorder ? (
                <th
                  className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'text-center')}
                  aria-label={t('settings.ui.reorder')}
                />
              ) : null}
              <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'text-center')}>{t('columns.common.rowNumber')}</th>
              <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'text-start')}>{t('columns.common.key')}</th>
              <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'text-start')}>{t('columns.common.label')}</th>
              <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'text-start')}>{t('columns.common.source')}</th>
              <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'text-start')}>{t('settingsAttributes.grid.cardinality')}</th>
              <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'text-start')}>{t('settingsAttributes.grid.visibility')}</th>
              {scope === 'USER' ? (
                <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'text-start')}>
                  {t('settingsAttributes.grid.userEditPolicy')}
                </th>
              ) : null}
              <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'text-center')}>{t('settingsAttributes.grid.active')}</th>
              <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'text-center')}>{t('columns.common.created')}</th>
              <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'text-center')}>{t('columns.common.updated')}</th>
              <th
                className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'text-end')}
                style={{ width: ACTION_COLUMN_WIDTH, minWidth: ACTION_COLUMN_WIDTH, maxWidth: ACTION_COLUMN_WIDTH }}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {definitions.map((record) => {
              const recordId = Number(record.id);
              const isDragSource = draggingId === recordId;
              const isDropTarget = dropTargetId === recordId;
              const showDropBefore = isDropTarget && dropPosition === 'before';
              const showDropAfter = isDropTarget && dropPosition === 'after';

              return (
                <tr
                  key={record.id}
                  draggable={canReorder && !isReordering}
                  onDragStart={(event) => {
                    if (!canReorder || isReordering) return;
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(recordId));
                    setDraggingId(recordId);
                  }}
                  onDragEnd={clearDragState}
                  onDragOver={(event) => {
                    if (!draggingId || !canReorder || isReordering) return;
                    if (draggingId === recordId) return;
                    event.preventDefault();
                    setDropTargetId(recordId);
                    setDropPosition(resolveDropPosition(event));
                  }}
                  onDrop={(event) => {
                    if (!canReorder || isReordering) return;
                    event.preventDefault();
                    const sourceId = draggingId ?? Number(event.dataTransfer.getData('text/plain'));
                    if (!Number.isInteger(sourceId) || sourceId <= 0) return;
                    const nextDropPosition = resolveDropPosition(event);
                    void commitReorder(sourceId, recordId, nextDropPosition);
                  }}
                  className={cn(
                    'relative hover:bg-slate-50 transition-colors',
                    canReorder && !isReordering ? 'cursor-move' : '',
                    isDragSource ? 'opacity-50' : '',
                    isDropTarget ? 'bg-indigo-50/40' : '',
                    showDropBefore ? 'border-t-[3px] border-indigo-500' : '',
                    showDropAfter ? 'border-b-[3px] border-indigo-500' : '',
                  )}
                >
                  {canReorder ? (
                    <td className={cn(BODY_CELL_CLASS, 'text-center text-slate-400')}>
                      <GripVertical className="mx-auto w-3.5 h-3.5" aria-hidden="true" />
                    </td>
                  ) : null}
                  <td className={cn(BODY_CELL_CLASS, 'text-center font-mono tabular-nums', typo.gridMono)}>
                    {record.id}
                  </td>
                  <td className={BODY_CELL_CLASS}>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={cn(APP_TABLE_GRID_CELL_CLIP_CLASS, 'font-mono', typo.gridPrimary)}
                        title={record.key}
                      >
                        {record.key}
                      </span>
                      {record.is_builtin ? (
                        <span className="shrink-0">
                          <BuiltInBadge />
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className={BODY_CELL_CLASS}>
                    <span
                      className={cn(APP_TABLE_GRID_CELL_CLIP_CLASS, 'text-sm text-slate-700')}
                      title={displayLabel(record, t)}
                    >
                      {displayLabel(record, t)}
                    </span>
                  </td>
                  <td className={cn(BODY_CELL_CLASS, 'text-slate-600')}>
                    <span className={APP_TABLE_GRID_CELL_CLIP_CLASS} title={displaySource(record)}>
                      {displaySource(record)}
                    </span>
                  </td>
                  <td className={cn(BODY_CELL_CLASS, 'text-slate-600')}>
                    <span
                      className={APP_TABLE_GRID_CELL_CLIP_CLASS}
                      title={
                        record.cardinality === 'multi' && record.max_selections
                          ? `${record.cardinality} (max ${record.max_selections})`
                          : record.cardinality
                      }
                    >
                      {record.cardinality}
                      {record.cardinality === 'multi' && record.max_selections
                        ? ` (max ${record.max_selections})`
                        : ''}
                    </span>
                  </td>
                  <td className={cn(BODY_CELL_CLASS, 'text-slate-600')}>
                    <span className={APP_TABLE_GRID_CELL_CLIP_CLASS} title={record.visibility}>
                      {record.visibility}
                    </span>
                  </td>
                  {scope === 'USER' ? (
                    <td className={cn(BODY_CELL_CLASS, 'text-slate-600')}>
                      <span
                        className={APP_TABLE_GRID_CELL_CLIP_CLASS}
                        title={getUserEditPolicyLabel(
                          t,
                          record.user_edit_policy ?? (record.user_editable ? 'WHEN_EMPTY' : 'NONE'),
                        )}
                      >
                        {getUserEditPolicyLabel(
                          t,
                          record.user_edit_policy ?? (record.user_editable ? 'WHEN_EMPTY' : 'NONE'),
                        )}
                      </span>
                    </td>
                  ) : null}
                  <td className={cn(BODY_CELL_CLASS, 'text-center')}>
                    {record.is_active ? (
                      <Check className="mx-auto w-3.5 h-3.5 text-emerald-700" aria-label="Active" />
                    ) : (
                      <X className="mx-auto w-3.5 h-3.5 text-rose-700" aria-label="Inactive" />
                    )}
                  </td>
                  <td className={cn(BODY_CELL_CLASS, 'text-center text-slate-400 font-mono tabular-nums')}>
                    {record.created_at ? formatDateYmd(record.created_at) : '-'}
                  </td>
                  <td className={cn(BODY_CELL_CLASS, 'text-center text-slate-400 font-mono tabular-nums')}>
                    {record.updated_at ? formatDateYmd(record.updated_at) : '-'}
                  </td>
                  <td
                    className={cn(BODY_CELL_CLASS, 'text-end')}
                    style={{ width: ACTION_COLUMN_WIDTH, minWidth: ACTION_COLUMN_WIDTH, maxWidth: ACTION_COLUMN_WIDTH }}
                  >
                    <div className="flex items-center justify-end">
                      <ActionTooltip content="Edit">
                        <button
                          onClick={() => onEdit(record)}
                          className={`${ACTION_BUTTON_BASE_CLASS} text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50`}
                          aria-label="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </ActionTooltip>
                      <span className={FLOATING_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
                      <ActionTooltip content={record.is_builtin ? 'Built-in attribute cannot be deleted' : 'Delete'}>
                        <button
                          onClick={() => onDelete(record.id)}
                          disabled={record.is_builtin}
                          className={`${ACTION_BUTTON_BASE_CLASS} ${
                            record.is_builtin
                              ? 'text-slate-400 cursor-not-allowed'
                              : 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                          }`}
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </ActionTooltip>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};
