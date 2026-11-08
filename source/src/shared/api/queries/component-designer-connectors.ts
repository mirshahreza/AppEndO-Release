import { apiFetch, apiGet } from '../client';
import type { WorkspaceDataConnectorSummary } from '../../../domain/component-designer/dataConnectorTypes';

export async function fetchDesignerDataConnectors(): Promise<WorkspaceDataConnectorSummary[]> {
  const { data, response } = await apiGet<{
    success?: boolean;
    error?: string;
    items?: WorkspaceDataConnectorSummary[];
  }>('/api/component-designer/connectors');

  if (!response.ok || !data?.success || !Array.isArray(data.items)) {
    throw new Error(data?.error || 'Failed to load data connectors.');
  }

  return data.items;
}

export async function createDesignerDataConnector(
  payload: Record<string, unknown>,
): Promise<WorkspaceDataConnectorSummary> {
  const response = await apiFetch('/api/component-designer/connectors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json() as {
    success?: boolean;
    error?: string;
    connector?: WorkspaceDataConnectorSummary;
  };
  if (!response.ok || !data?.success || !data.connector) {
    throw new Error(data?.error || 'Failed to create data connector.');
  }
  return data.connector;
}

export async function updateDesignerDataConnector(
  id: string,
  payload: Record<string, unknown>,
): Promise<WorkspaceDataConnectorSummary> {
  const response = await apiFetch(`/api/component-designer/connectors/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json() as {
    success?: boolean;
    error?: string;
    connector?: WorkspaceDataConnectorSummary;
  };
  if (!response.ok || !data?.success || !data.connector) {
    throw new Error(data?.error || 'Failed to update data connector.');
  }
  return data.connector;
}

export async function deleteDesignerDataConnector(id: string): Promise<void> {
  const response = await apiFetch(`/api/component-designer/connectors/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error || `Failed to delete connector "${id}".`);
  }
}

export async function uploadDesignerDataConnectorFile(
  id: string,
  file: File,
): Promise<{ relativePath: string; connector: WorkspaceDataConnectorSummary }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiFetch(
    `/api/component-designer/connectors/${encodeURIComponent(id)}/upload-file`,
    { method: 'POST', body: formData },
  );
  const data = await response.json() as {
    success?: boolean;
    error?: string;
    relativePath?: string;
    connector?: WorkspaceDataConnectorSummary;
  };
  if (!response.ok || !data?.success || !data.relativePath || !data.connector) {
    throw new Error(data?.error || 'Failed to upload connector file.');
  }
  return { relativePath: data.relativePath, connector: data.connector };
}

export type DesignerTabularImportResult = {
  format: 'csv' | 'xlsx' | 'json';
  rows: Record<string, unknown>[];
  columns: Array<{ name: string; inferredType: string; sampleValues: string[] }>;
  suggestedName: string;
};

export async function importDesignerTabularFile(file: File): Promise<DesignerTabularImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiFetch('/api/component-designer/import-tabular', {
    method: 'POST',
    body: formData,
  });
  const data = await response.json() as {
    success?: boolean;
    error?: string;
    format?: DesignerTabularImportResult['format'];
    rows?: Record<string, unknown>[];
    columns?: DesignerTabularImportResult['columns'];
    suggestedName?: string;
  };
  if (
    !response.ok
    || !data?.success
    || !data.format
    || !Array.isArray(data.rows)
    || !Array.isArray(data.columns)
  ) {
    throw new Error(data?.error || 'Failed to import tabular file.');
  }
  return {
    format: data.format,
    rows: data.rows,
    columns: data.columns,
    suggestedName: data.suggestedName || file.name,
  };
}
