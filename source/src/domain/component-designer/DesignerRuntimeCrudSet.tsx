import * as React from 'react';
import { CrudSet, type CrudSetRow } from '../../shared/ui/CrudSet';
import { useNamedApiChangeReasonPolicy } from '../../shared/api/queries/namedApiChangeReason';
import { resolveMutationRuntimeUrl } from './bindingDynamicActionsEngine';
import { getNodeGridListResourceRef } from './bindingGridEngine';
import { designerFetch, parseApiErrorMessage } from './bindingMutationRuntime';
import {
  CRUD_SET_PALETTE_ITEM_ID,
  crudSetWriteChangeReasonRoute,
  parseCrudSetSpec,
  type CrudSetCreateApi,
  type CrudSetPatchApi,
} from './crudSetSpec';
import { mergeClassNames, readString } from './runtimeShared';
import type { DesignerNode } from './types';
import type { RuntimeRenderOptions } from './runtimeTypes';

const jsonBody = (values: Record<string, unknown>): RequestInit => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(values),
});

const rowRecordId = (row: CrudSetRow): unknown => row.id ?? row[Object.keys(row)[0] ?? ''];

const CRUD_SET_OMITTED_CHANGE_REASON = { reasonAsk: 'off' as const };

export const DesignerRuntimeCrudSet: React.FC<{
  node: DesignerNode;
  options: RuntimeRenderOptions & { className?: string };
}> = ({ node, options }) => {
  const spec = parseCrudSetSpec(node.props.spec);
  const writeRoute = spec ? crudSetWriteChangeReasonRoute(spec) : null;
  const changeReasonPolicy = useNamedApiChangeReasonPolicy(
    writeRoute?.method ?? 'PATCH',
    writeRoute?.path ?? '/__crud-set-no-write',
    CRUD_SET_OMITTED_CHANGE_REASON,
  );
  const className = mergeClassNames(
    options.className,
    options.mode === 'design' ? 'pointer-events-none' : undefined,
  );
  const rows = (options.gridRows ?? []) as CrudSetRow[];
  const dataSourceRef = getNodeGridListResourceRef(node);

  const refreshList = React.useCallback(() => {
    options.onGridRefresh?.();
    if (dataSourceRef) {
      void options.previewEvents?.refreshDataSource?.(dataSourceRef);
    }
  }, [dataSourceRef, options]);

  const handleCreate = React.useCallback(async (
    create: CrudSetCreateApi,
    values: Record<string, unknown>,
  ) => {
    const response = await designerFetch(create.endpointId, {
      method: 'POST',
      ...jsonBody(values),
    });
    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response));
    }
  }, []);

  const handlePatch = React.useCallback(async (
    patch: CrudSetPatchApi,
    row: CrudSetRow,
    values: Record<string, unknown>,
  ) => {
    const url = resolveMutationRuntimeUrl(patch.endpointId, rowRecordId(row));
    const response = await designerFetch(url, {
      method: 'PATCH',
      ...jsonBody(values),
    });
    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response));
    }
  }, []);

  const handleDelete = React.useCallback(async (row: CrudSetRow, values?: Record<string, unknown>) => {
    const endpoint = spec?.deleteApi?.endpointId;
    if (!endpoint) {
      return;
    }
    const url = resolveMutationRuntimeUrl(endpoint, rowRecordId(row));
    const response = await designerFetch(url, {
      method: 'DELETE',
      ...(values && Object.keys(values).length > 0 ? jsonBody(values) : {}),
    });
    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response));
    }
  }, [spec?.deleteApi?.endpointId]);

  if (!spec) {
    return (
      <div
        className={mergeClassNames(
          'flex min-h-[160px] w-full items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-sm text-slate-600',
          className,
        )}
        style={options.style}
        data-designer-component={CRUD_SET_PALETTE_ITEM_ID}
      >
        {readString(node.props.label, 'CRUD Set needs a spec')}
      </div>
    );
  }

  const interactive = options.mode === 'runtime';

  return (
    <div
      className={className}
      style={options.style}
      data-designer-component={CRUD_SET_PALETTE_ITEM_ID}
    >
      <CrudSet
        spec={spec}
        rows={rows}
        isLoading={options.gridListLoading}
        isError={options.gridListError}
        onRefresh={interactive ? refreshList : undefined}
        onCreate={interactive ? handleCreate : undefined}
        onPatch={interactive ? handlePatch : undefined}
        onDelete={interactive ? handleDelete : undefined}
        changeReasonPolicy={changeReasonPolicy}
      />
    </div>
  );
};
