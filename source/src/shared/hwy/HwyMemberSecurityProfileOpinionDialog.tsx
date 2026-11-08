import React, { useEffect, useRef, useState } from 'react';
import { BadgeCheck, IdCard, ShieldCheck, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { MountGridDateText } from '../../app/platform/MountGridDateText';
import { useCulture } from '../../core/culture/CultureContext';
import type { HwyCandidatePipelineSecurityProfilePayload, HwySecurityOpinionCode } from '../../domain/hwy/hwyCandidatePipeline';
import type { HwyMemberDossierSecurityProfileRow } from '../../domain/hwy/hwyMemberDossierSatellites';
import {
  resolveSecurityClearanceStatusTone,
  SECURITY_CLEARANCE_STATUS_BADGE_CLASS,
} from '../../domain/hwy/hwyMemberDossierSecurityClearancePresentation';
import { HWY_SECURITY_OPINION_OPTIONS } from '../../domain/hwy/hwyCandidatePipelineUiConstants';
import { cn } from '../../lib/utils';
import { AppButton } from '../ui/AppButton';
import { AppSurfaceBox } from '../ui/AppSurfaceBox';
import { ConfirmDialogShell } from '../ui/ConfirmDialogShell';
import { UiRadioGroup } from '../ui/HeroFieldControls';
import { UiTextarea } from '../ui/ai-field-assist/AiAssistTextarea';
import type { AppSurfaceBoxTone } from '../ui/surfaceClasses';
import { SHADOW_RAISED } from '../ui/surfaceClasses';
import { TYPE_CAPTION_CLASS } from '../ui/typographyRoles';

export type HwyMemberSecurityProfileOpinionMemberRow = {
  id: string;
  firstName?: string | null;
  fatherName?: string | null;
  grandFatherName?: string | null;
  lastName?: string | null;
};

type Props = {
  open: boolean;
  row: HwyMemberSecurityProfileOpinionMemberRow | null;
  /** Prefill dimensions from the latest stored opinion (append-only workflow). */
  seedFromLatest?: HwyMemberDossierSecurityProfileRow | null;
  readOnly?: boolean;
  /** Pipeline view intent (grid «view») — used for empty-record message like interview. */
  viewModeRequested?: boolean;
  profileFetchSettled?: boolean;
  isLoadingLatest?: boolean;
  isSubmitting: boolean;
  t: (key: string, fallback: string) => string;
  onClose: () => void;
  onStartAnotherOpinion?: () => void;
  onSubmit: (payload: HwyCandidatePipelineSecurityProfilePayload) => void;
};

type DimensionState = {
  value: HwySecurityOpinionCode;
  note: string;
};

type DimensionSpec = {
  id: string;
  titleKey: string;
  titleFallback: string;
  noteKey: string;
  noteFallback: string;
  icon: LucideIcon;
  tone: AppSurfaceBoxTone;
};

const SECURITY_DIMENSION_SPECS: DimensionSpec[] = [
  {
    id: 'identityCard',
    titleKey: 'hwy.candidatePipeline.security.dim.identityCard',
    titleFallback: 'May receive a Hawiety badge',
    noteKey: 'hwy.candidatePipeline.security.dim.identityCardNote',
    noteFallback: 'Badge eligibility — notes',
    icon: IdCard,
    tone: 'cyan',
  },
  {
    id: 'masooliat',
    titleKey: 'hwy.candidatePipeline.security.dim.masooliat',
    titleFallback: 'May receive responsibility (maktab / region)',
    noteKey: 'hwy.candidatePipeline.security.dim.masooliatNote',
    noteFallback: 'Responsibility eligibility — notes',
    icon: ShieldCheck,
    tone: 'indigo',
  },
  {
    id: 'aammeh',
    titleKey: 'hwy.candidatePipeline.security.dim.aammeh',
    titleFallback: 'May be nominated for general assembly membership',
    noteKey: 'hwy.candidatePipeline.security.dim.aammehNote',
    noteFallback: 'General assembly — notes',
    icon: Users,
    tone: 'emerald',
  },
  {
    id: 'responsibility',
    titleKey: 'hwy.candidatePipeline.security.dim.responsibility',
    titleFallback: 'Allows responsibility assignment',
    noteKey: 'hwy.candidatePipeline.security.dim.responsibilityNote',
    noteFallback: 'Responsibility assignment — notes',
    icon: BadgeCheck,
    tone: 'violet',
  },
];

const defaultDimension = (): DimensionState => ({ value: 211753, note: '' });

const dimensionFromProfile = (
  code: string | undefined,
  note: string | undefined,
): DimensionState => {
  const parsed = Number(code);
  return {
    value: (Number.isFinite(parsed) ? parsed : 211753) as HwySecurityOpinionCode,
    note: note?.trim() ?? '',
  };
};

const OpinionStatusBadge: React.FC<{ label: string }> = ({ label }) => {
  const tone = resolveSecurityClearanceStatusTone(label);
  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-snug',
        SECURITY_CLEARANCE_STATUS_BADGE_CLASS[tone],
      )}
    >
      {label}
    </span>
  );
};

export const HwyMemberSecurityProfileOpinionDialog: React.FC<Props> = ({
  open,
  row,
  seedFromLatest,
  readOnly = false,
  viewModeRequested = false,
  profileFetchSettled = false,
  isLoadingLatest = false,
  isSubmitting,
  t,
  onClose,
  onStartAnotherOpinion,
  onSubmit,
}) => {
  const { direction, t: cultureT } = useCulture();
  const isRtl = direction === 'rtl';
  const formSeedKeyRef = useRef('');
  const [identityCard, setIdentityCard] = useState<DimensionState>(defaultDimension);
  const [masooliat, setMasooliat] = useState<DimensionState>(defaultDimension);
  const [aammeh, setAammeh] = useState<DimensionState>(defaultDimension);
  const [responsibility, setResponsibility] = useState<DimensionState>(defaultDimension);

  const dimensionStates: Record<string, { state: DimensionState; setState: React.Dispatch<React.SetStateAction<DimensionState>> }> = {
    identityCard: { state: identityCard, setState: setIdentityCard },
    masooliat: { state: masooliat, setState: setMasooliat },
    aammeh: { state: aammeh, setState: setAammeh },
    responsibility: { state: responsibility, setState: setResponsibility },
  };

  const applyProfileSeed = (profile: HwyMemberDossierSecurityProfileRow) => {
    setIdentityCard(dimensionFromProfile(profile.canGetIdentityCardCode, profile.canGetIdentityCardNote));
    setMasooliat(dimensionFromProfile(profile.canGetResponsibilityCode, profile.canGetResponsibilityNote));
    setAammeh(dimensionFromProfile(profile.canJoinGeneralBodyCode, profile.canJoinGeneralBodyNote));
    setResponsibility(dimensionFromProfile(profile.allowsResponsibilityCode, profile.allowsResponsibilityNote));
  };

  useEffect(() => {
    if (!open || !row) {
      formSeedKeyRef.current = '';
      return;
    }
    if (isLoadingLatest) {
      return;
    }

    const seedKey = `${row.id}:${readOnly ? 'view' : 'edit'}`;
    if (formSeedKeyRef.current === seedKey) {
      return;
    }
    formSeedKeyRef.current = seedKey;

    if (readOnly) {
      if (seedFromLatest) {
        applyProfileSeed(seedFromLatest);
      }
      return;
    }

    if (seedFromLatest) {
      applyProfileSeed(seedFromLatest);
      return;
    }

    setIdentityCard(defaultDimension());
    setMasooliat(defaultDimension());
    setAammeh(defaultDimension());
    setResponsibility(defaultDimension());
  }, [open, row?.id, readOnly, isLoadingLatest, seedFromLatest]);

  const memberLabel = row
    ? [row.firstName, row.fatherName, row.grandFatherName, row.lastName].filter(Boolean).join(' ')
    : '';

  const opinionOptions = HWY_SECURITY_OPINION_OPTIONS.map((o) => ({
    value: String(o.value),
    label: t(`hwy.candidatePipeline.security.opinion.${o.value}`, o.labelEn),
  }));

  const resolveOpinionLabel = (code: HwySecurityOpinionCode) => (
    opinionOptions.find((o) => o.value === String(code))?.label ?? String(code)
  );

  const dialogTitle = t('hwy.candidatePipeline.security.dialogTitle', 'Supervisory security profile');
  const readOnlyWithRecord = readOnly && Boolean(seedFromLatest);
  const recordedAt = seedFromLatest?.createdAt?.trim();
  const showViewNotFound = viewModeRequested && profileFetchSettled && !isLoadingLatest && !seedFromLatest;
  const showDimensionGrid = !isLoadingLatest && !showViewNotFound;

  const renderDimension = (spec: DimensionSpec) => {
    const { state, setState } = dimensionStates[spec.id];
    const Icon = spec.icon;
    const title = t(spec.titleKey, spec.titleFallback);
    const noteLabel = t(spec.noteKey, spec.noteFallback);

    return (
      <AppSurfaceBox
        key={spec.id}
        tone={spec.tone}
        className={cn('shadow-xs', SHADOW_RAISED)}
        bodyClassName="space-y-3 p-3 sm:p-3.5"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 inline-flex shrink-0 rounded-lg bg-white/80 p-1.5 text-slate-700 ring-1 ring-slate-200/80">
              <Icon className="size-4" aria-hidden />
            </span>
            <h3 className="min-w-0 text-sm font-semibold leading-snug text-slate-900">{title}</h3>
          </div>
          {readOnly ? (
            <OpinionStatusBadge label={resolveOpinionLabel(state.value)} />
          ) : null}
        </div>

        {!readOnly ? (
          <UiRadioGroup
            name={`${spec.id}-opinion`}
            value={String(state.value)}
            onChange={(next) => setState((prev) => ({ ...prev, value: Number(next) as HwySecurityOpinionCode }))}
            options={opinionOptions}
            orientation="horizontal"
          />
        ) : null}

        <div className="space-y-1">
          {!readOnly ? (
            <p className={cn('text-xs text-slate-600', TYPE_CAPTION_CLASS)}>{noteLabel}</p>
          ) : null}
          {readOnly ? (
            <p className="min-h-[2.5rem] whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {state.note.trim() || t('hwy.candidatePipeline.security.noteEmpty', '—')}
            </p>
          ) : (
            <UiTextarea
              id={`${spec.noteKey}-input`}
              aiAssist={false}
              ariaLabel={noteLabel}
              placeholder={noteLabel}
              value={state.note}
              onChange={(event) => setState((prev) => ({ ...prev, note: event.target.value }))}
              rows={2}
            />
          )}
        </div>
      </AppSurfaceBox>
    );
  };

  return (
    <ConfirmDialogShell
      open={open}
      size="5xl"
      bodyFill
      tone="default"
      iconToneClassName="text-primary-700"
      title={dialogTitle}
      subtitle={
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          lang={isRtl ? 'ar' : undefined}
          className="flex w-full min-w-0 flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2"
        >
          <span className="min-w-0 flex-1 truncate text-start text-base font-semibold text-slate-900 sm:text-lg">
            {memberLabel || t('hwy.candidatePipeline.security.candidatePlaceholder', 'Candidate')}
          </span>
          {readOnlyWithRecord && recordedAt ? (
            <div className="flex shrink-0 flex-row flex-wrap items-center justify-start gap-x-2 gap-y-1 text-sm">
              <span className="font-bold text-primary-700">
                {t('hwy.candidatePipeline.security.recordedOn', 'Recorded on')}
              </span>
              <span className="font-medium tabular-nums text-slate-800">
                <MountGridDateText value={recordedAt} align="start" />
              </span>
            </div>
          ) : null}
        </div>
      }
      subtitleTone="elevated"
      subtitleClassName="overflow-visible py-2.5 text-sm text-slate-800"
      onClose={onClose}
      cancelLabel={cultureT('actions.cancel', 'Cancel')}
      confirmLabel={
        readOnly
          ? t('hwy.candidatePipeline.security.close', 'Close')
          : t('hwy.candidatePipeline.security.confirmOk', 'Register opinion')
      }
      confirmingLabel={cultureT('actions.saving', 'Saving…')}
      confirmIntent="primary"
      isConfirming={isSubmitting}
      hideCancel={readOnly || showViewNotFound}
      hideConfirm={readOnlyWithRecord || showViewNotFound}
      footer={
        readOnlyWithRecord ? (
          <>
            <AppButton intent="cancel" size="sm" onClick={onClose} disabled={isSubmitting}>
              {t('hwy.candidatePipeline.security.close', 'Close')}
            </AppButton>
            <AppButton
              intent="primary"
              size="sm"
              onClick={() => onStartAnotherOpinion?.()}
              disabled={isSubmitting}
            >
              {t('hwy.candidatePipeline.security.registerAnother', 'Register new opinion')}
            </AppButton>
          </>
        ) : showViewNotFound ? (
          <>
            <AppButton intent="cancel" size="sm" onClick={onClose} disabled={isSubmitting}>
              {t('hwy.candidatePipeline.security.close', 'Close')}
            </AppButton>
            <AppButton
              intent="primary"
              size="sm"
              onClick={() => onStartAnotherOpinion?.()}
              disabled={isSubmitting}
            >
              {t('hwy.candidatePipeline.security.register', 'Register opinion')}
            </AppButton>
          </>
        ) : undefined
      }
      onConfirm={() => {
        if (readOnly) {
          onClose();
          return;
        }
        if (!row) return;
        onSubmit({
          memberId: row.id,
          canGetIdentityCard: identityCard.value,
          canGetIdentityCardNote: identityCard.note.trim() || undefined,
          canGetMasooliat: masooliat.value,
          canGetMasooliatNote: masooliat.note.trim() || undefined,
          canBeMemberOfAammeh: aammeh.value,
          canBeMemberOfAammehNote: aammeh.note.trim() || undefined,
          allowsResponsibility: responsibility.value,
          allowsResponsibilityNote: responsibility.note.trim() || undefined,
        });
      }}
      confirmDisabled={readOnly ? false : !row || isLoadingLatest}
    >
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className={cn(
          'max-h-[min(78vh,38rem)] overflow-y-auto py-1',
          isRtl ? 'ps-0.5' : 'pe-0.5',
        )}
      >
        {isLoadingLatest ? (
          <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">
            {SECURITY_DIMENSION_SPECS.map((spec) => (
              <div
                key={spec.id}
                className="h-36 animate-pulse rounded-xl border border-slate-200/80 bg-slate-50/60"
              />
            ))}
            <p className="lg:col-span-2 text-center text-sm text-slate-600">
              {t('hwy.candidatePipeline.security.loading', 'Loading security profile…')}
            </p>
          </div>
        ) : null}

        {showViewNotFound ? (
          <AppSurfaceBox tone="slate" className="shadow-xs" bodyClassName="px-4 py-6 text-center">
            <p className="text-sm leading-relaxed text-slate-700">
              {t('hwy.candidatePipeline.security.notFound', 'No security opinion is recorded for this member.')}
            </p>
          </AppSurfaceBox>
        ) : null}

        {showDimensionGrid ? (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {SECURITY_DIMENSION_SPECS.map((spec) => renderDimension(spec))}
          </div>
        ) : null}
      </div>
    </ConfirmDialogShell>
  );
};
