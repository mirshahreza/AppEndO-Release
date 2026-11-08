import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { UiInput } from '../../../../shared/ui';
import { formatQueryError } from '../../../../shared/api/client';
import { AppToast } from '../../../../shared/ui';
import { QueryErrorPanel } from '../../../../shared/ui/QueryErrorPanel';
import {
  APP_TABLE_GRID_CELL_PR_CLASS,
  APP_TABLE_GRID_HEADER_CELL_CLASS,
  APP_TABLE_GRID_TABLE_CLASS,
} from '../../../../shared/ui/surfaceClasses';
import {
  SPLIT_BUTTON_MENU_ITEM_CLASS,
  SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS,
  useFixedDropDownMenuStyle,
  useSplitButtonMenu,
} from '../../../../shared/ui/AppSplitButton';
import { cn } from '../../../../lib/utils';
import type { AttributeUserEditPolicy } from '../../../../shared/api/contracts/attributes/editPolicy';
import { ATTRIBUTE_USER_EDIT_POLICIES } from '../../../../shared/api/contracts/attributes/editPolicy';
import type { SettingsPageModel } from '../../hooks/useSettingsPage';
import { useSettingsFormT } from '../../hooks/useSettingsFormT';
import { getSettingsTypography } from '../../settingsSectionTypography';
import type { ProfileFieldDraftRow } from './constants';

type ProfileFieldsSectionProps = {
  page: SettingsPageModel;
};

const NOT_ACTIVE_VALUE = '__NOT_ACTIVE__';
const FIELD_COLUMN_WIDTH_CLASS = 'w-[220px] max-w-[220px]';
const POLICY_COLUMN_WIDTH_CLASS = 'w-[240px] max-w-[240px]';

const PROFILE_POLICY_KEYS: Record<AttributeUserEditPolicy, string> = {
  NONE: 'settings.forms.profileFields.policyNotEditable',
  WHEN_EMPTY: 'settings.forms.profileFields.policyEditableWhenEmpty',
  ALWAYS: 'settings.forms.profileFields.policyAlwaysEditable',
};

const resolveActivityPolicyValue = (row: ProfileFieldDraftRow): string => (
  row.isActive ? row.userEditPolicy : NOT_ACTIVE_VALUE
);

type ActivityPolicyOption = {
  value: string;
  label: string;
};

type ActivityPolicyDropdownProps = {
  value: string;
  options: ActivityPolicyOption[];
  disabled?: boolean;
  ariaLabel: string;
  onChange: (value: string) => void;
};

const ActivityPolicyDropdown: React.FC<ActivityPolicyDropdownProps> = ({
  value,
  options,
  disabled = false,
  ariaLabel,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const menuRef = useSplitButtonMenu(isOpen, setIsOpen, panelRef);
  const menuStyle = useFixedDropDownMenuStyle(isOpen, menuRef, { minWidth: 240 });
  const selectedOption = options.find((option) => option.value === value);
  const displayLabel = selectedOption?.label ?? value;

  const menuPanel = isOpen ? (
    <div
      ref={panelRef}
      className={cn(SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS, 'py-1')}
      style={menuStyle}
      role="listbox"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={isSelected}
            className={cn(
              SPLIT_BUTTON_MENU_ITEM_CLASS,
              'gap-2',
              isSelected && 'bg-indigo-50 text-indigo-700',
            )}
            onClick={() => {
              onChange(option.value);
              setIsOpen(false);
            }}
          >
            {isSelected ? (
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <span className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div ref={menuRef} className="relative w-full min-w-0">
      <button
        type="button"
        className={cn(
          'flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 transition-colors',
          disabled
            ? 'cursor-not-allowed opacity-60'
            : 'hover:border-slate-300 hover:bg-slate-50',
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        title={displayLabel}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((open) => !open);
          }
        }}
      >
        <span className="min-w-0 flex-1 truncate text-start font-medium">{displayLabel}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
      </button>
      {menuPanel && typeof document !== 'undefined'
        ? createPortal(menuPanel, document.body)
        : null}
    </div>
  );
};

export const ProfileFieldsSection: React.FC<ProfileFieldsSectionProps> = ({ page }) => {
  const t = useSettingsFormT();
  const {
    settingsQuery,
    draftRows,
    saveError,
    toast,
    isSaving,
    updateRow,
  } = page.profileFields;

  const typo = getSettingsTypography('profile-fields');
  const activityPolicyOptions = useMemo(
    () => [
      { value: NOT_ACTIVE_VALUE, label: t('settings.forms.profileFields.policyNotActive') },
      ...ATTRIBUTE_USER_EDIT_POLICIES.map((value) => ({
        value,
        label: t(PROFILE_POLICY_KEYS[value]),
      })),
    ],
    [t],
  );

  const handleActivityPolicyChange = (
    profileField: string,
    nextValue: string,
  ) => {
    if (nextValue === NOT_ACTIVE_VALUE) {
      updateRow(profileField, { isActive: false });
      return;
    }
    updateRow(profileField, {
      isActive: true,
      userEditPolicy: nextValue as ProfileFieldDraftRow['userEditPolicy'],
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 font-sans min-h-0">
      {toast ? <AppToast type={toast.type} text={toast.text} /> : null}

      <div className="flex-1 overflow-auto">
        {settingsQuery.isLoading ? (
          <div className={cn('flex items-center justify-center h-40', typo.loadingText)}>
            {t('settings.forms.profileFields.loading')}
          </div>
        ) : settingsQuery.isError ? (
          <QueryErrorPanel
            message={t('settings.forms.profileFields.loadError')}
            detail={formatQueryError(settingsQuery.error, t('settings.forms.profileFields.loadError'))}
            onRetry={() => void settingsQuery.refetch()}
            isRetrying={settingsQuery.isFetching}
          />
        ) : (
          <table className={cn(APP_TABLE_GRID_TABLE_CLASS, 'table-fixed text-xs')}>
            <colgroup>
              <col className={FIELD_COLUMN_WIDTH_CLASS} />
              <col className={POLICY_COLUMN_WIDTH_CLASS} />
              <col />
            </colgroup>
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, FIELD_COLUMN_WIDTH_CLASS, 'text-left')}>
                  {t('settings.forms.profileFields.columnField')}
                </th>
                <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, POLICY_COLUMN_WIDTH_CLASS, 'text-left')}>
                  {t('settings.forms.profileFields.columnPolicy')}
                </th>
                <th className={cn(APP_TABLE_GRID_HEADER_CELL_CLASS, 'text-left')}>
                  {t('settings.forms.profileFields.columnLabelEn')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {draftRows.map((row) => (
                <tr key={row.profileField} className="hover:bg-slate-50 transition-colors">
                  <td className={cn(APP_TABLE_GRID_CELL_PR_CLASS, FIELD_COLUMN_WIDTH_CLASS, 'py-3')}>
                    <div className={cn(typo.gridPrimary, 'truncate')} title={row.profileFieldLabel}>
                      {row.profileFieldLabel}
                    </div>
                    <div className={cn(typo.gridMono, 'mt-0.5 truncate')} title={row.profileField}>
                      {row.profileField}
                    </div>
                  </td>
                  <td className={cn(APP_TABLE_GRID_CELL_PR_CLASS, POLICY_COLUMN_WIDTH_CLASS, 'py-3')}>
                    <ActivityPolicyDropdown
                      value={resolveActivityPolicyValue(row)}
                      options={activityPolicyOptions}
                      disabled={isSaving}
                      ariaLabel={t('settings.forms.profileFields.columnPolicy')}
                      onChange={(nextValue) => handleActivityPolicyChange(row.profileField, nextValue)}
                    />
                  </td>
                  <td className={cn(APP_TABLE_GRID_CELL_PR_CLASS, 'py-3')}>
                    <UiInput
                      size="sm"
                      value={row.labelEn}
                      disabled={!row.isActive || isSaving}
                      onChange={(e) => updateRow(row.profileField, { labelEn: e.target.value })}
                      className="w-full"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {saveError ? (
        <div className="border-t border-slate-200 px-5 py-2 text-xs text-rose-600 font-semibold">
          {saveError}
        </div>
      ) : null}

      <div className={cn('border-t border-slate-200 px-5 py-3 bg-slate-50/80', typo.footerNote)}>
        {t('settings.forms.profileFields.footer', {
          policy: t('settings.forms.profileFields.policyEditableWhenEmpty'),
        })}
      </div>
    </div>
  );
};
