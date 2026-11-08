export type SyncModelItemStatus = 'pending' | 'running' | 'done' | 'stale' | 'error';

export type SyncModelItem = {
  key: string;
  objectName: string;
  objectType: 'TABLE' | 'VIEW';
  action: 'create' | 'refresh';
  edgeModelId: string | null;
  status: SyncModelItemStatus;
  message?: string;
};

export type SyncModelsState = {
  open: boolean;
  items: SyncModelItem[];
  finished: boolean;
  isRunning: boolean;
};

export const createInitialSyncModelsState = (): SyncModelsState => ({
  open: false,
  items: [],
  finished: false,
  isRunning: false,
});

export type SyncModelTarget = {
  objectName: string;
  objectType: 'TABLE' | 'VIEW';
  edgeModelId: string | null;
};
