import * as React from 'react';
import { showAppFeedbackToast } from '../../shared/ui/appFeedbackToast';
import {
  resolveMutationRuntimeUrl,
  visibilityStorePathForNode,
} from './bindingDynamicActionsEngine';
import {
  designerFetch,
  parseApiErrorMessage,
  resolveBindingUrl,
} from './bindingMutationRuntime';
import {
  readNestedContextValue,
  resolveDataSourceOperationEndpoint,
} from './bindingResourceModel';
import type { RuntimeRenderOptions } from './runtimeRenderer';
import {
  readBoolean,
  readString,
  resolveRuntimeNodeClassName,
} from './runtimeShared';
import type { DesignerNode } from './types';
import {
  RelatedContentPickerDialog,
  type RelatedContentPickerItem,
} from './RelatedContentPickerDialog';

type RelatedContentRow = {
  relationId: string;
  peerId: string;
  title: string;
  href: string;
};

const coerceContentId = (raw: unknown): string | null => {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(Math.trunc(raw));
  }
  if (typeof raw === 'bigint') {
    return String(raw);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return null;
};

const readTitle = (row: Record<string, unknown>, titleField: string, fallbackField: string): string => {
  const title = row[titleField];
  if (typeof title === 'string' && title.trim()) {
    return title.trim();
  }
  const fallback = row[fallbackField];
  if (typeof fallback === 'string' && fallback.trim()) {
    return fallback.trim();
  }
  if (typeof fallback === 'number' && Number.isFinite(fallback)) {
    return String(fallback);
  }
  return 'Related content';
};

const mapRelationRows = (
  rows: Record<string, unknown>[],
  side: 'a' | 'b',
): RelatedContentRow[] => (
  rows.map((row) => {
    const relationId = row.id;
    if (relationId === undefined || relationId === null) {
      return null;
    }
    if (side === 'a') {
      const peerId = coerceContentId(row.contentIdB);
      if (!peerId) {
        return null;
      }
      return {
        relationId: String(relationId),
        peerId,
        title: readTitle(row, 'contentIdBTitle', 'contentIdB'),
        href: `/studio/cms/contents/edit/${encodeURIComponent(peerId)}`,
      };
    }
    const peerId = coerceContentId(row.contentIdA);
    if (!peerId) {
      return null;
    }
    return {
      relationId: String(relationId),
      peerId,
      title: readTitle(row, 'contentIdATitle', 'contentIdA'),
      href: `/studio/cms/contents/edit/${encodeURIComponent(peerId)}`,
    };
  }).filter((row): row is RelatedContentRow => row !== null)
);

const parsePickerOptions = (raw: unknown): RelatedContentPickerItem[] => {
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') {
        return [];
      }
      const record = entry as Record<string, unknown>;
      const id = coerceContentId(record.id ?? record.value);
      if (!id) {
        return [];
      }
      const labelRaw = record.label ?? record.textValue ?? record.title ?? id;
      const label = typeof labelRaw === 'string' && labelRaw.trim() ? labelRaw.trim() : id;
      const detailRaw = record.detail ?? record.slug;
      const detail = typeof detailRaw === 'string' && detailRaw.trim() ? detailRaw.trim() : undefined;
      return [{ id, label, detail }];
    });
  } catch {
    return [];
  }
};

const mapContentListRows = (
  rows: Record<string, unknown>[],
  excludeContentTypeCode?: string | null,
): RelatedContentPickerItem[] => (
  rows.flatMap((row) => {
    const id = coerceContentId(row.id);
    if (!id) {
      return [];
    }
    if (excludeContentTypeCode) {
      const typeCode = coerceContentId(row.contentTypeCode);
      if (typeCode === excludeContentTypeCode) {
        return [];
      }
    }
    const title = typeof row.title === 'string' && row.title.trim() ? row.title.trim() : id;
    const slug = typeof row.slug === 'string' && row.slug.trim() ? row.slug.trim() : undefined;
    return [{ id, label: title, detail: slug }];
  })
);

/** Normalize undirected CMS relation pair — DB CHECK requires content_id_a < content_id_b. */
const normalizeRelationPair = (
  left: string,
  right: string,
): { contentIdA: number; contentIdB: number } | null => {
  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) {
    return null;
  }
  return a < b
    ? { contentIdA: a, contentIdB: b }
    : { contentIdA: b, contentIdB: a };
};

/** Merged related-contents rail — one list for contentIdA and contentIdB queries. */
export const DesignerRuntimeRelatedContentsList: React.FC<{
  node: DesignerNode;
  options: RuntimeRenderOptions;
}> = ({ node, options }) => {
  const dataSourceRef = readString(node.props.relatedContentsDataSourceRef);
  const contentIdPath = readString(node.props.relatedContentsContentIdPath, 'routeParams.id');
  const createModalNodeId = readString(node.props.relatedContentsCreateModalNodeId);
  const contentsDataSourceRef = readString(node.props.relatedContentsOptionsDataSourceRef, 'cmsContents');
  const excludeContentTypeCode = readString(node.props.relatedContentsExcludeContentTypeCode) || null;
  const staticPickerItems = React.useMemo(
    () => parsePickerOptions(node.props.relatedContentsContentOptions),
    [node.props.relatedContentsContentOptions],
  );
  const store = options.designerStore ?? {};
  const contentId = coerceContentId(readNestedContextValue(store, contentIdPath));
  const dataSource = dataSourceRef
    ? options.bindingDefinitions?.dataSources?.[dataSourceRef]
    : undefined;
  const contentsDataSource = contentsDataSourceRef
    ? options.bindingDefinitions?.dataSources?.[contentsDataSourceRef]
    : undefined;
  const isInteractive = options.mode === 'runtime' && Boolean(options.previewEvents);

  const [rows, setRows] = React.useState<RelatedContentRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [pickerItems, setPickerItems] = React.useState<RelatedContentPickerItem[]>(staticPickerItems);
  const [pickerLoading, setPickerLoading] = React.useState(false);
  const activeContentIdRef = React.useRef(contentId);
  activeContentIdRef.current = contentId;

  const loadRelated = React.useCallback(async () => {
    if (!dataSource || !contentId) {
      return;
    }
    const requestedContentId = contentId;
    setLoading(true);
    try {
      const listEndpoint = resolveDataSourceOperationEndpoint(dataSource, 'list');
      const contentIdParam = `static:${requestedContentId}`;
      const [responseA, responseB] = await Promise.all([
        designerFetch(resolveBindingUrl(listEndpoint, store, { 'filter[contentIdA][eq]': contentIdParam })),
        designerFetch(resolveBindingUrl(listEndpoint, store, { 'filter[contentIdB][eq]': contentIdParam })),
      ]);
      if (!responseA.ok || !responseB.ok) {
        const message = !responseA.ok
          ? await parseApiErrorMessage(responseA)
          : await parseApiErrorMessage(responseB);
        throw new Error(message);
      }
      const jsonA = await responseA.json() as { data?: unknown };
      const jsonB = await responseB.json() as { data?: unknown };
      const listA = Array.isArray(jsonA.data) ? jsonA.data as Record<string, unknown>[] : [];
      const listB = Array.isArray(jsonB.data) ? jsonB.data as Record<string, unknown>[] : [];
      const merged = [...mapRelationRows(listA, 'a'), ...mapRelationRows(listB, 'b')];
      const unique = new Map<string, RelatedContentRow>();
      for (const row of merged) {
        unique.set(row.relationId, row);
      }
      if (activeContentIdRef.current === requestedContentId) {
        setRows(Array.from(unique.values()));
      }
    } catch (error) {
      if (activeContentIdRef.current === requestedContentId) {
        const message = error instanceof Error ? error.message : 'Could not load related contents.';
        showAppFeedbackToast(message, { variant: 'danger' });
      }
    } finally {
      if (activeContentIdRef.current === requestedContentId) {
        setLoading(false);
      }
    }
  }, [contentId, dataSource, store]);

  React.useLayoutEffect(() => {
    setRows([]);
  }, [contentId]);

  React.useEffect(() => {
    if (isInteractive) {
      void loadRelated();
    }
  }, [isInteractive, loadRelated]);

  const modalVisible = createModalNodeId
    ? readNestedContextValue(store, visibilityStorePathForNode(createModalNodeId))
    : undefined;
  const pickerOpen = modalVisible === true;

  const excludedIds = React.useMemo(() => {
    const next = new Set<string>();
    if (contentId) {
      next.add(contentId);
    }
    for (const row of rows) {
      if (row.peerId) {
        next.add(row.peerId);
      }
    }
    return next;
  }, [contentId, rows]);

  React.useEffect(() => {
    if (!isInteractive || !pickerOpen) {
      return;
    }
    let cancelled = false;
    const loadPickerItems = async () => {
      setPickerLoading(true);
      // Refresh relations first so self + already-linked peers are excluded from the list.
      await loadRelated();
      if (cancelled) {
        return;
      }
      if (!contentsDataSource) {
        setPickerItems(staticPickerItems);
        setPickerLoading(false);
        return;
      }
      try {
        const listEndpoint = resolveDataSourceOperationEndpoint(contentsDataSource, 'list');
        const response = await designerFetch(resolveBindingUrl(listEndpoint, store, {
          page: 'static:1',
          pageSize: 'static:500',
        }));
        if (!response.ok) {
          throw new Error(await parseApiErrorMessage(response));
        }
        const json = await response.json() as { data?: unknown };
        const list = Array.isArray(json.data) ? json.data as Record<string, unknown>[] : [];
        if (!cancelled) {
          const mapped = mapContentListRows(list, excludeContentTypeCode);
          setPickerItems(mapped.length > 0 ? mapped : staticPickerItems);
        }
      } catch {
        if (!cancelled) {
          setPickerItems(staticPickerItems);
        }
      } finally {
        if (!cancelled) {
          setPickerLoading(false);
        }
      }
    };
    void loadPickerItems();
    return () => {
      cancelled = true;
    };
  }, [
    contentsDataSource,
    excludeContentTypeCode,
    isInteractive,
    loadRelated,
    pickerOpen,
    staticPickerItems,
    store,
  ]);

  const closePicker = React.useCallback(() => {
    if (!createModalNodeId) {
      return;
    }
    options.previewEvents?.patchStore?.(visibilityStorePathForNode(createModalNodeId), false);
  }, [createModalNodeId, options.previewEvents]);

  const createRelation = async (peerId: string) => {
    if (!dataSource || !contentId || syncing) {
      return;
    }
    const normalizedPeerId = coerceContentId(peerId);
    if (!normalizedPeerId || normalizedPeerId === contentId || excludedIds.has(normalizedPeerId)) {
      showAppFeedbackToast('That content is already related or is the current content.', { variant: 'danger' });
      return;
    }
    const pair = normalizeRelationPair(contentId, normalizedPeerId);
    if (!pair) {
      showAppFeedbackToast('Select a different content to relate.', { variant: 'danger' });
      return;
    }
    setSyncing(true);
    try {
      const createEndpoint = resolveDataSourceOperationEndpoint(dataSource, 'create');
      const response = await designerFetch(resolveBindingUrl(createEndpoint, store, {}), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pair),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      closePicker();
      await loadRelated();
      if (dataSourceRef && options.previewEvents?.refreshDataSource) {
        await options.previewEvents.refreshDataSource(dataSourceRef, undefined, {
          bypassServerCache: true,
        });
      }
      showAppFeedbackToast('Relation created.', { variant: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create relation.';
      showAppFeedbackToast(message, { variant: 'danger' });
    } finally {
      setSyncing(false);
    }
  };

  const deleteRelation = async (relationId: string) => {
    if (!dataSource || syncing) {
      return;
    }
    setSyncing(true);
    try {
      const deleteEndpoint = resolveDataSourceOperationEndpoint(dataSource, 'delete');
      const deleteUrl = resolveMutationRuntimeUrl(deleteEndpoint, relationId);
      const response = await designerFetch(deleteUrl, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      setRows((current) => current.filter((row) => row.relationId !== relationId));
      if (dataSourceRef && options.previewEvents?.refreshDataSource) {
        await options.previewEvents.refreshDataSource(dataSourceRef, undefined, {
          bypassServerCache: true,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not remove relation.';
      showAppFeedbackToast(message, { variant: 'danger' });
      await loadRelated();
    } finally {
      setSyncing(false);
    }
  };

  const shellClassName = resolveRuntimeNodeClassName(node, 'w-full min-w-0');
  const disabled = !isInteractive || !contentId || loading || syncing
    || readBoolean(node.props.isDisabled)
    || readBoolean(node.props.disabled);

  const picker = createModalNodeId ? (
    <RelatedContentPickerDialog
      open={isInteractive && pickerOpen}
      items={pickerItems}
      excludedIds={excludedIds}
      emptyMessage="No available contents to relate."
      isLoading={pickerLoading}
      isSelecting={syncing}
      onClose={closePicker}
      onSelect={createRelation}
    />
  ) : null;

  if (!isInteractive) {
    return (
      <div className={shellClassName} data-designer-component="form.related-contents-list">
        <a className="text-sm font-medium text-emerald-700 underline" href="#">Sample related content</a>
        {picker}
      </div>
    );
  }

  if (!contentId) {
    return (
      <>
        <p className="ps-[4px] text-xs text-slate-500">Save the content first, then add related contents.</p>
        {picker}
      </>
    );
  }

  if (loading && rows.length === 0) {
    return <>{picker}</>;
  }

  if (rows.length === 0) {
    return <>{picker}</>;
  }

  return (
    <div className={shellClassName} data-designer-component="form.related-contents-list">
      <ul className="flex min-w-0 flex-col gap-0">
        {rows.map((row) => (
          <li
            key={row.relationId}
            className="group flex h-7 min-w-0 items-center justify-between gap-1"
          >
            <span className="flex min-w-0 flex-1 items-center gap-1.5 ps-[4px]">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                aria-hidden
              />
              <a
                href={row.href}
                className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 no-underline hover:text-blue-600 hover:underline"
              >
                {row.title}
              </a>
            </span>
            <button
              type="button"
              className="shrink-0 rounded px-1 text-[11px] font-semibold text-rose-600 opacity-0 transition-opacity hover:bg-rose-50 group-hover:opacity-100 disabled:opacity-40"
              disabled={disabled}
              aria-label={`Remove ${row.title}`}
              onClick={() => { void deleteRelation(row.relationId); }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {picker}
    </div>
  );
};
