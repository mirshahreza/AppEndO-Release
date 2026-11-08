import type {
  EdgeModelStudioAssociationMeta,
  RelationFormWidget,
  RelationTargetFilterCondition,
} from '../../../shared/api/contracts/data-api';
import { normalizeRelationTargetFilter } from '../../../shared/api/contracts/data-api';
import type { RelationAttachedField } from './belongsToAttachedFields';
import { normalizeRelationAttachedFields } from './belongsToAttachedFields';
import type { RelationsDatasheetRow } from './relationsDatasheetRows';

export type EdgeModelRelationStudioLayout = {
  relationDisplayLabels: Record<string, string>;
  relationIcons: Record<string, string>;
  relationFormWidgets: Record<string, RelationFormWidget>;
  /** Target columns attached per relation key (source + output `as`). */
  relationAttachedFields: Record<string, RelationAttachedField[]>;
  /** Static AND target filters for form pickers / lookups. */
  relationTargetFilters: Record<string, RelationTargetFilterCondition[]>;
  relationDeveloperNotes: Record<string, string>;
  relationInterfaceNotes: Record<string, string>;
  relationCubeDimensions?: Record<string, NonNullable<EdgeModelStudioAssociationMeta['cubeDimension']>>;
  relationHistories?: Record<string, NonNullable<EdgeModelStudioAssociationMeta['history']>>;
};

export const emptyRelationStudioLayout = (): EdgeModelRelationStudioLayout => ({
  relationDisplayLabels: {},
  relationIcons: {},
  relationFormWidgets: {},
  relationAttachedFields: {},
  relationTargetFilters: {},
  relationDeveloperNotes: {},
  relationInterfaceNotes: {},
  relationCubeDimensions: {},
  relationHistories: {},
});

/** Stable studio-meta key: association id when present, otherwise the datasheet physical key. */
export const studioKeyForRelationRow = (row: RelationsDatasheetRow): string => {
  if (row.nature !== 'physical') {
    return row.association.id;
  }
  return row.key;
};

export const associationMetaToStudioLayout = (
  associationMeta: ReadonlyArray<EdgeModelStudioAssociationMeta>,
): EdgeModelRelationStudioLayout => {
  const layout = emptyRelationStudioLayout();
  for (const entry of associationMeta) {
    const key = entry.relationKey.trim();
    if (!key) {
      continue;
    }
    if (entry.displayLabel?.trim()) {
      layout.relationDisplayLabels[key] = entry.displayLabel;
    }
    if (entry.icon?.trim()) {
      layout.relationIcons[key] = entry.icon.trim();
    }
    if (entry.formWidget) {
      layout.relationFormWidgets[key] = entry.formWidget;
    }
    if (entry.attachedFields?.length) {
      layout.relationAttachedFields[key] = normalizeRelationAttachedFields(
        entry.attachedFields.map((field) => ({
          sourceColumn: field.sourceColumn,
          as: field.as,
        })),
      );
    }
    if (entry.targetFilter?.length) {
      const normalized = normalizeRelationTargetFilter(entry.targetFilter);
      if (normalized.length > 0) {
        layout.relationTargetFilters[key] = normalized;
      }
    }
    if (entry.developerNotes?.trim()) {
      layout.relationDeveloperNotes[key] = entry.developerNotes;
    }
    if (entry.interfaceNotes?.trim()) {
      layout.relationInterfaceNotes[key] = entry.interfaceNotes;
    }
    if (entry.cubeDimension) {
      layout.relationCubeDimensions = layout.relationCubeDimensions ?? {};
      layout.relationCubeDimensions[key] = entry.cubeDimension;
    }
    if (entry.history) {
      layout.relationHistories = layout.relationHistories ?? {};
      layout.relationHistories[key] = entry.history;
    }
  }
  return layout;
};

export const studioLayoutToAssociationMeta = (
  layout: EdgeModelRelationStudioLayout,
): EdgeModelStudioAssociationMeta[] => {
  const keys = new Set([
    ...Object.keys(layout.relationDisplayLabels),
    ...Object.keys(layout.relationIcons),
    ...Object.keys(layout.relationFormWidgets),
    ...Object.keys(layout.relationAttachedFields),
    ...Object.keys(layout.relationTargetFilters),
    ...Object.keys(layout.relationDeveloperNotes),
    ...Object.keys(layout.relationInterfaceNotes),
    ...Object.keys(layout.relationCubeDimensions ?? {}),
    ...Object.keys(layout.relationHistories ?? {}),
  ]);

  return [...keys]
    .sort((left, right) => left.localeCompare(right))
    .flatMap((relationKey) => {
      const displayLabel = layout.relationDisplayLabels[relationKey]?.trim() || undefined;
      const icon = layout.relationIcons[relationKey]?.trim() || undefined;
      const formWidget = layout.relationFormWidgets[relationKey];
      const attachedFields = normalizeRelationAttachedFields(
        layout.relationAttachedFields[relationKey] ?? [],
      );
      const targetFilter = normalizeRelationTargetFilter(
        layout.relationTargetFilters[relationKey] ?? [],
      );
      const developerNotes = layout.relationDeveloperNotes[relationKey]?.trim() || undefined;
      const interfaceNotes = layout.relationInterfaceNotes[relationKey]?.trim() || undefined;
      const cubeDimension = layout.relationCubeDimensions?.[relationKey];
      const history = layout.relationHistories?.[relationKey];
      if (
        !displayLabel
        && !icon
        && !formWidget
        && attachedFields.length === 0
        && targetFilter.length === 0
        && !developerNotes
        && !interfaceNotes
        && !cubeDimension
        && !history
      ) {
        return [];
      }
      return [{
        relationKey,
        ...(displayLabel ? { displayLabel } : {}),
        ...(icon ? { icon } : {}),
        ...(formWidget ? { formWidget } : {}),
        ...(attachedFields.length > 0 ? { attachedFields } : {}),
        ...(targetFilter.length > 0 ? { targetFilter } : {}),
        ...(developerNotes ? { developerNotes } : {}),
        ...(interfaceNotes ? { interfaceNotes } : {}),
        ...(cubeDimension ? { cubeDimension } : {}),
        ...(history ? { history } : {}),
      }];
    });
};
