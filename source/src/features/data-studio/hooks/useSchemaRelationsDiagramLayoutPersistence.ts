import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useEdgeModelStudioMetaQuery,
  useUpsertEdgeModelStudioMetaMutation,
} from '../../../shared/api/queries/data-api';
import type { SchemaRelationsDiagramLayout } from '../../../shared/lib/schemaRelationsDiagramLayout';
import {
  SCHEMA_RELATIONS_DIAGRAM_LAYOUT_EXTENSION_KEY,
  readSchemaRelationsDiagramLayoutFromExtensions,
  readSchemaRelationsDiagramLayoutFromLocalStorage,
  writeSchemaRelationsDiagramLayoutToLocalStorage,
} from '../../../shared/lib/schemaRelationsDiagramLayout';

const SAVE_DEBOUNCE_MS = 450;

type UseSchemaRelationsDiagramLayoutPersistenceArgs = {
  dataSourceId: string;
  objectName: string;
  edgeModelId: string | null;
};

export function useSchemaRelationsDiagramLayoutPersistence({
  dataSourceId,
  objectName,
  edgeModelId,
}: UseSchemaRelationsDiagramLayoutPersistenceArgs) {
  const studioMetaQuery = useEdgeModelStudioMetaQuery(edgeModelId);
  const upsertStudioMetaMutation = useUpsertEdgeModelStudioMetaMutation();
  const saveTimerRef = useRef<number | null>(null);
  const latestLayoutRef = useRef<SchemaRelationsDiagramLayout | null>(null);
  const [localLayout, setLocalLayout] = useState<SchemaRelationsDiagramLayout | null>(() => (
    readSchemaRelationsDiagramLayoutFromLocalStorage(dataSourceId, objectName)
  ));

  useEffect(() => {
    setLocalLayout(readSchemaRelationsDiagramLayoutFromLocalStorage(dataSourceId, objectName));
  }, [dataSourceId, objectName]);

  const savedLayout = useMemo(() => {
    const fromMeta = readSchemaRelationsDiagramLayoutFromExtensions(studioMetaQuery.data?.extensions);
    return fromMeta ?? localLayout;
  }, [localLayout, studioMetaQuery.data?.extensions]);

  const flushSave = useCallback((layout: SchemaRelationsDiagramLayout) => {
    writeSchemaRelationsDiagramLayoutToLocalStorage(dataSourceId, objectName, layout);

    if (!edgeModelId) {
      return;
    }

    upsertStudioMetaMutation.mutate(
      {
        modelId: edgeModelId,
        patch: {
          extensions: {
            [SCHEMA_RELATIONS_DIAGRAM_LAYOUT_EXTENSION_KEY]: layout,
          },
        },
      },
      {
        // Layout chrome persistence must stay invisible — including failures.
        onError: () => undefined,
      },
    );
  }, [dataSourceId, edgeModelId, objectName, upsertStudioMetaMutation]);

  const persistLayout = useCallback((layout: SchemaRelationsDiagramLayout) => {
    latestLayoutRef.current = layout;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      const pending = latestLayoutRef.current;
      if (pending) {
        // Keep hydrated layout in sync for reopen without remounting the live graph.
        setLocalLayout(pending);
        flushSave(pending);
      }
    }, SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  useEffect(() => () => {
    if (saveTimerRef.current === null) {
      return;
    }
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const pending = latestLayoutRef.current;
    if (pending) {
      flushSave(pending);
    }
  }, [flushSave]);

  return {
    savedLayout,
    persistLayout,
    isLayoutHydrating: Boolean(edgeModelId) && studioMetaQuery.isLoading,
  };
}
