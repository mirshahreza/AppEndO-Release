import React, { useState } from "react";
import { AppButton, UiInput, UiSelect, UiTextarea } from "../../shared/ui";
import { CreateEditModalShell } from "../../shared/ui/CreateEditModalShell";
import {
  useCreateHttpWorkshopCollectionMutation,
  useCreateHttpWorkshopFolderMutation,
  useCreateHttpWorkshopRequestMutation,
  useHttpWorkshopCollectionsQuery,
  useHttpWorkshopFoldersQuery,
  useUpdateHttpWorkshopRequestMutation,
  type HttpWorkshopAuthInput,
} from "../../shared/api/queries/api-talk";
import { authInputFromTab, type WorkshopTab } from "./apiTalkTabTypes";

export const NewCollectionModal: React.FC<{ onClose: () => void; onCreated: (collectionId: string) => void }> = ({ onClose, onCreated }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateHttpWorkshopCollectionMutation();

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const created = await createMutation.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
    onCreated(created.id);
    onClose();
  };

  return (
    <CreateEditModalShell title="New collection" onClose={onClose} footer={(
      <>
        <AppButton intent="cancel" onClick={onClose}>Cancel</AppButton>
        <AppButton intent="create" disabled={createMutation.isPending} onClick={() => { void handleSubmit(); }}>Create</AppButton>
      </>
    )}>
      <div className="flex flex-col gap-3 p-1">
        <div>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Name</span>
          <UiInput value={name} onChange={(event) => setName(event.target.value)} size="sm" ariaLabel="Collection name" placeholder="e.g. Payments API" />
        </div>
        <div>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Description (optional)</span>
          <UiTextarea value={description} onChange={(event) => setDescription(event.target.value)} ariaLabel="Collection description" rows={2} />
        </div>
        {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
      </div>
    </CreateEditModalShell>
  );
};

export const NewFolderModal: React.FC<{
  collectionId: string;
  parentFolderId: string | null;
  onClose: () => void;
}> = ({ collectionId, parentFolderId, onClose }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateHttpWorkshopFolderMutation();

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    await createMutation.mutateAsync({ collectionId, parentFolderId, name: name.trim() });
    onClose();
  };

  return (
    <CreateEditModalShell title="New folder" onClose={onClose} footer={(
      <>
        <AppButton intent="cancel" onClick={onClose}>Cancel</AppButton>
        <AppButton intent="create" disabled={createMutation.isPending} onClick={() => { void handleSubmit(); }}>Create</AppButton>
      </>
    )}>
      <div className="flex flex-col gap-3 p-1">
        <div>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Name</span>
          <UiInput value={name} onChange={(event) => setName(event.target.value)} size="sm" ariaLabel="Folder name" placeholder="e.g. Auth" />
        </div>
        {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
      </div>
    </CreateEditModalShell>
  );
};

export const SaveRequestModal: React.FC<{
  tab: WorkshopTab;
  onClose: () => void;
  onSaved: (info: { collectionId: string; folderId: string | null; requestId: string; name: string }) => void;
}> = ({ tab, onClose, onSaved }) => {
  const collectionsQuery = useHttpWorkshopCollectionsQuery();
  const [name, setName] = useState(tab.name === "Untitled request" ? "" : tab.name);
  const [collectionId, setCollectionId] = useState(tab.collectionId ?? "");
  const [folderId, setFolderId] = useState<string>(tab.folderId ?? "");
  const [error, setError] = useState<string | null>(null);
  const foldersQuery = useHttpWorkshopFoldersQuery(collectionId || null);
  const createMutation = useCreateHttpWorkshopRequestMutation();
  const updateMutation = useUpdateHttpWorkshopRequestMutation();

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!collectionId) {
      setError("Pick a collection.");
      return;
    }
    const auth = authInputFromTab(tab) as HttpWorkshopAuthInput;
    const payload = {
      name: name.trim(),
      method: tab.method,
      url: tab.url,
      queryParams: tab.queryParams ?? [],
      headers: tab.headers ?? [],
      bodyMode: tab.bodyMode,
      bodyRaw: tab.bodyMode !== "none" ? tab.bodyRaw : undefined,
      auth,
      folderId: folderId || null,
    };
    if (tab.savedRequestId) {
      await updateMutation.mutateAsync({ id: tab.savedRequestId, collectionId, ...payload });
      onSaved({ collectionId, folderId: folderId || null, requestId: tab.savedRequestId, name: payload.name });
    } else {
      const created = await createMutation.mutateAsync({ collectionId, ...payload });
      onSaved({ collectionId, folderId: folderId || null, requestId: created.id, name: payload.name });
    }
    onClose();
  };

  return (
    <CreateEditModalShell title="Save request" onClose={onClose} footer={(
      <>
        <AppButton intent="cancel" onClick={onClose}>Cancel</AppButton>
        <AppButton intent="create" disabled={createMutation.isPending || updateMutation.isPending} onClick={() => { void handleSubmit(); }}>Save</AppButton>
      </>
    )}>
      <div className="flex flex-col gap-3 p-1">
        <div>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Request name</span>
          <UiInput value={name} onChange={(event) => setName(event.target.value)} size="sm" ariaLabel="Request name" placeholder="e.g. Get user by id" />
        </div>
        <div>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Collection</span>
          <UiSelect value={collectionId} onChange={(event) => { setCollectionId(event.target.value); setFolderId(""); }} size="sm" ariaLabel="Destination collection">
            <option value="">Pick a collection…</option>
            {(collectionsQuery.data ?? []).map((collection) => (
              <option key={collection.id} value={collection.id}>{collection.name}</option>
            ))}
          </UiSelect>
        </div>
        {collectionId ? (
          <div>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Folder (optional)</span>
            <UiSelect value={folderId} onChange={(event) => setFolderId(event.target.value)} size="sm" ariaLabel="Destination folder">
              <option value="">(root)</option>
              {(foldersQuery.data ?? []).map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
            </UiSelect>
          </div>
        ) : null}
        {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
      </div>
    </CreateEditModalShell>
  );
};

