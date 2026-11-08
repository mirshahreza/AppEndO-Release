import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, UserPlus } from 'lucide-react';
import { showAppFeedbackToast } from '../appFeedbackToast';
import type { HwyGeoResponsibilityLevel } from '../../../domain/hwy/hwyGeoResponsibilityCatalog';
import { findHwyGeoResponsibilityRoleSpecByRoleName } from '../../../domain/hwy/hwyGeoResponsibilityCatalog';
import {
  resolveHwyGeoResponsibilityGenderSlot,
  type HwyGeoResponsibilityNominationCandidateRow,
} from '../../../domain/hwy/hwyGeoResponsibilityNomination';
import { formatHwyGeoResponsibilityMemberDisplayName } from '../../../domain/hwy/hwyGeoResponsibilityMemberDisplay';
import { formatHwyGeoResponsibilityNominationPatchLines } from '../../../domain/hwy/hwyGeoResponsibilityNominationDisplay';
import { listHwyGeoResponsibilityNominationCandidates } from '../../../domain/hwy/hwyGeoResponsibility';
import { resolveMemberDirectoryFaceImageUrl } from '../../../domain/hwy/hwyMemberImageFixCatalog';
import { listHwyMemberRashhPickerCandidates } from '../../../domain/hwy/hwyMemberRashhPicker';
import type { HwyMemberRashhListSelectionPurpose } from '../../../domain/hwy/hwyMemberSelectionPurpose';
import { HwyGeoResponsibilityMemberFace } from './HwyGeoResponsibilityMemberFace';
import type { HwyGeoResponsibilityNominationMemberFilters } from '../../../domain/hwy/hwyGeoResponsibilityNominationSearch';
import { HwyGeoResponsibilityElectoralCascadeFilters } from './HwyGeoResponsibilityElectoralCascadeFilters';
import type { HwyGeoResponsibilityNominationCandidateQueryScope } from '../../../domain/hwy/hwyGeoResponsibilityElectoralCascade';
import {
  formatHwySecurityClearanceStatusLabel,
  SECURITY_CLEARANCE_STATUS_BADGE_CLASS,
  resolveSecurityClearanceStatusTone,
} from '../../../domain/hwy/hwyMemberDossierSecurityClearancePresentation';
import type { AppTableGridColumnDef } from '../../lib/appTableGridQuery';
import { cn } from '../../../lib/utils';
import { AppButton } from '../AppButton';
import { AppTableGrid } from '../AppTableGrid';
import {
  resolveHwyListPageGridErrorContent,
  resolveHwyListPageGridLoadingMessage,
} from './hwyListPageGridState';
import { CreateEditModalShell } from '../CreateEditModalShell';
import { UiInput } from '../ai-field-assist/AiAssistInput';

const SEARCH_DEBOUNCE_MS = 300;
/** Nomination picker loads one fixed batch — no in-dialog paging. */
const NOMINATION_CANDIDATE_LIMIT = 50;

const EMPTY_CELL = (
  <span className="text-xs text-slate-400" aria-hidden>
    —
  </span>
);

/** Row-end selection badge — sits above grid scroll chrome (overlay scrollbars use z-30). */
const NominationRowSelectionBadge: React.FC<{ visible: boolean }> = ({ visible }) => (
  visible ? (
    <span
      className={cn(
        'pointer-events-none absolute top-1/2 z-[60] flex h-9 w-9 -translate-y-1/2 items-center justify-center',
        'rounded-full border-2 border-emerald-500 bg-emerald-50 text-emerald-600 shadow-lg',
        'end-2',
      )}
      aria-hidden
    >
      <Check className="h-5 w-5" strokeWidth={2.5} />
    </span>
  ) : null
);

const EMPTY_MEMBER_FILTERS: HwyGeoResponsibilityNominationMemberFilters = {
  membershipNumber: '',
  firstName: '',
  fatherName: '',
  grandfatherName: '',
  familyName: '',
};

export type HwyMemberRashhPickerDialogProps = {
  open: boolean;
  onClose: () => void;
  t: (key: string, fallback: string) => string;
  title: React.ReactNode;
  listLevel: HwyGeoResponsibilityLevel;
  initialGeoBaseInfoId?: string;
  selectionPurpose: HwyMemberRashhListSelectionPurpose;
  nominationTargetGeoBaseInfoId?: string;
  nominationTargetLevel?: HwyGeoResponsibilityLevel;
  confirmLabel: string;
  confirmPending?: boolean;
  onConfirm: (member: HwyGeoResponsibilityNominationCandidateRow) => void | Promise<void>;
};

export const HwyMemberRashhPickerDialog: React.FC<HwyMemberRashhPickerDialogProps> = ({
  open,
  onClose,
  t,
  title,
  listLevel,
  initialGeoBaseInfoId = '',
  selectionPurpose,
  nominationTargetGeoBaseInfoId = '',
  nominationTargetLevel,
  confirmLabel,
  confirmPending = false,
  onConfirm,
}) => {
  const openMemberPick = selectionPurpose === 'coursesActivitiesAttendee'
    || selectionPurpose === 'coursesActivitiesTrainer';

  const [memberFilters, setMemberFilters] = useState(EMPTY_MEMBER_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState(EMPTY_MEMBER_FILTERS);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const rowGeoBaseInfoId = nominationTargetGeoBaseInfoId.trim() || initialGeoBaseInfoId.trim();
  const [candidateQueryScope, setCandidateQueryScope] = useState<HwyGeoResponsibilityNominationCandidateQueryScope | null>(() => (
    rowGeoBaseInfoId ? { level: listLevel, geoBaseInfoId: rowGeoBaseInfoId } : null
  ));
  const handleFilterScopeChange = useCallback((scope: HwyGeoResponsibilityNominationCandidateQueryScope | null) => {
    setCandidateQueryScope(scope);
  }, []);
  const nominationGeoBaseInfoId = candidateQueryScope?.geoBaseInfoId?.trim() ?? '';
  const nominationQueryLevel = candidateQueryScope?.level ?? listLevel;

  useEffect(() => {
    if (!open) {
      return;
    }
    setMemberFilters(EMPTY_MEMBER_FILTERS);
    setDebouncedFilters(EMPTY_MEMBER_FILTERS);
    setSelectedMemberId(null);
    setCandidateQueryScope(rowGeoBaseInfoId ? { level: listLevel, geoBaseInfoId: rowGeoBaseInfoId } : null);
  }, [listLevel, open, rowGeoBaseInfoId]);

  useEffect(() => {
    setSelectedMemberId(null);
  }, [nominationGeoBaseInfoId, nominationQueryLevel]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedFilters(memberFilters), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [memberFilters]);

  useEffect(() => {
    setSelectedMemberId(null);
  }, [debouncedFilters]);

  const candidatesQuery = useQuery({
    queryKey: [
      'hwy-member-rashh-picker-candidates',
      selectionPurpose,
      nominationQueryLevel,
      nominationGeoBaseInfoId,
      rowGeoBaseInfoId,
      listLevel,
      debouncedFilters,
    ],
    queryFn: () => {
      const filters = {
        membershipNumber: debouncedFilters.membershipNumber,
        firstName: debouncedFilters.firstName,
        fatherName: debouncedFilters.fatherName,
        grandfatherName: debouncedFilters.grandfatherName,
        familyName: debouncedFilters.familyName,
        page: 1,
        pageSize: NOMINATION_CANDIDATE_LIMIT,
      };
      if (openMemberPick) {
        return listHwyMemberRashhPickerCandidates({
          level: nominationQueryLevel,
          geoBaseInfoId: nominationGeoBaseInfoId,
          selectionPurpose,
          ...filters,
        });
      }
      return listHwyGeoResponsibilityNominationCandidates({
        level: nominationQueryLevel,
        geoBaseInfoId: nominationGeoBaseInfoId,
        nominationTargetGeoBaseInfoId: rowGeoBaseInfoId,
        nominationTargetLevel: nominationTargetLevel ?? listLevel,
        ...filters,
      });
    },
    enabled: open && Boolean(nominationGeoBaseInfoId),
    retry: 1,
  });

  const nominationStatusLabel = useCallback((
    row: HwyGeoResponsibilityNominationCandidateRow,
  ): string | null => {
    if (!row.blockedReason) {
      return null;
    }
    if (row.blockedReason === 'official_at_node') {
      return t('hwy.geoResponsibility.nominate.blocked.officialAtNode', 'Already official on this patch');
    }
    if (row.blockedReason === 'has_responsibility') {
      const role = row.activeRoleName ?? '';
      const geo = row.activeGeoTitle ?? '';
      return t(
        'hwy.geoResponsibility.nominate.blocked.hasResponsibility',
        role && geo ? `Already responsible (${role} · ${geo})` : 'Already holds area responsibility',
      );
    }
    if (row.blockedReason === 'member_gender_unknown') {
      return t('hwy.geoResponsibility.nominate.blocked.memberGender', 'Member gender is required');
    }
    if (row.blockedReason === 'no_user') {
      return t('hwy.geoResponsibility.nominate.blocked.noUser', 'No linked user account');
    }
    if (row.blockedReason === 'clearance_denied') {
      return t('hwy.geoResponsibility.nominate.blocked.clearance', 'Not cleared for responsibility');
    }
    return null;
  }, [t]);

  const columns = useMemo((): AppTableGridColumnDef<HwyGeoResponsibilityNominationCandidateRow>[] => [
    {
      id: 'member',
      label: t('hwy.geoResponsibility.column.member', 'Member'),
      textDirection: 'culture',
      width: '15rem',
      wrap: true,
      cellClassName: '!overflow-visible',
      getCellClassName: () => '!overflow-visible',
      renderCell: (row) => {
        const resolvedSlot = resolveHwyGeoResponsibilityGenderSlot(row.genderCode);
        const slot = resolvedSlot === 'female' ? 'female' : resolvedSlot === 'male' ? 'male' : undefined;
        const avatarUrl = String(row.avatarUrl ?? '').trim()
          || resolveMemberDirectoryFaceImageUrl(row as Record<string, unknown>)
          || null;
        return (
          <HwyGeoResponsibilityMemberFace
            key={row.id}
            displayName={formatHwyGeoResponsibilityMemberDisplayName(row.displayFullName)}
            username={row.username}
            membershipFallbackId={row.id}
            avatarUrl={avatarUrl}
            badge=""
            badgeClassName=""
            plain
            showBadge={false}
            density="compact"
            genderAccent={slot}
          />
        );
      },
    },
    {
      id: 'patch',
      label: t('hwy.geoResponsibility.nominate.column.patch', 'Patch'),
      textDirection: 'culture',
      width: '13rem',
      wrap: true,
      renderCell: (row) => {
        const lines = formatHwyGeoResponsibilityNominationPatchLines(row.electoralDivisionPath);
        if (!lines) {
          return EMPTY_CELL;
        }
        return (
          <div className="min-w-0 space-y-0.5 text-xs leading-snug">
            <div className="font-semibold text-slate-900" title={lines.leaf}>
              {lines.leaf}
            </div>
            {lines.ancestors ? (
              <div
                className="line-clamp-2 font-normal text-slate-500"
                title={lines.ancestors}
              >
                {lines.ancestors}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'supervisory',
      label: t('hwy.geoResponsibility.nominate.column.supervisoryOpinion', 'Supervisory opinion'),
      textDirection: 'culture',
      width: '9rem',
      wrap: true,
      renderCell: (row) => {
        const raw = row.canGetResponsibilityTitle?.trim()
          || row.canGetResponsibilityNote?.trim()
          || null;
        const title = formatHwySecurityClearanceStatusLabel(raw, t);
        const tone = resolveSecurityClearanceStatusTone(raw ?? '');
        return (
          <span
            className={`inline-flex max-w-full rounded-md border px-2 py-0.5 text-[11px] font-medium leading-snug ${SECURITY_CLEARANCE_STATUS_BADGE_CLASS[tone]}`}
          >
            {title}
          </span>
        );
      },
    },
    {
      id: 'division',
      label: t('hwy.geoResponsibility.nominate.column.division', 'Division'),
      textDirection: 'culture',
      width: '6.5rem',
      renderCell: (row) => {
        const raw = row.allowsResponsibilityTitle?.trim() ?? '';
        if (!raw) {
          return EMPTY_CELL;
        }
        const title = formatHwySecurityClearanceStatusLabel(raw, t);
        const tone = resolveSecurityClearanceStatusTone(raw);
        const yes = tone === 'success';
        return (
          <span className={`text-xs font-semibold ${yes ? 'text-emerald-600' : 'text-rose-600'}`}>
            {title}
          </span>
        );
      },
    },
    {
      id: 'status',
      label: t('hwy.geoResponsibility.nominate.column.status', 'Nomination status'),
      textDirection: 'culture',
      width: '10rem',
      wrap: true,
      renderCell: (row) => {
        const label = nominationStatusLabel(row);
        if (!label) {
          return EMPTY_CELL;
        }
        return (
          <span className="text-xs font-medium leading-snug text-amber-800">
            {label}
          </span>
        );
      },
    },
    {
      id: 'otherResponsibility',
      label: t('hwy.geoResponsibility.nominate.column.otherResponsibility', 'Other responsibility'),
      textDirection: 'culture',
      width: '10rem',
      wrap: true,
      getCellClassName: () => '!overflow-visible',
      renderCell: (row) => {
        const isSelected = selectedMemberId === row.id;
        let body: React.ReactNode = EMPTY_CELL;
        if (row.hasOtherResponsibility && row.activeRoleName) {
          const roleSpec = findHwyGeoResponsibilityRoleSpecByRoleName(row.activeRoleName);
          const roleLabel = roleSpec
            ? t(roleSpec.labelKey, roleSpec.level)
            : row.activeRoleName;
          body = (
            <div className="min-w-0 space-y-0.5 text-xs">
              <span className="inline-flex rounded bg-emerald-100/90 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                {roleLabel}
              </span>
              {row.activeGeoTitle ? (
                <div className="line-clamp-2 font-medium leading-snug text-emerald-900" title={row.activeGeoTitle}>
                  {row.activeGeoTitle}
                </div>
              ) : null}
            </div>
          );
        }
        return (
          <div className="relative min-h-9 w-full min-w-0 pe-10">
            <NominationRowSelectionBadge visible={isSelected} />
            {body}
          </div>
        );
      },
    },
  ], [nominationStatusLabel, selectedMemberId, t]);

  const rows = candidatesQuery.data?.rows ?? [];
  const selectedMember = useMemo(
    () => rows.find((row) => row.id === selectedMemberId) ?? null,
    [rows, selectedMemberId],
  );
  const candidatesInitialLoading = candidatesQuery.isFetching && rows.length === 0 && !candidatesQuery.isError;
  const busy = confirmPending;
  const canLoadCandidates = Boolean(nominationGeoBaseInfoId);

  const handleConfirmSelection = useCallback(async () => {
    const reportError = (message: string) => {
      setSubmitError(message);
      showAppFeedbackToast(message, { type: 'error' });
    };

    if (!selectedMemberId) {
      reportError(t(
        'hwy.geoResponsibility.toast.nominateSelectMember',
        'Select a member from the list first.',
      ));
      return;
    }
    const member = rows.find((row) => row.id === selectedMemberId) ?? selectedMember;
    if (!member) {
      reportError(t(
        'hwy.geoResponsibility.toast.nominateSelectMember',
        'Select a member from the list first.',
      ));
      return;
    }
    if (!openMemberPick && !member.selectable) {
      reportError(nominationStatusLabel(member) ?? t(
        'hwy.geoResponsibility.toast.nominateFailed',
        'This member cannot be selected.',
      ));
      return;
    }
    if (!openMemberPick) {
      const genderSlot = resolveHwyGeoResponsibilityGenderSlot(member.genderCode);
      if (genderSlot !== 'male' && genderSlot !== 'female') {
        reportError(t(
          'hwy.geoResponsibility.toast.nominateGenderRequired',
          'Member gender is required to nominate.',
        ));
        return;
      }
    }
    setSubmitError(null);
    try {
      await onConfirm(member);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : t(
        'hwy.geoResponsibility.toast.nominateFailed',
        'Could not complete selection.',
      );
      reportError(message);
    }
  }, [nominationStatusLabel, onClose, onConfirm, openMemberPick, rows, selectedMember, selectedMemberId, t]);

  if (!open) {
    return null;
  }

  return (
    <CreateEditModalShell
      size="maximized"
      title={(
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700">
            <UserPlus className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="truncate font-semibold text-indigo-950">
            {title}
          </span>
        </span>
      )}
      onClose={onClose}
      onBackdropClick={busy ? undefined : onClose}
      closeOnEscape={!busy}
      shellClassName="flex flex-col overflow-hidden"
      bodyOuterClassName="flex min-h-0 flex-1 flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !p-0"
      footerClassName="relative z-10 shrink-0 justify-center"
      footer={(
        <div className="flex w-full flex-col items-center gap-2">
          {submitError ? (
            <p className="max-w-lg text-center text-xs font-medium text-rose-700" role="alert">
              {submitError}
            </p>
          ) : null}
          <AppButton
            intent="primary"
            size="sm"
            className="!bg-indigo-600 hover:!bg-indigo-700"
            disabled={busy || !canLoadCandidates || !selectedMemberId}
            onClick={() => void handleConfirmSelection()}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
            {confirmLabel}
          </AppButton>
        </div>
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 space-y-2 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <HwyGeoResponsibilityElectoralCascadeFilters
            open={open}
            listLevel={listLevel}
            initialGeoBaseInfoId={initialGeoBaseInfoId}
            filterKindMode={openMemberPick ? 'memberRashh' : 'nomination'}
            t={t}
            onFilterScopeChange={handleFilterScopeChange}
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <UiInput
              size="sm"
              label={t('hwy.geoResponsibility.nominate.username', 'Membership number')}
              value={memberFilters.membershipNumber ?? ''}
              onChange={(event) => setMemberFilters((prev) => ({
                ...prev,
                membershipNumber: event.target.value,
              }))}
              aiAssist={false}
            />
            <UiInput
              size="sm"
              label={t('hwy.geoResponsibility.nominate.filter.firstName', 'First name')}
              value={memberFilters.firstName ?? ''}
              onChange={(event) => setMemberFilters((prev) => ({
                ...prev,
                firstName: event.target.value,
              }))}
              aiAssist={false}
            />
            <UiInput
              size="sm"
              label={t('hwy.geoResponsibility.nominate.filter.fatherName', 'Father name')}
              value={memberFilters.fatherName ?? ''}
              onChange={(event) => setMemberFilters((prev) => ({
                ...prev,
                fatherName: event.target.value,
              }))}
              aiAssist={false}
            />
            <UiInput
              size="sm"
              label={t('hwy.geoResponsibility.nominate.filter.grandfatherName', 'Grandfather name')}
              value={memberFilters.grandfatherName ?? ''}
              onChange={(event) => setMemberFilters((prev) => ({
                ...prev,
                grandfatherName: event.target.value,
              }))}
              aiAssist={false}
            />
            <UiInput
              size="sm"
              label={t('hwy.geoResponsibility.nominate.filter.familyName', 'Family name')}
              value={memberFilters.familyName ?? ''}
              onChange={(event) => setMemberFilters((prev) => ({
                ...prev,
                familyName: event.target.value,
              }))}
              aiAssist={false}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AppTableGrid
            presentation="auto"
            fillHeight
            margin={0}
            scrollGutter="overlay"
            virtualizeRows={false}
            className="flex h-full min-h-0 flex-1 flex-col"
            tbodyClassName="[&_td:first-child]:!overflow-visible [&_td:first-child>div]:overflow-visible [&_td:first-child>div]:whitespace-normal [&_td:last-child]:!overflow-visible [&_td:last-child>div]:!overflow-visible"
            theadClassName="[&_button]:text-slate-800 [&_span]:font-semibold [&_span]:text-slate-800"
            ariaLabel={t('hwy.geoResponsibility.nominate.grid', 'Nomination candidates')}
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={candidatesInitialLoading}
            loadingMessage={resolveHwyListPageGridLoadingMessage(t)}
            isEmpty={
              !candidatesInitialLoading
              && !candidatesQuery.isError
              && rows.length === 0
            }
            emptyMessage={t('hwy.geoResponsibility.nominate.empty', 'No members in this patch match your search.')}
            errorContent={resolveHwyListPageGridErrorContent(candidatesQuery.error, t)}
            onRowClick={(row) => {
              if (!openMemberPick && !row.selectable) {
                return;
              }
              setSubmitError(null);
              setSelectedMemberId((current) => (current === row.id ? null : row.id));
            }}
            getRowClassName={(row) => cn(
              'cursor-pointer',
              selectedMemberId === row.id
                ? 'bg-emerald-50/70'
                : openMemberPick || row.selectable
                  ? 'hover:bg-slate-50/90'
                  : 'hover:bg-slate-50/90 opacity-90',
            )}
          />
        </div>
      </div>
    </CreateEditModalShell>
  );
};
