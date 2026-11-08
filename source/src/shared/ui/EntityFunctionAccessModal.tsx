import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import {
  compareEntityFunctionAccessEntries,
  sortEntityFunctionAccessEntries,
  type EntityFunctionAccessDecision,
  type EntityFunctionAccessEntry,
  type FunctionAccessEntityKind,
} from '../api/contracts/server-functions/entityAccess';
import {
  useEntityFunctionAccessQuery,
  useReplaceEntityFunctionAccessMutation,
} from '../api/queries/functionEntityAccess';
import { cn } from '../../lib/utils';
import { AppSearchBox } from './AppSearchBox';
import { CreateEditModalShell } from './CreateEditModalShell';
import { NativeButton } from './NativeButton';
import { FunctionAccessActionIcon } from './functionAccessGridActions';
import {
  APP_SURFACE_BOX_TONE_CLASS,
  type AppSurfaceBoxTone,
} from './surfaceClasses';

const FOLDER_PANEL_TONES: AppSurfaceBoxTone[] = ['indigo', 'violet', 'cyan', 'amber'];

const DECISION_CYCLE: EntityFunctionAccessDecision[] = ['none', 'allow', 'deny'];

const MODAL_CHROME_CLASS = {
  header: '!bg-indigo-50/90 !border-indigo-100',
  subtitle: '!border-indigo-100 !bg-indigo-50/50',
  searchIcon: '[&_svg]:text-indigo-400',
  accentWord: 'text-indigo-700',
  savingText: 'text-indigo-500',
};

const BADGE_CLASS: Record<EntityFunctionAccessDecision, string> = {
  none: 'border-slate-200 bg-slate-100 hover:bg-slate-200',
  allow: 'border-emerald-200 bg-emerald-100 hover:bg-emerald-200',
  deny: 'border-rose-200 bg-rose-100 hover:bg-rose-200',
};

const nextDecision = (current: EntityFunctionAccessDecision): EntityFunctionAccessDecision => {
  const index = DECISION_CYCLE.indexOf(current);
  return DECISION_CYCLE[(index + 1) % DECISION_CYCLE.length];
};

export type EntityFunctionAccessModalProps = {
  open: boolean;
  entityKind: FunctionAccessEntityKind;
  entityKey: string | null;
  entityLabel: string | null;
  editError: string | null;
  isSaving: boolean;
  functionDecisions: Record<string, EntityFunctionAccessDecision>;
  onHydrateDecisions: (decisions: Record<string, EntityFunctionAccessDecision>) => void;
  onFunctionDecisionsChange: (decisions: Record<string, EntityFunctionAccessDecision>) => void;
  onClose: () => void;
};

type FunctionAccessDisplayEntry = Pick<EntityFunctionAccessEntry, 'id' | 'name' | 'folder' | 'editable'>;

const freezeDisplayEntry = (entry: EntityFunctionAccessEntry): FunctionAccessDisplayEntry => ({
  id: entry.id,
  name: entry.name,
  folder: entry.folder,
  editable: entry.editable,
});

const matchesSearch = (
  entry: FunctionAccessDisplayEntry,
  folder: string,
  query: string,
): boolean => {
  if (!query) {
    return true;
  }
  const folderLabel = folder || 'Functions';
  return folderLabel.toLowerCase().includes(query)
    || entry.name.toLowerCase().includes(query);
};

const decisionLabel = (decision: EntityFunctionAccessDecision): string => {
  if (decision === 'allow') {
    return 'allowed';
  }
  if (decision === 'deny') {
    return 'denied';
  }
  return 'no decision';
};

const FunctionAccessBadge: React.FC<{
  entry: FunctionAccessDisplayEntry;
  decision: EntityFunctionAccessDecision;
  disabled: boolean;
  isPending: boolean;
  onCycle: () => void;
}> = ({ entry, decision, disabled, isPending, onCycle }) => (
  <NativeButton
    type="button"
    onClick={onCycle}
    disabled={disabled}
    title={`${entry.name} — ${decisionLabel(decision)}`}
    aria-label={`${entry.name} — ${decisionLabel(decision)}`}
    aria-pressed={decision !== 'none'}
    className={cn(
      'rounded-full border px-2.5 py-1 text-xs font-semibold text-black transition-colors',
      BADGE_CLASS[decision],
      disabled && 'cursor-not-allowed opacity-60 hover:bg-inherit',
      isPending && 'opacity-70',
    )}
  >
    {entry.name}
  </NativeButton>
);

const FolderAccessPanel: React.FC<{
  folder: string;
  entries: FunctionAccessDisplayEntry[];
  panelTone: AppSurfaceBoxTone;
  decisions: Record<string, EntityFunctionAccessDecision>;
  disabled: boolean;
  pendingId: string | null;
  onCycle: (functionId: string) => void;
}> = ({ folder, entries, panelTone, decisions, disabled, pendingId, onCycle }) => {
  const panelColors = APP_SURFACE_BOX_TONE_CLASS[panelTone];
  const allowCount = entries.filter((entry) => decisions[entry.id] === 'allow').length;
  const denyCount = entries.filter((entry) => decisions[entry.id] === 'deny').length;

  return (
    <div className={cn('flex min-w-0 flex-col rounded-lg border bg-white', panelColors.shell)}>
      <div className={cn('flex shrink-0 items-center justify-between px-3 py-2', panelColors.header)}>
        <span className={cn('truncate text-[10px] font-bold uppercase tracking-wider', panelColors.title)}>
          {folder || 'Functions'}
        </span>
        <span className={cn('shrink-0 ps-2 font-mono text-[10px] font-semibold tabular-nums', panelColors.title)}>
          <span className="text-emerald-700">{allowCount}</span>
          {' / '}
          <span className="text-rose-700">{denyCount}</span>
          {' / '}
          {entries.length}
        </span>
      </div>
      <div className="p-2">
        <div className="flex flex-wrap gap-1.5">
          {entries.map((entry) => (
            <FunctionAccessBadge
              key={entry.id}
              entry={entry}
              decision={decisions[entry.id] ?? 'none'}
              disabled={disabled || !entry.editable}
              isPending={pendingId === entry.id}
              onCycle={() => onCycle(entry.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const buildDecisionsFromEntries = (
  entries: EntityFunctionAccessEntry[],
): Record<string, EntityFunctionAccessDecision> => (
  Object.fromEntries(entries.map((entry) => [entry.id, entry.decision]))
);

export const EntityFunctionAccessModal: React.FC<EntityFunctionAccessModalProps> = ({
  open,
  entityKind,
  entityKey,
  entityLabel,
  editError,
  isSaving,
  functionDecisions,
  onHydrateDecisions,
  onFunctionDecisionsChange,
  onClose,
}) => {
  const accessQuery = useEntityFunctionAccessQuery(entityKind, entityKey, open);
  const hydratedKeyRef = useRef<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [pendingFunctionId, setPendingFunctionId] = useState<string | null>(null);
  const [stableEntries, setStableEntries] = useState<FunctionAccessDisplayEntry[]>([]);
  const principalLabel = entityKind === 'user' ? 'user' : 'role';

  useEffect(() => {
    if (!open) {
      hydratedKeyRef.current = null;
      setStableEntries([]);
      setSearchText('');
      setPendingFunctionId(null);
      return;
    }
    if (!entityKey || !accessQuery.data) {
      return;
    }

    const hydrateKey = `${entityKind}:${entityKey}`;
    if (hydratedKeyRef.current !== hydrateKey) {
      const sortedEntries = sortEntityFunctionAccessEntries(accessQuery.data.entries);
      setStableEntries(sortedEntries.map(freezeDisplayEntry));
      onHydrateDecisions(buildDecisionsFromEntries(sortedEntries));
      hydratedKeyRef.current = hydrateKey;
    }
  }, [open, entityKey, entityKind, accessQuery.data, onHydrateDecisions]);

  useEffect(() => {
    if (!isSaving) {
      setPendingFunctionId(null);
    }
  }, [isSaving]);

  const sortedLoadedEntries = useMemo(
    () => (
      accessQuery.data?.entries
        ? sortEntityFunctionAccessEntries(accessQuery.data.entries).map(freezeDisplayEntry)
        : []
    ),
    [accessQuery.data?.entries],
  );

  const displayEntries = stableEntries.length > 0 ? stableEntries : sortedLoadedEntries;

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, FunctionAccessDisplayEntry[]>();
    for (const entry of displayEntries) {
      const bucket = groups.get(entry.folder) ?? [];
      bucket.push(entry);
      groups.set(entry.folder, bucket);
    }
    return [...groups.entries()]
      .map(([folder, folderEntries]) => [
        folder,
        [...folderEntries].sort(compareEntityFunctionAccessEntries),
      ] as const)
      .sort(([left], [right]) => (left || '').localeCompare(right || '', undefined, { sensitivity: 'base' }));
  }, [displayEntries]);

  const filteredGroupedEntries = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return groupedEntries;
    }

    return groupedEntries
      .map(([folder, entries]) => {
        const folderLabel = folder || 'Functions';
        const folderMatches = folderLabel.toLowerCase().includes(query);
        const filteredEntries = folderMatches
          ? entries
          : entries.filter((entry) => matchesSearch(entry, folder, query));
        return [folder, filteredEntries] as const;
      })
      .filter(([, entries]) => entries.length > 0);
  }, [groupedEntries, searchText]);

  const adminBypass = accessQuery.data?.adminBypass ?? false;
  const loadError = accessQuery.isError
    ? (accessQuery.error instanceof Error ? accessQuery.error.message : 'Failed to load server function access.')
    : null;
  const isLoading = accessQuery.isLoading;
  const selectionDisabled = adminBypass;

  const cycleFunction = useCallback((functionId: string) => {
    if (selectionDisabled) {
      return;
    }

    setPendingFunctionId(functionId);
    const current = functionDecisions[functionId] ?? 'none';
    onFunctionDecisionsChange({
      ...functionDecisions,
      [functionId]: nextDecision(current),
    });
  }, [functionDecisions, onFunctionDecisionsChange, selectionDisabled]);

  if (!open || !entityKey || !entityLabel) {
    return null;
  }

  const totalFunctionCount = displayEntries.length;
  const allowCount = Object.values(functionDecisions).filter((decision) => decision === 'allow').length;
  const denyCount = Object.values(functionDecisions).filter((decision) => decision === 'deny').length;

  return (
    <CreateEditModalShell
      size="maximized"
      title={(
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-indigo-200 bg-indigo-100 text-indigo-700">
            <FunctionAccessActionIcon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 truncate">
            <span className={MODAL_CHROME_CLASS.accentWord}>Function Access</span>
            {' — '}
            {entityLabel}
          </span>
        </span>
      )}
      headerExtra={isSaving ? (
        <span className={cn('text-[10px] font-semibold uppercase tracking-wide', MODAL_CHROME_CLASS.savingText)}>
          Saving…
        </span>
      ) : undefined}
      subtitle={(
        <div className="flex min-h-8 w-full items-center gap-3">
          <AppSearchBox
            value={searchText}
            onChange={setSearchText}
            placeholder="name…"
            ariaLabel="Search server functions"
            className={cn(
              'min-w-0 flex-1 !min-h-8 !rounded-none !border-0 !bg-transparent !px-[15px] !py-1.5',
              MODAL_CHROME_CLASS.searchIcon,
            )}
          />
          {!isLoading && !loadError ? (
            <span
              className={cn(
                'shrink-0 pe-[15px] text-[11px] font-semibold tabular-nums',
                MODAL_CHROME_CLASS.accentWord,
              )}
            >
              <span className="text-emerald-700">{allowCount}</span>
              {' / '}
              <span className="text-rose-700">{denyCount}</span>
              {' / '}
              {totalFunctionCount}
            </span>
          ) : null}
        </div>
      )}
      subtitleTone="elevated"
      subtitleClassName={cn('!overflow-visible !border-b !px-0 !py-0', MODAL_CHROME_CLASS.subtitle)}
      headerClassName={cn('!mb-0 border-b', MODAL_CHROME_CLASS.header)}
      shellClassName="flex min-h-0 flex-col overflow-hidden"
      bodyOuterClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !min-h-0 !p-0"
      onClose={onClose}
      onBackdropClick={onClose}
    >
      <div className="flex h-full min-h-0 flex-col bg-white">
        {adminBypass ? (
          <div className="shrink-0 border-b border-amber-100 px-[15px] py-2">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                Built-in admin, ADMIN, and DEVELOPER {principalLabel}s bypass server function access checks. Access lists for this {principalLabel} are not editable.
              </p>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-[15px]">
          {isLoading ? (
            <p className={cn('text-xs font-medium', MODAL_CHROME_CLASS.savingText)}>Loading server functions...</p>
          ) : loadError ? (
            <p className="text-xs font-semibold text-red-600">{loadError}</p>
          ) : filteredGroupedEntries.length === 0 ? (
            <p className={cn('text-xs font-medium', MODAL_CHROME_CLASS.savingText)}>
              {searchText.trim() ? 'No functions match your search.' : 'No server functions found.'}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredGroupedEntries.map(([folder, entries], index) => (
                <FolderAccessPanel
                  key={folder || '__root__'}
                  folder={folder}
                  entries={entries}
                  panelTone={FOLDER_PANEL_TONES[index % FOLDER_PANEL_TONES.length]}
                  decisions={functionDecisions}
                  disabled={selectionDisabled}
                  pendingId={pendingFunctionId}
                  onCycle={cycleFunction}
                />
              ))}
            </div>
          )}

          {editError ? <p className="mt-3 text-xs font-semibold text-red-600">{editError}</p> : null}
        </div>
      </div>
    </CreateEditModalShell>
  );
};

export type UseEntityFunctionAccessModalStateOptions = {
  onPersisted?: () => void;
};

export type UseEntityFunctionAccessModalResult = {
  open: (entityKey: string, entityLabel: string) => void;
  close: () => void;
  modalProps: Omit<EntityFunctionAccessModalProps, 'entityKind'> & {
    entityKind: FunctionAccessEntityKind;
  };
};

export function useEntityFunctionAccessModalState(
  entityKind: FunctionAccessEntityKind,
  options: UseEntityFunctionAccessModalStateOptions = {},
): UseEntityFunctionAccessModalResult {
  const [entityKey, setEntityKey] = useState<string | null>(null);
  const [entityLabel, setEntityLabel] = useState<string | null>(null);
  const [functionDecisions, setFunctionDecisions] = useState<Record<string, EntityFunctionAccessDecision>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const replaceMutation = useReplaceEntityFunctionAccessMutation();
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDecisionsRef = useRef<Record<string, EntityFunctionAccessDecision>>({});
  const onPersistedRef = useRef(options.onPersisted);
  onPersistedRef.current = options.onPersisted;

  const clearPersistDebounce = useCallback(() => {
    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }
  }, []);

  const flushPersist = useCallback(async (decisions: Record<string, EntityFunctionAccessDecision>) => {
    if (!entityKey) {
      return;
    }

    setEditError(null);
    try {
      await replaceMutation.mutateAsync({
        entityKind,
        entityKey,
        payload: { decisions },
      });
      onPersistedRef.current?.();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Network error.';
      setEditError(message);
      throw caught;
    }
  }, [entityKey, entityKind, replaceMutation]);

  const schedulePersist = useCallback((decisions: Record<string, EntityFunctionAccessDecision>) => {
    latestDecisionsRef.current = decisions;
    clearPersistDebounce();
    persistDebounceRef.current = setTimeout(() => {
      persistDebounceRef.current = null;
      void flushPersist(latestDecisionsRef.current);
    }, 350);
  }, [clearPersistDebounce, flushPersist]);

  const hydrateDecisions = useCallback((decisions: Record<string, EntityFunctionAccessDecision>) => {
    clearPersistDebounce();
    latestDecisionsRef.current = decisions;
    setFunctionDecisions(decisions);
  }, [clearPersistDebounce]);

  const handleDecisionsChange = useCallback((decisions: Record<string, EntityFunctionAccessDecision>) => {
    latestDecisionsRef.current = decisions;
    setFunctionDecisions(decisions);
    schedulePersist(decisions);
  }, [schedulePersist]);

  const open = useCallback((nextEntityKey: string, nextEntityLabel: string) => {
    clearPersistDebounce();
    setEntityKey(nextEntityKey);
    setEntityLabel(nextEntityLabel);
    setFunctionDecisions({});
    latestDecisionsRef.current = {};
    setEditError(null);
  }, [clearPersistDebounce]);

  const close = useCallback(() => {
    const hadPending = persistDebounceRef.current !== null;
    clearPersistDebounce();

    const finishClose = () => {
      setEntityKey(null);
      setEntityLabel(null);
      setFunctionDecisions({});
      latestDecisionsRef.current = {};
      setEditError(null);
    };

    if (hadPending && entityKey) {
      void flushPersist(latestDecisionsRef.current)
        .then(finishClose)
        .catch(() => {
          // keep modal open; editError is set in flushPersist
        });
      return;
    }

    finishClose();
  }, [clearPersistDebounce, entityKey, flushPersist]);

  useEffect(() => () => {
    clearPersistDebounce();
  }, [clearPersistDebounce]);

  const modalProps = useMemo(() => ({
    open: Boolean(entityKey),
    entityKind,
    entityKey,
    entityLabel,
    editError,
    isSaving: replaceMutation.isPending,
    functionDecisions,
    onHydrateDecisions: hydrateDecisions,
    onFunctionDecisionsChange: handleDecisionsChange,
    onClose: close,
  }), [
    close,
    editError,
    entityKey,
    entityKind,
    entityLabel,
    functionDecisions,
    handleDecisionsChange,
    hydrateDecisions,
    replaceMutation.isPending,
  ]);

  return {
    open,
    close,
    modalProps,
  };
}
