import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy, FolderPlus, Plus, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  AppButton,
  AppSearchBox,
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_CANCEL_CLASS,
} from "../../shared/ui";
import {
  useDeleteHttpWorkshopCollectionMutation,
  useDeleteHttpWorkshopFolderMutation,
  useDeleteHttpWorkshopRequestMutation,
  useDuplicateHttpWorkshopCollectionMutation,
  useDuplicateHttpWorkshopFolderMutation,
  useDuplicateHttpWorkshopRequestMutation,
  useHttpWorkshopCollectionsQuery,
  useHttpWorkshopFoldersQuery,
  useHttpWorkshopRequestsQuery,
  type HttpWorkshopCollection,
  type HttpWorkshopFolder,
  type HttpWorkshopRequestSummary,
} from "../../shared/api/queries/api-talk";

const METHOD_TEXT_CLASS: Record<string, string> = {
  GET: "text-emerald-600",
  POST: "text-amber-600",
  PUT: "text-sky-600",
  PATCH: "text-violet-600",
  DELETE: "text-rose-600",
  HEAD: "text-slate-500",
  OPTIONS: "text-slate-500",
};

export type ApiTalkSidebarProps = {
  onOpenRequest: (request: HttpWorkshopRequestSummary) => void;
  onNewRequest: (collectionId: string, folderId: string | null) => void;
  onNewCollection: () => void;
  onNewFolder: (collectionId: string, parentFolderId: string | null) => void;
};

function FolderTree({
  collectionId,
  folders,
  requests,
  parentFolderId,
  depth,
  search,
  expandedFolderIds,
  onToggleFolder,
  onOpenRequest,
  onNewRequest,
  onNewFolder,
}: {
  collectionId: string;
  folders: HttpWorkshopFolder[];
  requests: HttpWorkshopRequestSummary[];
  parentFolderId: string | null;
  depth: number;
  search: string;
  expandedFolderIds: Set<string>;
  onToggleFolder: (id: string) => void;
  onOpenRequest: (request: HttpWorkshopRequestSummary) => void;
  onNewRequest: (collectionId: string, folderId: string | null) => void;
  onNewFolder: (collectionId: string, parentFolderId: string | null) => void;
}) {
  const deleteFolderMutation = useDeleteHttpWorkshopFolderMutation();
  const deleteRequestMutation = useDeleteHttpWorkshopRequestMutation();
  const duplicateFolderMutation = useDuplicateHttpWorkshopFolderMutation();
  const duplicateRequestMutation = useDuplicateHttpWorkshopRequestMutation();
  const childFolders = folders.filter((f) => f.parentFolderId === parentFolderId);
  const childRequests = requests
    .filter((r) => r.folderId === parentFolderId)
    .filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()));

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
              <button type="button" title="New request" onClick={() => onNewRequest(collectionId, folder.id)} className="hidden shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-300 group-hover:block">
                <Plus className="h-3 w-3" />
              </button>
              <button
                type="button"
                title="Duplicate folder"
                onClick={() => { void duplicateFolderMutation.mutateAsync({ id: folder.id, collectionId }); }}
                className="hidden shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-300 group-hover:block"
              >
                <Copy className="h-3 w-3" />
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
                requests={requests}
                parentFolderId={folder.id}
                depth={depth + 1}
                search={search}
                expandedFolderIds={expandedFolderIds}
                onToggleFolder={onToggleFolder}
                onOpenRequest={onOpenRequest}
                onNewRequest={onNewRequest}
                onNewFolder={onNewFolder}
              />
            ) : null}
          </div>
        );
      })}
      {childRequests.map((request) => (
        <div key={request.id} className="group flex items-center gap-1.5 rounded px-1 py-1 hover:bg-slate-200/60" style={{ paddingInlineStart: depth > 0 ? 16 : 4 }}>
          <button type="button" onClick={() => onOpenRequest(request)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
            <span className={`w-10 shrink-0 text-[9px] font-bold ${METHOD_TEXT_CLASS[request.method] ?? "text-slate-500"}`}>{request.method}</span>
            <span className="truncate text-[12px] text-slate-600">{request.name}</span>
          </button>
          <button
            type="button"
            title="Duplicate request"
            onClick={() => {
              void duplicateRequestMutation.mutateAsync({ id: request.id, collectionId }).then((created) => {
                onOpenRequest(created);
              });
            }}
            className="hidden shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-300 group-hover:block"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            type="button"
            title="Delete request"
            onClick={() => { void deleteRequestMutation.mutateAsync({ id: request.id, collectionId }); }}
            className="hidden shrink-0 rounded p-0.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 group-hover:block"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

function CollectionNode({
  collection,
  expanded,
  onToggle,
  search,
  onOpenRequest,
  onNewRequest,
  onNewFolder,
}: {
  collection: HttpWorkshopCollection;
  expanded: boolean;
  onToggle: () => void;
  search: string;
  onOpenRequest: (request: HttpWorkshopRequestSummary) => void;
  onNewRequest: (collectionId: string, folderId: string | null) => void;
  onNewFolder: (collectionId: string, parentFolderId: string | null) => void;
}) {
  const foldersQuery = useHttpWorkshopFoldersQuery(expanded ? collection.id : null);
  const requestsQuery = useHttpWorkshopRequestsQuery(expanded ? collection.id : null);
  const deleteCollectionMutation = useDeleteHttpWorkshopCollectionMutation();
  const duplicateCollectionMutation = useDuplicateHttpWorkshopCollectionMutation();
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
        <button type="button" title="New request" onClick={() => onNewRequest(collection.id, null)} className="hidden shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-300 group-hover:block">
          <Plus className="h-3 w-3" />
        </button>
        <button
          type="button"
          title="Duplicate collection"
          onClick={() => { void duplicateCollectionMutation.mutateAsync(collection.id); }}
          className="hidden shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-300 group-hover:block"
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          type="button"
          title="Delete collection"
          onClick={() => { void deleteCollectionMutation.mutateAsync(collection.id); }}
          className="hidden shrink-0 rounded p-0.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 group-hover:block"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {expanded ? (
        foldersQuery.isLoading || requestsQuery.isLoading ? (
          <p className="ps-4 text-[11px] text-slate-400">Loading…</p>
        ) : (
          <FolderTree
            collectionId={collection.id}
            folders={foldersQuery.data ?? []}
            requests={requestsQuery.data ?? []}
            parentFolderId={null}
            depth={1}
            search={search}
            expandedFolderIds={expandedFolderIds}
            onToggleFolder={toggleFolder}
            onOpenRequest={onOpenRequest}
            onNewRequest={onNewRequest}
            onNewFolder={onNewFolder}
          />
        )
      ) : null}
    </div>
  );
}

export const ApiTalkSidebar: React.FC<ApiTalkSidebarProps> = ({
  onOpenRequest,
  onNewRequest,
  onNewCollection,
  onNewFolder,
}) => {
  const collectionsQuery = useHttpWorkshopCollectionsQuery();
  const [search, setSearch] = useState("");
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<Set<string>>(new Set());

  const collections = useMemo(() => {
    const items = collectionsQuery.data ?? [];
    if (!search) return items;
    return items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
  }, [collectionsQuery.data, search]);

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
        ariaLabel="Search collections"
        trailing={(
          <AppButton
            type="button"
            aria-label="New collection"
            className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_CANCEL_CLASS, "shrink-0")}
            onClick={onNewCollection}
          >
            <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} />
          </AppButton>
        )}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {collectionsQuery.isLoading ? (
          <p className="p-2 text-[11px] text-slate-400">Loading…</p>
        ) : collections.length === 0 ? (
          <p className="p-2 text-[11px] text-slate-400">No collections yet.</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {collections.map((collection) => (
              <CollectionNode
                key={collection.id}
                collection={collection}
                expanded={expandedCollectionIds.has(collection.id)}
                onToggle={() => toggleCollection(collection.id)}
                search={search}
                onOpenRequest={onOpenRequest}
                onNewRequest={onNewRequest}
                onNewFolder={onNewFolder}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
