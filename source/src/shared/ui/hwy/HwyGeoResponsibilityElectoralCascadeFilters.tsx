import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  clearHwyGeoResponsibilityElectoralSelectionFrom,
  hwyGeoResponsibilityMemberRashhElectoralFilterKinds,
  hwyGeoResponsibilityNominationElectoralFilterKinds,
  isHwyGeoResponsibilityElectoralCascadeStepVisible,
  resolveHwyGeoResponsibilityNominationCandidateQueryScope,
  resolveHwyGeoResponsibilityElectoralOptionsParentId,
  type HwyElectoralGeoKind,
  type HwyGeoResponsibilityElectoralSelection,
  type HwyGeoResponsibilityNominationCandidateQueryScope,
} from '../../../domain/hwy/hwyGeoResponsibilityElectoralCascade';
import type { HwyGeoResponsibilityLevel } from '../../../domain/hwy/hwyGeoResponsibilityCatalog';
import {
  fetchHwyGeoResponsibilityProvinceHasGhavateh,
  listHwyGeoResponsibilityElectoralOptions,
  resolveHwyGeoResponsibilityElectoralSelection,
} from '../../../domain/hwy/hwyGeoResponsibility';
import { cn } from '../../../lib/utils';
import { FormField } from '../FormSection';
import { UiSelectMenu, type UiSelectMenuOption } from '../UiSelectMenu';

const ELECTORAL_KIND_LABEL_KEY: Record<HwyElectoralGeoKind, string> = {
  province: 'hwy.geoResponsibility.level.province',
  ghavateh: 'hwy.geoResponsibility.level.ghavateh',
  circle: 'hwy.geoResponsibility.level.circle',
  maktab: 'hwy.geoResponsibility.level.maktab',
  region: 'hwy.geoResponsibility.level.region',
};

const ELECTORAL_KIND_LABEL_FALLBACK: Record<HwyElectoralGeoKind, string> = {
  province: 'Province',
  ghavateh: 'Sector (Ghavateh)',
  circle: 'Circle',
  maktab: 'Maktab',
  region: 'Region',
};

export type HwyGeoResponsibilityElectoralCascadeFiltersProps = {
  open: boolean;
  listLevel: HwyGeoResponsibilityLevel;
  initialGeoBaseInfoId: string;
  t: (key: string, fallback: string) => string;
  onFilterScopeChange?: (scope: HwyGeoResponsibilityNominationCandidateQueryScope | null) => void;
  /** Full chain through list leaf (member rashh picker); default is nomination ancestors only. */
  filterKindMode?: 'nomination' | 'memberRashh';
  /** Controlled selection (e.g. draft vs applied in pickers). */
  selection?: HwyGeoResponsibilityElectoralSelection;
  onSelectionChange?: (next: HwyGeoResponsibilityElectoralSelection) => void;
  /** Picker/dialog labels vs member-list toolbar (placeholder-only, shared grid cells). */
  chrome?: 'form' | 'legacyToolbar';
  className?: string;
  /** Required with `chrome="legacyToolbar"` — member-list field-by-field grid + cells. */
  legacyToolbarRowGridClass?: string;
  legacyToolbarFieldCellClass?: string;
  legacyToolbarSelectClass?: string;
  'data-testid'?: string;
};

export const HwyGeoResponsibilityElectoralCascadeFilters: React.FC<
  HwyGeoResponsibilityElectoralCascadeFiltersProps
> = ({
  open,
  listLevel,
  initialGeoBaseInfoId,
  t,
  onFilterScopeChange,
  filterKindMode = 'nomination',
  selection: controlledSelection,
  onSelectionChange,
  chrome = 'form',
  className,
  legacyToolbarRowGridClass,
  legacyToolbarFieldCellClass,
  legacyToolbarSelectClass,
  'data-testid': dataTestId,
}) => {
  const legacyToolbar = chrome === 'legacyToolbar';
  const filterKinds = useMemo(
    () => (filterKindMode === 'memberRashh'
      ? hwyGeoResponsibilityMemberRashhElectoralFilterKinds(listLevel)
      : hwyGeoResponsibilityNominationElectoralFilterKinds(listLevel)),
    [filterKindMode, listLevel],
  );

  const [internalSelection, setInternalSelection] = useState<HwyGeoResponsibilityElectoralSelection>({});
  const selection = controlledSelection ?? internalSelection;
  const selectionRef = React.useRef(selection);
  selectionRef.current = selection;
  const setSelection = useCallback((
    next: HwyGeoResponsibilityElectoralSelection
      | ((prev: HwyGeoResponsibilityElectoralSelection) => HwyGeoResponsibilityElectoralSelection),
  ) => {
    const resolved = typeof next === 'function' ? next(selectionRef.current) : next;
    if (onSelectionChange) {
      onSelectionChange(resolved);
      return;
    }
    setInternalSelection(resolved);
  }, [onSelectionChange]);

  const initialPathQuery = useQuery({
    queryKey: ['hwy-geo-responsibility-electoral-path', initialGeoBaseInfoId],
    queryFn: () => resolveHwyGeoResponsibilityElectoralSelection(initialGeoBaseInfoId),
    enabled: open && Boolean(initialGeoBaseInfoId),
  });

  useEffect(() => {
    if (!open || controlledSelection !== undefined) {
      return;
    }
    if (initialPathQuery.data) {
      setInternalSelection(initialPathQuery.data);
    }
  }, [controlledSelection, open, initialGeoBaseInfoId, initialPathQuery.data]);

  const provinceId = selection.province?.trim() ?? '';

  const provinceHasGhavatehQuery = useQuery({
    queryKey: ['hwy-geo-responsibility-province-has-ghavateh', provinceId],
    queryFn: () => fetchHwyGeoResponsibilityProvinceHasGhavateh(provinceId),
    enabled: open && Boolean(provinceId),
  });

  const provinceHasGhavateh = provinceHasGhavatehQuery.data?.hasGhavateh ?? false;

  useEffect(() => {
    if (!provinceId || provinceHasGhavatehQuery.isLoading) {
      return;
    }
    if (!provinceHasGhavateh && selection.ghavateh) {
      setSelection((prev) => clearHwyGeoResponsibilityElectoralSelectionFrom(
        prev,
        'province',
        filterKinds,
      ));
    }
  }, [
    filterKinds,
    provinceHasGhavateh,
    provinceHasGhavatehQuery.isLoading,
    provinceId,
    selection.ghavateh,
  ]);

  const filterScope = useMemo(
    () => resolveHwyGeoResponsibilityNominationCandidateQueryScope(
      selection,
      initialGeoBaseInfoId,
      listLevel,
      { filterKinds },
    ),
    [filterKinds, initialGeoBaseInfoId, listLevel, selection],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    onFilterScopeChange?.(filterScope);
  }, [filterScope, onFilterScopeChange, open]);

  const setKindSelection = useCallback((kind: HwyElectoralGeoKind, geoBaseInfoId: string) => {
    setSelection((prev) => {
      const next = clearHwyGeoResponsibilityElectoralSelectionFrom(prev, kind, filterKinds);
      next[kind] = geoBaseInfoId;
      return next;
    });
  }, [filterKinds]);

  const visibleKinds = filterKinds.filter((kind) => isHwyGeoResponsibilityElectoralCascadeStepVisible({
    kind,
    provinceHasGhavateh,
  }));

  /** Fixed column count for the full filter chain so ghavateh appearing mid-flow does not wrap to a new row. */
  const gridColsClass = filterKinds.length <= 1
    ? 'sm:grid-cols-1'
    : filterKinds.length === 2
      ? 'sm:grid-cols-2'
      : filterKinds.length === 3
        ? 'sm:grid-cols-2 lg:grid-cols-3'
        : filterKinds.length === 4
          ? 'sm:grid-cols-2 lg:grid-cols-4'
          : 'sm:grid-cols-2 lg:grid-cols-5';

  const singleRowLayout = filterKinds.length >= 3;

  return (
    <div
      className={cn(
        legacyToolbar
          ? cn(legacyToolbarRowGridClass, 'items-center', className)
          : cn(
            'gap-2',
            singleRowLayout
              ? 'flex flex-nowrap items-end overflow-x-auto'
              : cn('grid', gridColsClass),
            className,
          ),
      )}
      data-testid={legacyToolbar ? dataTestId : undefined}
    >
      {visibleKinds.map((kind) => {
        const label = t(
          ELECTORAL_KIND_LABEL_KEY[kind],
          ELECTORAL_KIND_LABEL_FALLBACK[kind],
        );
        const placeholder = t(
          `hwy.geoResponsibility.nominate.electoral.placeholder.${kind}`,
          `Choose ${ELECTORAL_KIND_LABEL_FALLBACK[kind].toLowerCase()}…`,
        );
        const selectNode = (
          <ElectoralKindSelect
            open={open}
            kind={kind}
            label={label}
            hideLabel
            legacyToolbar={legacyToolbar}
            legacyToolbarSelectClass={legacyToolbarSelectClass}
            selection={selection}
            provinceHasGhavateh={provinceHasGhavateh}
            selectedKey={selection[kind]}
            placeholder={placeholder}
            onSelect={(id) => setKindSelection(kind, id)}
          />
        );
        if (legacyToolbar) {
          return (
            <div key={kind} className={legacyToolbarFieldCellClass}>
              {selectNode}
            </div>
          );
        }
        return (
          <FormField
            key={kind}
            label={label}
            className={singleRowLayout ? 'min-w-[9rem] shrink-0 flex-1 basis-0' : undefined}
          >
            {selectNode}
          </FormField>
        );
      })}
    </div>
  );
};

const ElectoralKindSelect: React.FC<{
  open: boolean;
  kind: HwyElectoralGeoKind;
  label: string;
  hideLabel?: boolean;
  legacyToolbar?: boolean;
  legacyToolbarSelectClass?: string;
  selection: HwyGeoResponsibilityElectoralSelection;
  provinceHasGhavateh: boolean;
  selectedKey?: string;
  placeholder: string;
  onSelect: (geoBaseInfoId: string) => void;
}> = ({
  open,
  kind,
  label,
  hideLabel = false,
  legacyToolbar = false,
  legacyToolbarSelectClass,
  selection,
  provinceHasGhavateh,
  selectedKey,
  placeholder,
  onSelect,
}) => {
  const parentId = resolveHwyGeoResponsibilityElectoralOptionsParentId({
    kind,
    selection,
    provinceHasGhavateh,
  });
  const needsParent = kind !== 'province';
  const enabled = open && (!needsParent || Boolean(parentId));

  const optionsQuery = useQuery({
    queryKey: ['hwy-geo-responsibility-electoral-options', kind, parentId],
    queryFn: () => listHwyGeoResponsibilityElectoralOptions({
      kind,
      parentBaseInfoId: parentId,
    }),
    enabled,
  });

  const selectOptions = useMemo((): UiSelectMenuOption[] => (
    (optionsQuery.data?.rows ?? []).map((row) => ({
      id: row.geoBaseInfoId,
      textValue: row.title,
      content: row.title,
    }))
  ), [optionsQuery.data?.rows]);

  const select = (
    <UiSelectMenu
      size="sm"
      className={legacyToolbar ? legacyToolbarSelectClass : 'w-full'}
      portaledMenu
      ariaLabel={label}
      selectedKey={selectedKey}
      isDisabled={!enabled || (optionsQuery.isLoading && selectOptions.length === 0)}
      placeholder={placeholder}
      options={selectOptions}
      listBoxClassName="max-h-64"
      onSelectionChange={onSelect}
    />
  );

  if (hideLabel) {
    return select;
  }

  return (
    <FormField label={label}>
      {select}
    </FormField>
  );
};
