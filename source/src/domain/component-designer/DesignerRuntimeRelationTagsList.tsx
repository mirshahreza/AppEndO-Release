import * as React from 'react';
import { showAppFeedbackToast } from '../../shared/ui/appFeedbackToast';
import {
  RelationTagsListControl,
  resolveRelationTagsListSelectPlacement,
} from '../../shared/ui';
import { resolveMutationRuntimeUrl } from './bindingDynamicActionsEngine';
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

type RelationTagOption = { id: string; label: string };

const parseRelationTagOptions = (raw: unknown): RelationTagOption[] => {
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null;
        }
        const record = item as Record<string, unknown>;
        const id = typeof record.id === 'string' ? record.id.trim() : '';
        const label = typeof record.label === 'string' ? record.label.trim() : id;
        if (!id) {
          return null;
        }
        return { id, label: label || id };
      })
      .filter((item): item is RelationTagOption => item !== null);
  } catch {
    return [];
  }
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

/** Inline belongs-to-many tags list — Base Components `RelationTagsListControl` pattern. */
export const DesignerRuntimeRelationTagsList: React.FC<{
  node: DesignerNode;
  options: RuntimeRenderOptions;
}> = ({ node, options }) => {
  const dataSourceRef = readString(node.props.relationTagsDataSourceRef);
  const contentIdPath = readString(node.props.relationTagsContentIdPath, 'routeParams.id');
  const valueField = readString(node.props.relationTagsValueField, 'tagCode');
  // Junction FK field name on the target data source — CMS content tags use `contentId`;
  // other belongs-to-many junctions (e.g. CRM party tags) key off a different parent field.
  const parentField = readString(node.props.relationTagsParentField, 'contentId');
  const placeholder = readString(node.props.relationTagsPlaceholder, 'Add tag…');
  const selectPlacement = resolveRelationTagsListSelectPlacement(
    readString(node.props.relationTagsSelectPlacement),
  );
  const tagOptions = parseRelationTagOptions(node.props.relationTagsOptions);

  const store = options.designerStore ?? {};
  const contentId = coerceContentId(readNestedContextValue(store, contentIdPath));
  const dataSource = dataSourceRef
    ? options.bindingDefinitions?.dataSources?.[dataSourceRef]
    : undefined;
  const isInteractive = options.mode === 'runtime' && Boolean(options.previewEvents);

  const [values, setValues] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const activeContentIdRef = React.useRef(contentId);
  activeContentIdRef.current = contentId;

  const loadTags = React.useCallback(async () => {
    if (!dataSource || !contentId) {
      return;
    }
    const requestedContentId = contentId;
    setLoading(true);
    try {
      const listEndpoint = resolveDataSourceOperationEndpoint(dataSource, 'list');
      const url = resolveBindingUrl(listEndpoint, store, {
        [`filter[${parentField}][eq]`]: contentIdPath,
      });
      const response = await designerFetch(url);
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      const json = await response.json() as { data?: unknown };
      const rows = Array.isArray(json.data) ? json.data as Record<string, unknown>[] : [];
      const next = rows.map((row) => {
        const value = row[valueField];
        return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
      }).filter((item) => item.length > 0);
      if (activeContentIdRef.current === requestedContentId) {
        setValues(next);
      }
    } catch (error) {
      if (activeContentIdRef.current === requestedContentId) {
        const message = error instanceof Error ? error.message : 'Could not load tags.';
        showAppFeedbackToast(message, { variant: 'danger' });
      }
    } finally {
      if (activeContentIdRef.current === requestedContentId) {
        setLoading(false);
      }
    }
  }, [contentId, contentIdPath, dataSource, parentField, store, valueField]);

  React.useLayoutEffect(() => {
    setValues([]);
  }, [contentId]);

  React.useEffect(() => {
    if (isInteractive) {
      void loadTags();
    }
  }, [isInteractive, loadTags]);

  const syncTags = async (nextValues: string[]) => {
    if (!isInteractive || !dataSource || !contentId || syncing) {
      return;
    }

    const prevSet = new Set(values);
    const nextSet = new Set(nextValues);
    const toAdd = nextValues.filter((id) => !prevSet.has(id));
    const toRemove = values.filter((id) => !nextSet.has(id));
    if (toAdd.length === 0 && toRemove.length === 0) {
      return;
    }

    setSyncing(true);
    try {
      const numericContentId = Number(contentId);
      const contentIdPayload = Number.isFinite(numericContentId) ? numericContentId : contentId;

      for (const tagCode of toAdd) {
        const createEndpoint = resolveDataSourceOperationEndpoint(dataSource, 'create');
        const createUrl = resolveMutationRuntimeUrl(createEndpoint, undefined);
        const response = await designerFetch(createUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [parentField]: contentIdPayload, tagCode }),
        });
        if (!response.ok) {
          throw new Error(await parseApiErrorMessage(response));
        }
      }

      for (const tagCode of toRemove) {
        const deleteEndpoint = resolveDataSourceOperationEndpoint(dataSource, 'delete');
        const deleteUrl = resolveMutationRuntimeUrl(deleteEndpoint, `${contentId}|${tagCode}`);
        const response = await designerFetch(deleteUrl, { method: 'DELETE' });
        if (!response.ok) {
          throw new Error(await parseApiErrorMessage(response));
        }
      }

      setValues(nextValues);
      if (dataSourceRef && options.previewEvents?.refreshDataSource) {
        await options.previewEvents.refreshDataSource(dataSourceRef, undefined, {
          bypassServerCache: true,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update tags.';
      showAppFeedbackToast(message, { variant: 'danger' });
      await loadTags();
    } finally {
      setSyncing(false);
    }
  };

  const shellClassName = resolveRuntimeNodeClassName(node, 'w-full min-w-0');
  const disabled = !isInteractive
    || !contentId
    || loading
    || syncing
    || readBoolean(node.props.isDisabled)
    || readBoolean(node.props.disabled);

  if (!isInteractive) {
    const previewOptions = tagOptions.length > 0
      ? tagOptions
      : [{ id: 'preview-tag', label: 'Sample tag' }];
    return (
      <div className={shellClassName} data-designer-component="form.relation-tags-list">
        <RelationTagsListControl
          options={previewOptions}
          values={tagOptions.length > 0 ? [] : ['preview-tag']}
          onChange={() => undefined}
          selectPlacement={selectPlacement}
          placeholder={placeholder}
          disabled
          size="sm"
          ariaLabel="Content tags"
        />
      </div>
    );
  }

  if (!contentId) {
    return (
      <p className="ps-[4px] text-xs text-slate-500">Save the content first, then add tags.</p>
    );
  }

  return (
    <div className={shellClassName} data-designer-component="form.relation-tags-list">
      <RelationTagsListControl
        options={tagOptions}
        values={values}
        onChange={(next) => { void syncTags(next); }}
        selectPlacement={selectPlacement}
        placeholder={placeholder}
        disabled={disabled}
        size="sm"
        ariaLabel="Content tags"
      />
    </div>
  );
};
