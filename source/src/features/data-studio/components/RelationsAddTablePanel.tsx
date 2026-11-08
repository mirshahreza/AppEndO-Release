import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Table2 } from 'lucide-react';
import type { EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import {
  AppSearchBox,
  FloatingPanelShell,
  TOOLBOX_PANEL_SEARCH_HOST_CLASS,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';

type PeerModel = Pick<
  EdgeModelDefinition,
  'id' | 'objectName' | 'labels' | 'objectType' | 'columns'
>;

type RelationsAddTablePanelProps = {
  open: boolean;
  onClose: () => void;
  peerModels: ReadonlyArray<PeerModel>;
  /** Object names already present on the diagram. */
  presentObjectNames: ReadonlySet<string>;
  zIndex?: number;
  onAdd: (objectNames: string[]) => void;
};

const PANEL_BOUNDS = {
  minWidth: 280,
  maxWidth: 480,
  minHeight: 320,
  maximizeInset: 24,
};

const dedupePeersByObjectName = (peers: ReadonlyArray<PeerModel>): PeerModel[] => {
  const byName = new Map<string, PeerModel>();
  for (const model of peers) {
    const key = model.objectName.trim().toLowerCase();
    if (!key || byName.has(key)) {
      continue;
    }
    byName.set(key, model);
  }
  return [...byName.values()].sort((left, right) => (
    (left.labels.title || left.objectName).localeCompare(right.labels.title || right.objectName)
  ));
};

export const RelationsAddTablePanel: React.FC<RelationsAddTablePanelProps> = ({
  open,
  onClose,
  peerModels,
  presentObjectNames,
  zIndex,
  onAdd,
}) => {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  const candidates = useMemo(
    () => dedupePeersByObjectName(peerModels).filter(
      (model) => !presentObjectNames.has(model.objectName),
    ),
    [peerModels, presentObjectNames],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return candidates;
    }
    return candidates.filter((model) => {
      const title = (model.labels.title || '').toLowerCase();
      const objectName = model.objectName.toLowerCase();
      return title.includes(needle) || objectName.includes(needle);
    });
  }, [candidates, search]);

  return (
    <FloatingPanelShell
      open={open}
      onClose={onClose}
      title="Add table"
      titleIcon={<Table2 className="h-3.5 w-3.5 text-violet-600" />}
      bounds={PANEL_BOUNDS}
      defaultWidth={340}
      defaultHeight={440}
      initialPosition="center"
      dragFromHeaderOnly
      enableDrag
      enableResize
      enableMaximize
      enterScale={false}
      stackLayer={1}
      zIndex={zIndex}
      borderClassName="border-2 border-violet-200/70"
      headerClassName="h-9 border-b border-slate-200 bg-white px-3"
      titleClassName="text-xs font-semibold tracking-tight text-violet-950"
      headerBand={(
        <div className={TOOLBOX_PANEL_SEARCH_HOST_CLASS}>
          <AppSearchBox
            value={search}
            onChange={setSearch}
            placeholder="Title or table name…"
            ariaLabel="Search tables"
            className="!min-h-0 gap-1.5 px-2 py-1 [&>svg:first-child]:h-3 [&>svg:first-child]:w-3"
          />
        </div>
      )}
    >
      <div className="flex h-full min-h-0 flex-col bg-white">
        <div className="min-h-0 flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-slate-500">
              {candidates.length === 0
                ? 'Every available Edge model is already on the diagram, or none exist yet.'
                : `No tables match “${search.trim()}”.`}
            </div>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((model) => {
                const title = model.labels.title?.trim() || model.objectName;
                const showObjectName = title.toLowerCase() !== model.objectName.toLowerCase();
                return (
                  <li key={model.objectName}>
                    <button
                      type="button"
                      onClick={() => onAdd([model.objectName])}
                      className={cn(
                        'flex w-full items-center gap-2 border-b border-slate-100 px-2.5 py-2 text-left transition-colors',
                        'hover:bg-violet-50/80 last:border-b-0',
                      )}
                    >
                      <Table2 className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-slate-800">
                          {title}
                        </span>
                        {showObjectName ? (
                          <span className="block truncate font-mono text-[10px] text-slate-500">
                            {model.objectName}
                          </span>
                        ) : null}
                      </span>
                      <Plus className="h-3.5 w-3.5 shrink-0 text-violet-500" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {candidates.length > 0 ? (
          <p className="shrink-0 border-t border-slate-100 px-2.5 py-1.5 text-[10px] text-slate-500">
            Click a row to add it to the diagram.
          </p>
        ) : null}
      </div>
    </FloatingPanelShell>
  );
};
