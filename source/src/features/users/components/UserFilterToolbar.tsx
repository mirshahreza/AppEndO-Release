import React, { useMemo } from 'react';
import { Building2, User } from 'lucide-react';
import { useOptionalCulture } from '../../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../../core/culture/cultureShellKeys';
import type { FilterMatchLogic } from '../../../shared/lib/filterMatchLogic';
import {
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  ListPageToolbarFrame,
  ToolbarFilterSelect,
  ListFilterToolbarControl,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  parseUiSelectCsvValue,
  serializeUiSelectCsvValue,
  type ListFilterButtonProps,
  type ToolbarFilterSelectOption,
} from '../../../shared/ui';
import { PAGE_GUIDE_EN } from '../../../core/culture/translations/pageGuideEn';

export type UserFilterToolbarProps = {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  availableRoles: string[];
  roleFilters: Record<string, boolean>;
  roleMatchLogic: FilterMatchLogic;
  onRoleMatchLogicChange: (value: FilterMatchLogic) => void;
  onRoleFiltersChange: (next: Record<string, boolean>) => void;
  personTypeOptions: ReadonlyArray<ToolbarFilterSelectOption>;
  personTypeCode: string;
  onPersonTypeCodeChange: (value: string) => void;
  onAddIndividualUser: () => void;
  onAddCompanyUser: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  filterButtonProps: ListFilterButtonProps;
};

export const UserFilterToolbar: React.FC<UserFilterToolbarProps> = ({
  searchInput,
  onSearchInputChange,
  availableRoles,
  roleFilters,
  roleMatchLogic,
  onRoleMatchLogicChange,
  onRoleFiltersChange,
  personTypeOptions,
  personTypeCode,
  onPersonTypeCodeChange,
  onAddIndividualUser,
  onAddCompanyUser,
  onRefresh,
  isRefreshing,
  filterButtonProps,
}) => {
  const culture = useOptionalCulture();
  const filterAllLabel = culture?.ready
    ? culture.t('grid.filter.all')
    : 'All';
  const personTypeFilterAria = culture?.ready
    ? culture.t('users.filter.personTypeAria')
    : 'Person type';
  const searchPlaceholder = culture?.ready
    ? culture.t('toolbar.searchUsers')
    : CULTURE_ACTION_FALLBACK_LABELS['toolbar.searchUsers'];
  const roleOptions = useMemo(
    () => availableRoles.map((role) => ({ value: role, label: role })),
    [availableRoles],
  );
  const roleFilterValue = useMemo(
    () => serializeUiSelectCsvValue(availableRoles.filter((role) => roleFilters[role])),
    [availableRoles, roleFilters],
  );

  return (
    <ListPageToolbarFrame>
      <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
        <ToolbarSearchInput
          value={searchInput}
          onChange={onSearchInputChange}
          placeholder={searchPlaceholder}
          ariaLabel={culture?.ready ? culture.t('grid.search') : 'Search'}
          className="w-full"
        />

        {availableRoles.length > 0 ? (
          <ToolbarFilterSelect
            multiple
            className="max-lg:w-full max-lg:max-w-none max-lg:flex-[1_1_100%]"
            value={roleFilterValue}
            options={roleOptions}
            onChange={(csv) => {
              const selected = new Set(parseUiSelectCsvValue(csv));
              const next: Record<string, boolean> = {};
              for (const role of availableRoles) {
                next[role] = selected.has(role);
              }
              onRoleFiltersChange(next);
            }}
            ariaLabel="Roles"
            allLabel={filterAllLabel}
            hint={PAGE_GUIDE_EN['pageGuide.page.users.roles.hint']}
            matchLogic={roleMatchLogic}
            onMatchLogicChange={onRoleMatchLogicChange}
            matchLogicAriaLabel="Role filter match logic"
          />
        ) : null}

        {personTypeOptions.length > 0 ? (
          <ToolbarFilterSelect
            value={personTypeCode}
            options={personTypeOptions}
            onChange={onPersonTypeCodeChange}
            ariaLabel={personTypeFilterAria}
            allLabel={filterAllLabel}
            visibility="wide-only"
          />
        ) : null}

        <ListFilterToolbarControl
          filterButtonProps={filterButtonProps}
          separatorBefore
        />
      </div>

      <div className={`${PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS} shrink-0`}>
        <div className="flex min-w-0 flex-nowrap items-center justify-end gap-2">
        <ToolbarActionGroupWithRefresh
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          actions={[
            {
              id: 'add-individual',
              label: culture?.ready
                ? culture.t('toolbar.addIndividualUser')
                : CULTURE_ACTION_FALLBACK_LABELS['toolbar.addIndividualUser'],
              icon: <User className="h-3.5 w-3.5" />,
              intent: 'create',
              primary: true,
              onClick: onAddIndividualUser,
              guideHint: PAGE_GUIDE_EN['pageGuide.page.users.addIndividual.hint'],
            },
            {
              id: 'add-company',
              label: culture?.ready
                ? culture.t('toolbar.addCompanyUser')
                : CULTURE_ACTION_FALLBACK_LABELS['toolbar.addCompanyUser'],
              icon: <Building2 className="h-3.5 w-3.5" />,
              intent: 'create',
              onClick: onAddCompanyUser,
              guideHint: PAGE_GUIDE_EN['pageGuide.page.users.addCompany.hint'],
            },
          ]}
        />
        </div>
      </div>
    </ListPageToolbarFrame>
  );
};
