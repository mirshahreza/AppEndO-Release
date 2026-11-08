import React, { useMemo } from 'react';
import { Eye, Trash2 } from 'lucide-react';
import type { EdgeModelAssociation, EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import type { SchemaRelationEdge } from '../../../shared/api/contracts/data-sources/schemaRelations';
import { NativeButton } from '../../../shared/ui';
import {
  buildRelationsDatasheetRows,
  type RelationsDatasheetRow,
} from '../lib/relationsDatasheetRows';

type EdgeModelRelationsDatasheetProps = {
  dataSourceId: string;
  dataSourceName: string;
  dataSourceType: string | null;
  objectName: string;
  objectType: 'TABLE' | 'VIEW';
  physicalRelations: SchemaRelationEdge[];
  associations: EdgeModelAssociation[];
  peerModels: ReadonlyArray<Pick<EdgeModelDefinition, 'id' | 'objectName' | 'labels'>>;
  isLoading?: boolean;
  canEditLogical: boolean;
  isAssociationLocked: (associationId: string) => boolean;
  onEditLogical: (association: EdgeModelAssociation) => void;
  onDeleteLogical: (association: EdgeModelAssociation) => void;
  onDeleteBoth?: (association: EdgeModelAssociation, relation: SchemaRelationEdge) => void;
  onEditPhysical?: (relation: SchemaRelationEdge) => void;
  onPhysicalChanged?: () => void;
};

const natureBadge = (nature: RelationsDatasheetRow['nature']) => {
  // Twin physical+logical shows as Physical (same as the diagram nature line).
  if (nature === 'logical') {
    return {
      className: 'bg-teal-50 text-teal-700',
      label: 'Logical',
    };
  }
  return {
    className: 'bg-violet-50 text-violet-700',
    label: 'Physical',
  };
};

export const EdgeModelRelationsDatasheet: React.FC<EdgeModelRelationsDatasheetProps> = ({
  dataSourceName,
  objectName,
  physicalRelations,
  associations,
  peerModels,
  isLoading = false,
  canEditLogical,
  isAssociationLocked,
  onEditLogical,
  onDeleteLogical,
  onDeleteBoth,
  onEditPhysical,
}) => {
  const rows = useMemo(
    () => buildRelationsDatasheetRows({
      objectName,
      physicalRelations,
      associations,
      peerModels,
    }),
    [associations, objectName, peerModels, physicalRelations],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center border-b border-slate-100 px-3 py-2">
        <p className="text-[11px] text-slate-500">
          {dataSourceName}
          {' · '}
          Physical and logical relations for this table.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full text-left text-[11px]">
          <thead className="sticky top-0 z-[1] bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Nature</th>
              <th className="px-3 py-2 font-semibold">Cascade</th>
              <th className="px-3 py-2 font-semibold">From</th>
              <th className="px-3 py-2 font-semibold">To</th>
              <th className="px-3 py-2 text-end font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const badge = natureBadge(row.nature);
              const canMutateLogical = row.nature !== 'physical'
                && canEditLogical
                && !isAssociationLocked(row.association.id);
              return (
                <tr
                  key={row.key}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/80"
                >
                  <td className="px-3 py-2 font-semibold text-slate-800">{row.name}</td>
                  <td className="px-3 py-2 text-slate-600">{row.kindLabel}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-slate-600">
                    {row.cascadeLabel ?? '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-slate-600">{row.fromLabel}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-slate-600">{row.toLabel}</td>
                  <td className="px-3 py-2 text-end">
                    {row.nature === 'physical' ? (
                      onEditPhysical ? (
                        <NativeButton
                          type="button"
                          aria-label={`View ${row.name}`}
                          title="View physical relation"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                          onClick={() => onEditPhysical(row.relation)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </NativeButton>
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )
                    ) : canMutateLogical ? (
                      <div className="inline-flex items-center gap-0.5">
                        <NativeButton
                          type="button"
                          aria-label={`View ${row.association.as}`}
                          title={row.nature === 'both' ? 'View relation' : 'View logical relation'}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                          onClick={() => onEditLogical(row.association)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </NativeButton>
                        <NativeButton
                          type="button"
                          aria-label={`Delete ${row.association.as}`}
                          title={row.nature === 'both' ? 'Delete relation' : 'Delete logical relation'}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50"
                          onClick={() => {
                            if (row.nature === 'both' && onDeleteBoth) {
                              onDeleteBoth(row.association, row.relation);
                              return;
                            }
                            onDeleteLogical(row.association);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </NativeButton>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-slate-500">
                  No relations yet. Use Add relation, or connect tables on the diagram.
                </td>
              </tr>
            ) : null}
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-violet-600/80">
                  Loading relations…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
};
