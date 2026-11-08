import React, { useMemo, useState } from 'react';
import { Waypoints } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type {
  EdgeModelAssociation,
  EdgeModelStudioAssociationMeta,
  RelationFormWidget,
  RelationTargetFilterCondition,
} from '../../../shared/api/contracts/data-api';
import { useEdgeModelsQuery } from '../../../shared/api/queries/data-api';
import { useDataSourceObjectRelationsQuery } from '../../../shared/api/queries/data-sources';
import {
  AppButton,
  FormSection,
  NativeButton,
} from '../../../shared/ui';
import {
  studioKeyForRelationRow,
} from '../lib/edgeModelAssociationStudioMeta';
import {
  MODELER_CAPTION_CLASS,
  MODELER_CHIP_FOCUS_CLASS,
  MODELER_EMPTY_STATE_CLASS,
  MODELER_NEUTRAL_ICON_CLASS,
  MODELER_RELATION_CHIP_CLASS,
  MODELER_RELATION_TITLE_CLASS,
} from '../lib/modelerChipStyles';
import {
  buildRelationsDatasheetRows,
  type RelationsDatasheetRow,
} from '../lib/relationsDatasheetRows';
import {
  associationHistoryFromMeta,
  emptyAssociationHistoryForm,
  pruneAssociationHistory,
} from './EdgeModelHistoryFields';
import {
  EdgeModelModelerRelationDialog,
  cubeDimensionFromRelationForm,
} from './EdgeModelModelerRelationDialog';
import { ModelerInspectorListPreview } from './ModelerInspectorListPreview';

type EdgeModelModelerRelationsSectionProps = {
  dataSourceId: string;
  objectName: string;
  objectType: 'TABLE' | 'VIEW';
  associations: ReadonlyArray<EdgeModelAssociation>;
  relationDisplayLabels: Record<string, string>;
  relationIcons: Record<string, string>;
  relationFormWidgets: Record<string, RelationFormWidget>;
  relationTargetFilters: Record<string, RelationTargetFilterCondition[]>;
  relationDeveloperNotes: Record<string, string>;
  relationInterfaceNotes: Record<string, string>;
  relationCubeDimensions?: Record<string, NonNullable<EdgeModelStudioAssociationMeta['cubeDimension']>>;
  relationHistories?: Record<string, NonNullable<EdgeModelStudioAssociationMeta['history']>>;
  onApplyRelationStudioMeta: (
    relationKey: string,
    values: {
      displayLabel: string;
      icon: string;
      formWidget: RelationFormWidget | '';
      targetFilter: RelationTargetFilterCondition[];
      developerNotes: string;
      interfaceNotes: string;
      cubeDimension?: NonNullable<EdgeModelStudioAssociationMeta['cubeDimension']> | null;
      history?: NonNullable<EdgeModelStudioAssociationMeta['history']> | null;
    },
  ) => void;
  onOpenRelations: () => void;
};

const RelationBadge: React.FC<{
  row: RelationsDatasheetRow;
  displayLabel?: string;
  onOpen: () => void;
}> = ({ row, displayLabel, onOpen }) => {
  const title = displayLabel?.trim() || row.name;

  return (
    <NativeButton
      type="button"
      aria-label={`Open relation ${title}`}
      title={title}
      className={cn(
        'inline-flex w-full min-w-0 items-center overflow-hidden rounded-md border px-2 py-1.5 text-start shadow-sm',
        'transition-colors focus-visible:outline-none',
        MODELER_CHIP_FOCUS_CLASS,
        MODELER_RELATION_CHIP_CLASS,
      )}
      onClick={onOpen}
    >
      <span className={cn(MODELER_RELATION_TITLE_CLASS, 'min-w-0 truncate')}>{title}</span>
    </NativeButton>
  );
};

export const EdgeModelModelerRelationsSection: React.FC<EdgeModelModelerRelationsSectionProps> = ({
  dataSourceId,
  objectName,
  objectType,
  associations,
  relationDisplayLabels,
  relationIcons,
  relationFormWidgets,
  relationTargetFilters,
  relationDeveloperNotes,
  relationInterfaceNotes,
  relationCubeDimensions = {},
  relationHistories = {},
  onApplyRelationStudioMeta,
  onOpenRelations,
}) => {
  const modelsQuery = useEdgeModelsQuery();
  const relationsQuery = useDataSourceObjectRelationsQuery(
    dataSourceId,
    objectType,
    objectName,
    Boolean(dataSourceId && objectName),
  );

  const [selectedRow, setSelectedRow] = useState<RelationsDatasheetRow | null>(null);

  const peerModels = useMemo(
    () => (modelsQuery.data ?? []).filter((model) => model.dataSourceId === dataSourceId),
    [dataSourceId, modelsQuery.data],
  );

  const rows = useMemo(
    () => buildRelationsDatasheetRows({
      objectName,
      physicalRelations: relationsQuery.data?.relations ?? [],
      associations,
      peerModels,
    }),
    [associations, objectName, peerModels, relationsQuery.data?.relations],
  );

  const selectedTargetColumns = useMemo(() => {
    if (!selectedRow || selectedRow.nature === 'physical') {
      return [];
    }
    if (selectedRow.association.kind !== 'belongsTo') {
      return [];
    }
    const target = peerModels.find(
      (model) => model.id === selectedRow.association.targetModelId,
    );
    return target?.columns ?? [];
  }, [peerModels, selectedRow]);

  const isLoading = relationsQuery.isLoading || modelsQuery.isLoading;

  const selectedRelationKey = selectedRow ? studioKeyForRelationRow(selectedRow) : null;

  return (
    <>
      <FormSection
        title="Relations"
        ink="complement"
        divided
        hint="Links between this table and others. Open the diagram to add or edit a relation."
        headerExtra={(
          <AppButton
            intent="secondary"
            size="sm"
            onClick={onOpenRelations}
          >
            <Waypoints className="h-3.5 w-3.5" />
            Open diagram
          </AppButton>
        )}
      >
        {isLoading && rows.length === 0 ? (
          <p className={cn('ps-[4px]', MODELER_CAPTION_CLASS)}>Loading relations…</p>
        ) : null}

        {!isLoading && rows.length === 0 ? (
          <button
            type="button"
            className={MODELER_EMPTY_STATE_CLASS}
            onClick={onOpenRelations}
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
              <Waypoints className={cn('h-3.5 w-3.5', MODELER_NEUTRAL_ICON_CLASS)} aria-hidden="true" />
              No relations yet
            </span>
            <span className={cn('ps-[4px]', MODELER_CAPTION_CLASS)}>
              Open the diagram to add a logical relation or connect tables.
            </span>
          </button>
        ) : null}

        {rows.length > 0 ? (
          <ModelerInspectorListPreview key={`${dataSourceId}:${objectName}`} items={rows}>
            {(visible) => visible.map((row) => {
              const relationKey = studioKeyForRelationRow(row);
              return (
                <RelationBadge
                  key={row.key}
                  row={row}
                  displayLabel={relationDisplayLabels[relationKey]}
                  onOpen={() => setSelectedRow(row)}
                />
              );
            })}
          </ModelerInspectorListPreview>
        ) : null}
      </FormSection>

      <EdgeModelModelerRelationDialog
        open={Boolean(selectedRow)}
        row={selectedRow}
        targetColumns={selectedTargetColumns}
        initialValues={{
          displayLabel: selectedRelationKey
            ? (relationDisplayLabels[selectedRelationKey] ?? '')
            : '',
          icon: selectedRelationKey ? (relationIcons[selectedRelationKey] ?? '') : '',
          formWidget: selectedRelationKey
            ? (relationFormWidgets[selectedRelationKey] ?? '')
            : '',
          targetFilter: selectedRelationKey
            ? (relationTargetFilters[selectedRelationKey] ?? [])
            : [],
          developerNotes: selectedRelationKey
            ? (relationDeveloperNotes[selectedRelationKey] ?? '')
            : '',
          interfaceNotes: selectedRelationKey
            ? (relationInterfaceNotes[selectedRelationKey] ?? '')
            : '',
          cubeDimensionEnabled: Boolean(selectedRelationKey && relationCubeDimensions[selectedRelationKey]),
          cubeIsTimeDimension: Boolean(
            selectedRelationKey && relationCubeDimensions[selectedRelationKey]?.isTimeDimension,
          ),
          cubeHierarchyName: selectedRelationKey
            ? (relationCubeDimensions[selectedRelationKey]?.hierarchies?.[0]?.name ?? 'Default')
            : 'Default',
          cubeHierarchyLevels: selectedRelationKey
            ? (relationCubeDimensions[selectedRelationKey]?.hierarchies?.[0]?.levels ?? []).join(', ')
            : '',
          cubeAttributes: selectedRelationKey
            ? (relationCubeDimensions[selectedRelationKey]?.attributes ?? []).join(', ')
            : '',
          history: selectedRelationKey
            ? associationHistoryFromMeta(relationHistories[selectedRelationKey])
            : emptyAssociationHistoryForm(),
        }}
        onSave={(values) => {
          if (!selectedRelationKey) {
            return;
          }
          onApplyRelationStudioMeta(selectedRelationKey, {
            displayLabel: values.displayLabel,
            icon: values.icon,
            formWidget: values.formWidget,
            targetFilter: values.targetFilter,
            developerNotes: values.developerNotes,
            interfaceNotes: values.interfaceNotes,
            cubeDimension: cubeDimensionFromRelationForm(values),
            history: pruneAssociationHistory(values.history) ?? null,
          });
        }}
        onClose={() => setSelectedRow(null)}
      />
    </>
  );
};
