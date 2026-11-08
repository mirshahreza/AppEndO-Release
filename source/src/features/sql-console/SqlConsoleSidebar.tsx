import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FolderPlus, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  AppButton,
  AppSearchBox,
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_CANCEL_CLASS,
} from '../../shared/ui';
import {
  useDeleteSqlConsoleCollectionMutation,
  useDeleteSqlConsoleFolderMutation,
  useDeleteSqlConsoleScriptMutation,
  useSqlConsoleCollectionsQuery,
  useSqlConsoleFoldersQuery,
  useSqlConsoleScriptsQuery,
  useSqlConsoleUncategorizedScriptsQuery,
  type SqlConsoleCollection,
  type SqlConsoleFolder,
  type SqlConsoleScript,
} from '../../shared/api/queries/sql-console';
import { isSqlConsoleGeneralCollection } from '../../shared/api/contracts/sql-console';

export type SqlConsoleSidebarProps = {
  onOpenScript: (script: SqlConsoleScript) => void;
  onNewCollection: () => void;
  onNewFolder: (collectionId: string, parentFolderId: string | null) => void;
  revealCollectionId?: string | null;
};

function ScriptRow({
  script,
  depth,
  onOpenScript,
}: {
  script: SqlConsoleScript;
  depth: number;
  onOpenScript: (script: SqlConsoleScript) => void;
}) {
  const deleteScriptMutation = useDeleteSqlConsoleScriptMutation();
  return (
    <div className="group flex items-center gap-1.5 rounded px-1 py-1 hover:bg-slate-200/60" style={{ paddingInlineStart: depth > 0 ? 16 : 4 }}>
      <button type="button" onClick={() => onOpenScript(script)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
        <span className="truncate text-[12px] text-slate-600">{script.name}</span>
      </button>
      <button
        type="button"
        title="Delete script"
        onClick={() => { void deleteScriptMutation.mutateAsync({ id: script.id, collectionId: script.collectionId }); }}
        className="hidden shrink-0 rounded p-0.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 group-hover:block"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function FolderTree({
  collectionId,
  folders,
  scripts,
  parentFolderId,
  depth,
  search,
  expandedFolderIds,
  onToggleFolder,
  onOpenScript,
}: {
  collectionId: string;
  folders: SqlConsoleFolder[];
  scripts: SqlConsoleScript[];
  parentFolderId: string | null;
  depth: number;
  search: string;
  expandedFolderIds: Set<string>;
  onToggleFolder: (id: string) => void;
  onOpenScript: (script: SqlConsoleScript) => void;
}) {
  const deleteFolderMutation = useDeleteSqlConsoleFolderMutation();
  const childFolders = folders.filter((folder) => folder.parentFolderId === parentFolderId);
  const childScripts = scripts
    .filter((script) => script.folderId === parentFolderId)
    .filter((script) => !search || script.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ paddingInlineStart: depth > 0 ? 12 : 0 }}>
      {childFolders.map((folder) => {
        const expanded = expandedFolderIds.has(folder.id);
        return (
          <div key={folder.id}>
            <div className="group flex items-center gap-1 rounded px-1 py-1 hover:bg-slate-200/60">
              <button type="button" onClick={() => onToggleFolder(folder.id)} className="flex min-w-0 flex-1 items-center gap-1 text-left">
                {expanded ? <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" /> : <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />}
                <span className="truncate text-[12px] text-slate-700">{folder.name}</span>
              </button>
              <button
                type="button"
                title="Delete folder"
                onClick={() => { void deleteFolderMutation.mutateAsync({ id: folder.id, collectionId }); }}
                className="hidden shrink-0 rounded p-0.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 group-hover:block"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            {expanded ? (
              <FolderTree
                collectionId={collectionId}
                folders={folders}
                scripts={scripts}
                parentFolderId={folder.id}
                depth={depth + 1}
                search={search}
                expandedFolderIds={expandedFolderIds}
                onToggleFolder={onToggleFolder}
                onOpenScript={onOpenScript}
              />
            ) : null}
          </div>
        );
      })}
      {childScripts.map((script) => (
        <ScriptRow key={script.id} script={script} depth={depth} onOpenScript={onOpenScript} />
      ))}
    </div>
  );
}

function CollectionNode({
  collection,
  expanded,
  onToggle,
  search,
  onOpenScript,
  onNewFolder,
}: {
  collection: SqlConsoleCollection;
  expanded: boolean;
  onToggle: () => void;
  search: string;
  onOpenScript: (script: SqlConsoleScript) => void;
  onNewFolder: (collectionId: string, parentFolderId: string | null) => void;
}) {
  const foldersQuery = useSqlConsoleFoldersQuery(expanded ? collection.id : null);
  const scriptsQuery = useSqlConsoleScriptsQuery(expanded ? collection.id : null);
  const deleteCollectionMutation = useDeleteSqlConsoleCollectionMutation();
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

  const toggleFolder = (id: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div className="group flex items-center gap-1 rounded px-1 py-1 hover:bg-slate-200/60">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-1 text-left">
          {expanded ? <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" /> : <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />}
          <span className="truncate text-[12px] font-semibold text-slate-800">{collection.name}</span>
        </button>
        <button type="button" title="New folder" onClick={() => onNewFolder(collection.id, null)} className="hidden shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-300 group-hover:block">
          <FolderPlus className="h-3 w-3" />
        </button>
        {isSqlConsoleGeneralCollection(collection) ? null : (
          <button
            type="button"
            title="Delete collection"
            onClick={() => { void deleteCollectionMutation.mutateAsync(collection.id); }}
            className="hidden shrink-0 rounded p-0.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 group-hover:block"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      {expanded ? (
        foldersQuery.isLoading || scriptsQuery.isLoading ? (
          <p className="ps-4 text-[11px] text-slate-400">Loading…</p>
        ) : (
          <FolderTree
            collectionId={collection.id}
            folders={foldersQuery.data ?? []}
            scripts={scriptsQuery.data ?? []}
            parentFolderId={null}
            depth={1}
            search={search}
            expandedFolderIds={expandedFolderIds}
            onToggleFolder={toggleFolder}
            onOpenScript={onOpenScript}
          />
        )
      ) : null}
    </div>
  );
}

export const SqlConsoleSidebar: React.FC<SqlConsoleSidebarProps> = ({
  onOpenScript,
  onNewCollection,
  onNewFolder,
  revealCollectionId = null,
}) => {
  const collectionsQuery = useSqlConsoleCollectionsQuery();
  const uncategorizedQuery = useSqlConsoleUncategorizedScriptsQuery();
  const [search, setSearch] = useState('');
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!revealCollectionId) {
      return;
    }
    setExpandedCollectionIds((prev) => {
      if (prev.has(revealCollectionId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(revealCollectionId);
      return next;
    });
  }, [revealCollectionId]);

  const collections = useMemo(() => {
    const items = collectionsQuery.data ?? [];
    if (!search) return items;
    return items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
  }, [collectionsQuery.data, search]);

  const uncategorizedScripts = useMemo(() => {
    const items = uncategorizedQuery.data ?? [];
    if (!search) return items;
    return items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
  }, [uncategorizedQuery.data, search]);

  const toggleCollection = (id: string) => {
    setExpandedCollectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-slate-200 bg-slate-50/40">
      <AppSearchBox
        value={search}
        onChange={setSearch}
        placeholder="Search…"
        ariaLabel="Search saved scripts"
        trailing={(
          <AppButton
            type="button"
            aria-label="New collection"
            className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_CANCEL_CLASS, 'shrink-0')}
            onClick={onNewCollection}
          >
            <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} />
          </AppButton>
        )}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {collectionsQuery.isLoading && uncategorizedQuery.isLoading ? (
          <p className="p-2 text-[11px] text-slate-400">Loading…</p>
        ) : collections.length === 0 && uncategorizedScripts.length === 0 ? (
          <p className="p-2 text-[11px] text-slate-400">No saved scripts yet.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {uncategorizedScripts.map((script) => (
              <ScriptRow key={script.id} script={script} depth={0} onOpenScript={onOpenScript} />
            ))}
            {collections.map((collection) => (
              <CollectionNode
                key={collection.id}
                collection={collection}
                expanded={expandedCollectionIds.has(collection.id)}
                onToggle={() => toggleCollection(collection.id)}
                search={search}
                onOpenScript={onOpenScript}
                onNewFolder={onNewFolder}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
