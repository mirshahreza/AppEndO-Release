import React, { useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { formatApiErrorMessage } from '../../shared/api/client';
import { AppButton, UiInput } from '../../shared/ui';
import { CreateEditModalShell } from '../../shared/ui/CreateEditModalShell';
import {
  useCreateSqlConsoleCollectionMutation,
  useCreateSqlConsoleFolderMutation,
  useCreateSqlConsoleScriptMutation,
  useUpdateSqlConsoleScriptMutation,
} from '../../shared/api/queries/sql-console';
import type { SqlConsoleTab } from './sqlConsoleTabTypes';

export const NewCollectionModal: React.FC<{ onClose: () => void; onCreated: (collectionId: string) => void }> = ({
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateSqlConsoleCollectionMutation();

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const created = await createMutation.mutateAsync({ name: name.trim() });
    onCreated(created.id);
    onClose();
  };

  return (
    <CreateEditModalShell title="New collection" onClose={onClose} footer={(
      <>
        <AppButton intent="cancel" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
          Cancel
        </AppButton>
        <AppButton intent="create" disabled={createMutation.isPending} onClick={() => { void handleSubmit(); }}>
          <Plus className="h-3.5 w-3.5" />
          Create
        </AppButton>
      </>
    )}
    >
      <div className="flex flex-col gap-3 p-1">
        <div>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Name</span>
          <UiInput value={name} onChange={(event) => setName(event.target.value)} size="sm" ariaLabel="Collection name" placeholder="e.g. Reporting" />
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
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateSqlConsoleFolderMutation();

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    await createMutation.mutateAsync({ collectionId, parentFolderId, name: name.trim() });
    onClose();
  };

  return (
    <CreateEditModalShell title="New folder" onClose={onClose} footer={(
      <>
        <AppButton intent="cancel" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
          Cancel
        </AppButton>
        <AppButton intent="create" disabled={createMutation.isPending} onClick={() => { void handleSubmit(); }}>
          <Plus className="h-3.5 w-3.5" />
          Create
        </AppButton>
      </>
    )}
    >
      <div className="flex flex-col gap-3 p-1">
        <div>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Name</span>
          <UiInput value={name} onChange={(event) => setName(event.target.value)} size="sm" ariaLabel="Folder name" placeholder="e.g. Daily" />
        </div>
        {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
      </div>
    </CreateEditModalShell>
  );
};

const isPlaceholderTabName = (name: string): boolean => (
  /^Query \d+$/.test(name) || name === 'Untitled query'
);

export const SaveScriptModal: React.FC<{
  tab: SqlConsoleTab;
  dataSourceId: string;
  onClose: () => void;
  onSaved: (info: { collectionId: string | null; folderId: string | null; scriptId: string; name: string }) => void;
}> = ({ tab, dataSourceId, onClose, onSaved }) => {
  const [name, setName] = useState(isPlaceholderTabName(tab.name) ? '' : tab.name);
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateSqlConsoleScriptMutation();
  const updateMutation = useUpdateSqlConsoleScriptMutation();

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    const destinationCollectionId = tab.collectionId ?? null;
    const payload = {
      name: name.trim(),
      sql: tab.sql,
      dataSourceId,
      folderId: destinationCollectionId ? (tab.folderId ?? null) : null,
    };
    try {
      if (tab.savedScriptId) {
        await updateMutation.mutateAsync({
          id: tab.savedScriptId,
          collectionId: destinationCollectionId,
          ...payload,
        });
        onSaved({
          collectionId: destinationCollectionId,
          folderId: payload.folderId,
          scriptId: tab.savedScriptId,
          name: payload.name,
        });
      } else {
        const created = await createMutation.mutateAsync({
          collectionId: destinationCollectionId,
          ...payload,
        });
        onSaved({
          collectionId: created.collectionId ?? destinationCollectionId,
          folderId: created.folderId ?? payload.folderId,
          scriptId: created.id,
          name: payload.name,
        });
      }
      onClose();
    } catch (submitError) {
      setError(formatApiErrorMessage(submitError));
    }
  };

  return (
    <CreateEditModalShell title="Save script" onClose={onClose} footer={(
      <>
        <AppButton intent="cancel" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
          Cancel
        </AppButton>
        <AppButton intent="create" disabled={createMutation.isPending || updateMutation.isPending} onClick={() => { void handleSubmit(); }}>
          <Save className="h-3.5 w-3.5" />
          Save
        </AppButton>
      </>
    )}
    >
      <div className="flex flex-col gap-3 p-1">
        <div>
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Script name</span>
          <UiInput value={name} onChange={(event) => setName(event.target.value)} size="sm" ariaLabel="Script name" placeholder="e.g. Orders today" />
        </div>
        {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
      </div>
    </CreateEditModalShell>
  );
};
