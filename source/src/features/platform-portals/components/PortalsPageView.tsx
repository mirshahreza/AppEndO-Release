import React, { useCallback, useMemo, useState } from 'react';
import { Copy, Loader2, Lock, Plus, Save, Trash2, X } from 'lucide-react';
import { formatQueryError, formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import { useComponentDesignerDraftsQuery } from '../../../shared/api/queries/component-designer';
import type { DesignerVersionSummary } from '../../../shared/api/queries/component-designer';
import type {
  ExperienceManifestPortal,
} from '../../../shared/api/contracts/platform/experienceManifest';
import {
  portalUsesRedirectEntry,
  formatPortalUrlSegment,
  isBuiltInHomePortal,
  isBuiltInStudioPortal,
  isBuiltInComponentAlonePortal,
  isOperatorHiddenBuiltinPortal,
  validatePortalSegmentSlug,
} from '../../../shared/api/contracts/platform/experienceManifest';
import { STUDIO_PORTAL_SEGMENT, COMPONENT_ALONE_PORTAL_SEGMENT, HOME_SHELL_KEY, SITE_SHELL_LAYOUT_KEY } from '../../../shared/api/contracts/platform/mountConstants';
import {
  AppButton,
  AppTableGrid,
  CreateEditModalShell,
  FeatureToggleField,
  QueryErrorPanel,
  ToolbarActionGroupWithRefresh,
  ToolbarBuiltInFilter,
  ToolbarSearchInput,
  FormField,
  FormSection,
  UiInput,
  UiSelect,
  UrlSegmentSlugInput,
  resolveFormFieldPairGridClass,
  FORM_THEME_INK_TITLE_CLASS,
  showAppFeedbackToast,
  ListPageToolbarFrame,
  ListPageShell,
} from '../../../shared/ui';
import {
  CREATE_EDIT_MODAL_BODY_INNER_CLASS,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_SINGLE_ROW_CLASS,
} from '../../../shared/ui/surfaceClasses';
import { useCultureT } from '../../../core/culture/CultureContext';
import { columnCommonKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { createPortalGridColumns } from '../portalGridColumns';
import type { PortalsPageModel } from '../hooks/usePortalsPage';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { cn } from '../../../lib/utils';
import {
  buildCanonicalPortalLayoutDesignerHref,
  buildLayoutPickerItems,
  buildNotFoundPagePickerItems,
  formatPortalLayoutComponentPath,
  formatPortalLayoutDisplay,
  resolvePortalLayoutDesignerKey,
  toLayoutPickerKey,
} from '../lib/portalDesigner';
import { PortalAccessModal } from './PortalAccessModal';
import { PortalBrandFields, mergePortalBrand, normalizePortalBrandForSave } from './PortalBrandFields';
import { withPortalBrandDefaults, type PortalBrand } from '../../../shared/api/contracts/platform/portalBrand';
import {
  HWY_PLATFORM_PORTAL_BRAND_WINDOW_TITLE,
  HWY_PLATFORM_PORTAL_SHELL_KEY,
} from '../../../domain/hwy/hwyPlatformPortalBrandDefaults';
import { PortalDeleteConfirmModal } from './PortalDeleteConfirmModal';
import { PortalNavigationsModal } from './PortalNavigationsModal';
import { uploadPortalLogo, usePlatformCulturesQuery } from '../../../shared/api/queries/platform';

type PortalsPageViewProps = {
  page: PortalsPageModel;
};

const APPLICATION_FORM_CONTROL_CLASS = 'min-w-0 w-full !h-8 !min-h-8';
const APPLICATION_FORM_STATIC_CONTROL_CLASS =
  'flex h-8 w-full items-center rounded-md border border-indigo-100 bg-white px-3 text-sm text-slate-700';

const MODAL_MUTATION_OPTIONS = { suppressFormError: true } as const;

function formatPortalMutationError(caught: unknown, fallback: string): string {
  if (isApiError(caught)) {
    return formatApiErrorMessage(caught);
  }

  return caught instanceof Error ? caught.message : fallback;
}

function showPortalFormError(message: string): void {
  showAppFeedbackToast(message, { type: 'error' });
}

function suggestDuplicateDefaults(
  source: ExperienceManifestPortal,
  usedSegments: string[],
  copySuffix: string,
): { segment: string; name: string } {
  const baseSegment = `${source.segment.trim()}-copy`;
  let segment = baseSegment;
  let counter = 2;
  while (usedSegments.includes(segment)) {
    segment = `${baseSegment}-${counter}`;
    counter += 1;
  }

  return {
    segment,
    name: `${source.name.trim()} ${copySuffix}`,
  };
}

export const PortalsPageView: React.FC<PortalsPageViewProps> = ({ page }) => {
  const t = useCultureT();
  const culturesQuery = usePlatformCulturesQuery();
  const componentDraftsQuery = useComponentDesignerDraftsQuery();
  const loadError = page.manifestQuery.isError ? page.manifestQuery.error : null;
  const [modal, setModal] = useState<{
    mode: 'create' | 'edit';
    segment?: string;
    form: ExperienceManifestPortal;
  } | null>(null);
  const [deleteSegment, setDeleteSegment] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<ExperienceManifestPortal | null>(null);
  const [duplicateSegmentInput, setDuplicateSegmentInput] = useState('');
  const [duplicateNameInput, setDuplicateNameInput] = useState('');
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [accessTarget, setAccessTarget] = useState<ExperienceManifestPortal | null>(null);
  const [navigationsTarget, setNavigationsTarget] = useState<ExperienceManifestPortal | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);

  const cultureOptions = culturesQuery.data?.enabledCulturePackIds ?? ['us'];
  const cultureId = page.manifestQuery.data?.cultureId ?? cultureOptions[0] ?? 'us';
  const designerDrafts = (componentDraftsQuery.data ?? []) as DesignerVersionSummary[];

  const resolveEditLayoutHref = useCallback(
    (row: ExperienceManifestPortal) => buildCanonicalPortalLayoutDesignerHref(
      cultureId,
      row,
      designerDrafts,
    ),
    [cultureId, designerDrafts],
  );

  const resolveRowIndex = useCallback(
    (row: ExperienceManifestPortal) => page.portals.indexOf(row),
    [page.portals],
  );

  const resolvePortalBrandForForm = useCallback((row: ExperienceManifestPortal): PortalBrand => {
    const base = withPortalBrandDefaults(row.brand);
    const isHawietyPortal = row.segment === 'hawiety' || row.shellKey === HWY_PLATFORM_PORTAL_SHELL_KEY;
    if (isHawietyPortal && !row.brand?.windowTitle?.trim() && !base.windowTitle?.trim()) {
      return { ...base, windowTitle: HWY_PLATFORM_PORTAL_BRAND_WINDOW_TITLE };
    }
    return base;
  }, []);

  const columns = useMemo(() => createPortalGridColumns({
    resolveRowIndex,
    onEdit: (_index, row) => {
      setModal({
        mode: 'edit',
        segment: row.segment,
        form: {
          ...structuredClone(row),
          shellKey: toLayoutPickerKey(row.shellKey) || row.shellKey,
          brand: resolvePortalBrandForForm(row),
        },
      });
      setPendingLogoFile(null);
    },
    resolveEditLayoutHref,
    onAccess: (_index, application) => {
      setAccessTarget(application);
    },
    onNavigations: (_index, application) => {
      setNavigationsTarget(structuredClone(application));
    },
    onDuplicate: (_index, row) => {
      setDuplicateError(null);
      if (isBuiltInStudioPortal(row) || isBuiltInComponentAlonePortal(row)) {
        setDuplicateSegmentInput('');
        setDuplicateNameInput('');
      } else {
        const defaults = suggestDuplicateDefaults(
          row,
          page.portals.map((application) => application.segment),
          t('portals.copySuffix'),
        );
        setDuplicateSegmentInput(defaults.segment);
        setDuplicateNameInput(defaults.name);
      }
      setDuplicateTarget(row);
    },
    onDelete: (_index, row) => {
      setDeleteError(null);
      setDeleteSegment(row.segment);
    },
  }, t), [page, resolveEditLayoutHref, resolveRowIndex, t]);

  const redirectTargetOptions = page.shellPortals.filter(
    (portal) => portal.enabled && portal.segment !== modal?.form.segment,
  );

  const isHomeForm = modal ? isBuiltInHomePortal(modal.form) : false;
  const isStudioForm = modal ? isBuiltInStudioPortal(modal.form) : false;
  const isComponentAloneForm = modal ? isBuiltInComponentAlonePortal(modal.form) : false;
  const isSystemProtected = Boolean(
    modal && modal.mode === 'edit' && isOperatorHiddenBuiltinPortal(modal.form),
  );
  const isRedirectActive = modal ? Boolean(modal.form.redirectToSegment?.trim()) : false;
  const formFieldsLocked = isSystemProtected || !modal?.form.enabled;
  const bodyFieldsLocked = formFieldsLocked || isRedirectActive;
  const cultureFieldLocked = formFieldsLocked || !isRedirectActive;
  const segmentFieldLocked = formFieldsLocked || isRedirectActive || isHomeForm;

  const redirectSelectValue = modal?.form.redirectToSegment?.trim() || 'none';

  const layoutPickerItems = useMemo(
    () => buildLayoutPickerItems(designerDrafts, modal?.form.shellKey),
    [designerDrafts, modal?.form.shellKey],
  );

  const notFoundPagePickerItems = useMemo(
    () => buildNotFoundPagePickerItems(designerDrafts),
    [designerDrafts],
  );

  const notFoundSelectValue = modal?.form.notFoundPageRef?.trim() || 'none';

  const updateRedirectTarget = (value: string) => {
    setModal((current) => {
      if (!current) return current;
      const isRedirect = value !== 'none' && value.trim() !== '';
      const currentLayoutKey = current.form.shellKey.trim();
      const nextShellKey = !isRedirect
        && isBuiltInHomePortal(current.form)
        && (!currentLayoutKey || currentLayoutKey === HOME_SHELL_KEY)
        ? SITE_SHELL_LAYOUT_KEY
        : current.form.shellKey;
      return {
        ...current,
        form: {
          ...current.form,
          entryMode: isRedirect ? 'redirect' : 'shell',
          redirectToSegment: isRedirect ? value : null,
          redirectToCulture: isRedirect
            ? (current.form.redirectToCulture?.trim() || cultureOptions[0] || 'us')
            : null,
          notFoundPageRef: isRedirect ? null : current.form.notFoundPageRef,
          brand: isRedirect ? null : current.form.brand,
          shellKey: nextShellKey,
        },
      };
    });
  };

  const submitDuplicateApplication = async () => {
    if (!duplicateTarget) return;

    const segmentError = validatePortalSegmentSlug(duplicateSegmentInput);
    if (segmentError) {
      setDuplicateError(segmentError);
      return;
    }

    const segment = duplicateSegmentInput.trim();
    const name = duplicateNameInput.trim();
    if (!name) {
      setDuplicateError(t('portals.displayNameRequired'));
      return;
    }

    if (page.portals.some((application) => application.segment === segment)) {
      setDuplicateError(t('portals.segmentAlreadyUsed').replace('{segment}', segment));
      return;
    }

    try {
      await page.duplicatePortal(
        duplicateTarget.segment,
        { segment, name },
        MODAL_MUTATION_OPTIONS,
      );
      setDuplicateTarget(null);
      setDuplicateSegmentInput('');
      setDuplicateNameInput('');
      setDuplicateError(null);
    } catch (caught) {
      setDuplicateError(formatPortalMutationError(caught, t('portals.duplicateFailed')));
    }
  };

  const submitApplication = async () => {
    if (!modal || isSystemProtected) return;

    const segment = modal.form.segment.trim();
    const name = modal.form.name.trim();

    if (!isBuiltInStudioPortal(modal.form) && !isBuiltInHomePortal(modal.form) && !isBuiltInComponentAlonePortal(modal.form)) {
      const segmentError = validatePortalSegmentSlug(segment);
      if (segmentError) {
        showPortalFormError(segmentError);
        return;
      }
    }
    if (!name) {
      showPortalFormError(t('portals.nameRequired'));
      return;
    }

    if (isRedirectActive) {
      if (!modal.form.redirectToSegment?.trim()) {
        showPortalFormError(t('portals.redirectTargetApplicationRequired'));
        return;
      }
      if (!modal.form.redirectToCulture?.trim()) {
        showPortalFormError(t('portals.redirectTargetCultureRequired'));
        return;
      }
    } else {
      const layoutKey = modal.form.shellKey.trim() || segment;
      if (!layoutKey) {
        showPortalFormError(t('portals.layoutRequired'));
        return;
      }
    }

    const duplicate = page.portals.find(
      (application, index) => application.segment === segment && application.segment !== modal.segment,
    );
    if (duplicate) {
      showPortalFormError(t('portals.segmentAlreadyUsed').replace('{segment}', segment));
      return;
    }

    const nextBrand = normalizePortalBrandForSave(modal.form.brand, isRedirectActive);

    let nextApplication: ExperienceManifestPortal = isRedirectActive
      ? {
        ...modal.form,
        segment: isBuiltInHomePortal(modal.form) ? modal.form.segment : segment,
        name,
        entryMode: 'redirect',
        redirectToSegment: modal.form.redirectToSegment?.trim() || null,
        redirectToCulture: modal.form.redirectToCulture?.trim() || null,
        notFoundPageRef: null,
        brand: null,
        shellKey: modal.form.shellKey,
        pages: [],
        auth: null,
        navigationRef: undefined,
        designPackId: undefined,
      }
      : {
        ...modal.form,
        segment: isBuiltInStudioPortal(modal.form)
          ? STUDIO_PORTAL_SEGMENT
          : isBuiltInComponentAlonePortal(modal.form)
            ? COMPONENT_ALONE_PORTAL_SEGMENT
            : segment,
        name,
        shellKey: isBuiltInStudioPortal(modal.form) || isBuiltInComponentAlonePortal(modal.form)
          ? modal.form.shellKey
          : (toLayoutPickerKey(modal.form.shellKey) || modal.form.shellKey.trim() || segment),
        entryMode: 'shell',
        redirectToSegment: null,
        redirectToCulture: null,
        notFoundPageRef: modal.form.notFoundPageRef?.trim() || null,
        brand: nextBrand,
      };

    try {
      if (modal.mode === 'create') {
        await page.savePortal('create', nextApplication, modal.segment, MODAL_MUTATION_OPTIONS);
      }

      if (pendingLogoFile && !isRedirectActive) {
        try {
          const logoUrl = await uploadPortalLogo(nextApplication.segment, pendingLogoFile);
          nextApplication = {
            ...nextApplication,
            brand: mergePortalBrand(nextApplication.brand, { logoUrl }),
          };
        } catch (caught) {
          setModal({
            mode: 'edit',
            segment: nextApplication.segment,
            form: nextApplication,
          });
          showPortalFormError(formatPortalMutationError(caught, t('portals.logoUploadFailed')));
          return;
        }
      }

      if (modal.mode !== 'create' || pendingLogoFile) {
        await page.savePortal(
          'update',
          nextApplication,
          nextApplication.segment,
          MODAL_MUTATION_OPTIONS,
        );
      }

      setModal(null);
      setPendingLogoFile(null);
    } catch (caught) {
      showPortalFormError(formatPortalMutationError(caught, t('portals.saveFailed')));
    }
  };

  return (
    <ListPageShell>
      <ListPageToolbarFrame>

        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <ToolbarSearchInput
            value={page.query}
            onChange={page.setQuery}
            placeholder={t('portals.searchPlaceholder')}
            ariaLabel={t('grid.search')}
          />
          <ToolbarBuiltInFilter
            value={page.builtInFilter}
            onChange={page.setBuiltInFilter}
          />
        </div>

        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <ToolbarActionGroupWithRefresh
            onRefresh={() => { void page.retryLoad(); }}
            isRefreshing={page.manifestQuery.isFetching && !page.manifestQuery.isLoading}
            actions={[
              {
                id: 'add-portal',
                label: t('portals.addPortal'),
                icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
                intent: 'create',
                primary: true,
                onClick: () => {
                  setPendingLogoFile(null);
                  setModal({ mode: 'create', form: page.createEmptyPortal() });
                },
              },
            ]}
          />
        </div>
      </ListPageToolbarFrame>

      <AppTableGrid
        presentation="auto"
        persistListKey={APP_LIST_PREFERENCE_KEYS.platformPortals}
        columns={columns}
        rows={page.displayPortals}
        getRowKey={(row) => row.segment}
        isLoading={page.manifestQuery.isLoading}
        loadingMessage={t('portals.loading')}
        errorContent={
          loadError ? (
            <QueryErrorPanel
              message={t('portals.loadFailed')}
              detail={formatQueryError(loadError, t('portals.loadFailedDetail'))}
              onRetry={() => { void page.retryLoad(); }}
            />
          ) : undefined
        }
        isEmpty={!page.manifestQuery.isLoading && page.displayPortals.length === 0}
        emptyMessage={page.query.trim() ? t('portals.noResults') : t('portals.empty')}
        compact={{ tablet: { cardsPerRow: 2 } }}
      />

      {modal ? (
        <CreateEditModalShell
          title={modal.mode === 'create' ? t('portals.addPortal') : t('portals.editPortal')}
          size="3xl"
          onClose={() => {
            setModal(null);
            setPendingLogoFile(null);
          }}
          closeOnEscape={false}
          footerClassName="!mt-0"
          footer={isSystemProtected ? undefined : (
            <AppButton
              intent="primary"
              size="sm"
              disabled={page.isSaving}
              onClick={() => { void submitApplication(); }}
            >
              {page.isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {page.isSaving ? t('actions.saving') : t('actions.save')}
            </AppButton>
          )}
        >
          <div className="flex flex-col gap-1">
            <fieldset
              disabled={isSystemProtected}
              className="m-0 min-w-0 border-0 p-0"
            >
              <div className="-mx-[15px] -mt-[15px] -mb-[15px] flex flex-col">
              {modal.mode === 'edit' ? (
                <section className="flex items-center justify-between gap-3 border-b border-[color:var(--app-accent-border)] bg-[color-mix(in_srgb,var(--app-accent-wash)_48%,white)] px-[15px] py-3">
                  <FeatureToggleField
                    id="portal-enabled"
                    className={isSystemProtected ? 'min-w-0 opacity-60' : 'min-w-0'}
                    checked={modal.form.enabled}
                    disabled={page.isSaving || isSystemProtected}
                    onChange={(checked) => setModal((current) => (
                      current ? { ...current, form: { ...current.form, enabled: checked } } : current
                    ))}
                    title={t(columnCommonKey('enabled'))}
                    titleClassName={FORM_THEME_INK_TITLE_CLASS.accent}
                  />
                  {isSystemProtected ? (
                    <p className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-amber-800">
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('portals.systemProtected')}
                    </p>
                  ) : null}
                </section>
              ) : null}

              <div className={`flex flex-col gap-1 px-[15px] py-4 ${formFieldsLocked ? 'opacity-60' : ''}`}>
                <FormSection title={t('portals.basicsSection')} ink="accent">
                  <div className={resolveFormFieldPairGridClass(true)}>
                    <FormField label={t('portals.urlSegment')} className={segmentFieldLocked ? 'opacity-60' : undefined}>
                      {isHomeForm ? (
                        <div className={APPLICATION_FORM_STATIC_CONTROL_CLASS}>
                          <code className="text-xs text-indigo-700">/</code>
                          <span className="ms-2 text-xs text-slate-500">{modal.form.name}</span>
                        </div>
                      ) : isStudioForm && modal.mode === 'edit' ? (
                        <div className={APPLICATION_FORM_STATIC_CONTROL_CLASS}>
                          <code className="text-xs text-indigo-700">/studio</code>
                          <span className="ms-2 text-xs text-slate-500">{t('portals.builtinStudio')}</span>
                        </div>
                      ) : isComponentAloneForm && modal.mode === 'edit' ? (
                        <div className={APPLICATION_FORM_STATIC_CONTROL_CLASS}>
                          <code className="text-xs text-indigo-700">/component-alone</code>
                          <span className="ms-2 text-xs text-slate-500">{t('portals.builtinComponentAlone')}</span>
                        </div>
                      ) : (
                        <UrlSegmentSlugInput
                          size="sm"
                          className={APPLICATION_FORM_CONTROL_CLASS}
                          value={modal.form.segment}
                          onChange={(nextSegment) => setModal((current) => (
                            current ? { ...current, form: { ...current.form, segment: nextSegment } } : current
                          ))}
                          ariaLabel={t('portals.applicationUrlSegmentAria')}
                          placeholder={t('portals.urlSegmentPlaceholder')}
                          disabled={segmentFieldLocked}
                          helperText=""
                        />
                      )}
                    </FormField>

                    <FormField label={t('portals.displayName')}>
                      <UiInput
                        size="sm"
                        className={APPLICATION_FORM_CONTROL_CLASS}
                        value={modal.form.name}
                        onChange={(event) => setModal((current) => (
                          current ? { ...current, form: { ...current.form, name: event.target.value } } : current
                        ))}
                        ariaLabel={t('portals.applicationNameAria')}
                        disabled={formFieldsLocked}
                        autoDir
                      />
                    </FormField>
                  </div>
                </FormSection>

                <PortalBrandFields
                  brand={modal.form.brand}
                  disabled={bodyFieldsLocked}
                  labels={{
                    section: t('portals.brandSection'),
                    helper: t('portals.brandHelper'),
                    logo: t('portals.logo'),
                    logoAria: t('portals.logoAria'),
                    logoEmpty: t('portals.logoEmpty'),
                    logoHint: t('portals.logoHint'),
                    title: t('portals.brandTitle'),
                    titleAria: t('portals.brandTitleAria'),
                    titlePlaceholder: t('portals.brandTitlePlaceholder'),
                    titleHint: t('portals.brandTitleHint'),
                    windowTitle: t('portals.brandWindowTitle'),
                    windowTitleAria: t('portals.brandWindowTitleAria'),
                    windowTitlePlaceholder: t('portals.brandWindowTitlePlaceholder'),
                    windowTitleHint: t('portals.brandWindowTitleHint'),
                    aboutTitle: t('portals.aboutTitle'),
                    aboutTitleAria: t('portals.aboutTitleAria'),
                    aboutTitlePlaceholder: t('portals.aboutTitlePlaceholder'),
                    aboutTitleHint: t('portals.aboutTitleHint'),
                    aboutBody: t('portals.aboutBody'),
                    aboutBodyAria: t('portals.aboutBodyAria'),
                    aboutBodyPlaceholder: t('portals.aboutBodyPlaceholder'),
                    aboutBodyHint: t('portals.aboutBodyHint'),
                  }}
                  onBrandChange={(brand) => setModal((current) => (
                    current ? { ...current, form: { ...current.form, brand } } : current
                  ))}
                  onLogoFile={setPendingLogoFile}
                />

                <FormSection
                  title={t('portals.redirectSection')}
                  hint={t('portals.redirectHelper')}
                  ink="contrast"
                  divided
                >
                  <div className={resolveFormFieldPairGridClass(true)}>
                    <FormField label={t('portals.redirectToApplication')}>
                      <UiSelect
                        size="sm"
                        className={APPLICATION_FORM_CONTROL_CLASS}
                        ariaLabel={t('portals.redirectTargetApplicationAria')}
                        value={redirectSelectValue}
                        disabled={formFieldsLocked}
                        onChange={(event) => updateRedirectTarget(event.target.value)}
                      >
                        <option value="none">{t('portals.redirectNoneOption')}</option>
                        {redirectTargetOptions.map((application) => (
                          <option key={application.segment} value={application.segment}>
                            {application.name} ({formatPortalUrlSegment(application.segment)})
                          </option>
                        ))}
                      </UiSelect>
                    </FormField>

                    <FormField
                      label={t('portals.redirectTargetCulture')}
                      className={cultureFieldLocked ? 'opacity-60' : undefined}
                    >
                      <UiSelect
                        size="sm"
                        className={APPLICATION_FORM_CONTROL_CLASS}
                        ariaLabel={t('portals.redirectTargetCultureAria')}
                        value={modal.form.redirectToCulture ?? ''}
                        disabled={cultureFieldLocked}
                        onChange={(event) => setModal((current) => (
                          current ? {
                            ...current,
                            form: { ...current.form, redirectToCulture: event.target.value },
                          } : current
                        ))}
                      >
                        <option value="">{t('portals.selectCulture')}</option>
                        {cultureOptions.map((cultureId) => (
                          <option key={cultureId} value={cultureId}>{cultureId}</option>
                        ))}
                      </UiSelect>
                    </FormField>
                  </div>
                </FormSection>

                <FormSection
                  title={t(columnCommonKey('layout'))}
                  hint={t('portals.layoutHelper')}
                  ink="accent"
                  divided
                  className={bodyFieldsLocked ? 'opacity-60' : undefined}
                >
                  <div className={resolveFormFieldPairGridClass(true)}>
                    <FormField label={t(columnCommonKey('layout'))}>
                      {isStudioForm && modal.mode === 'edit' ? (
                        <div className={APPLICATION_FORM_STATIC_CONTROL_CLASS}>
                          <code className="font-mono text-xs text-indigo-700">
                            {formatPortalLayoutDisplay(modal.form)}
                          </code>
                          <span className="ms-2 text-xs text-slate-500">{t('portals.builtinAdminLayout')}</span>
                        </div>
                      ) : isComponentAloneForm && modal.mode === 'edit' ? (
                        <div className={APPLICATION_FORM_STATIC_CONTROL_CLASS}>
                          <code className="font-mono text-xs text-indigo-700">
                            {formatPortalLayoutDisplay(modal.form)}
                          </code>
                          <span className="ms-2 text-xs text-slate-500">{t('portals.builtinComponentAloneLayout')}</span>
                        </div>
                      ) : (
                        <div className="min-w-0 w-full">
                          <UiSelect
                            size="sm"
                            className={APPLICATION_FORM_CONTROL_CLASS}
                            ariaLabel={t('portals.layoutAria')}
                            value={toLayoutPickerKey(modal.form.shellKey)}
                            disabled={bodyFieldsLocked}
                            onChange={(event) => setModal((current) => (
                              current ? { ...current, form: { ...current.form, shellKey: event.target.value } } : current
                            ))}
                          >
                            <option value="">{t('portals.selectLayout')}</option>
                            {layoutPickerItems.map((item) => (
                              <option key={item.id} value={item.layoutKey}>
                                {item.componentPath}
                              </option>
                            ))}
                          </UiSelect>
                          <p className="mt-[2px] ps-[4px] font-mono text-[10px] text-slate-400">
                            {formatPortalLayoutComponentPath(resolvePortalLayoutDesignerKey(modal.form))}
                          </p>
                        </div>
                      )}
                    </FormField>

                    <FormField label={t('portals.notFoundPage')} hint={t('portals.notFoundPageHelper')}>
                      <UiSelect
                        size="sm"
                        className={APPLICATION_FORM_CONTROL_CLASS}
                        ariaLabel={t('portals.notFoundPageAria')}
                        value={notFoundSelectValue}
                        disabled={bodyFieldsLocked}
                        onChange={(event) => setModal((current) => {
                          if (!current) return current;
                          const next = event.target.value;
                          return {
                            ...current,
                            form: {
                              ...current.form,
                              notFoundPageRef: next === 'none' ? null : next,
                            },
                          };
                        })}
                      >
                        <option value="none">{t('portals.notFoundPageNone')}</option>
                        {notFoundSelectValue !== 'none'
                          && !notFoundPagePickerItems.some((item) => item.componentPath === notFoundSelectValue)
                          ? (
                            <option value={notFoundSelectValue}>{notFoundSelectValue}</option>
                          )
                          : null}
                        {notFoundPagePickerItems.map((item) => (
                          <option key={item.id} value={item.componentPath}>
                            {item.label}
                          </option>
                        ))}
                      </UiSelect>
                    </FormField>
                  </div>
                </FormSection>
              </div>
            </div>
            </fieldset>
          </div>
        </CreateEditModalShell>
      ) : null}

      {navigationsTarget ? (
        <PortalNavigationsModal
          portal={navigationsTarget}
          onClose={() => {
            setNavigationsTarget(null);
            void page.retryLoad();
          }}
          onPortalUpdated={() => { void page.retryLoad(); }}
        />
      ) : null}

      {accessTarget && !portalUsesRedirectEntry(accessTarget) ? (
        <PortalAccessModal
          open
          portal={accessTarget}
          isSaving={page.isSaving}
          onClose={() => setAccessTarget(null)}
          onSave={async (auth) => {
            await page.savePortal('update', {
              ...accessTarget,
              auth,
            }, accessTarget.segment, MODAL_MUTATION_OPTIONS);
            setAccessTarget(null);
          }}
        />
      ) : null}

      {duplicateTarget ? (
        <CreateEditModalShell
          title={t('actions.duplicateApplication')}
          size="sm"
          onClose={() => setDuplicateTarget(null)}
          onBackdropClick={() => setDuplicateTarget(null)}
          footer={(
            <>
              <AppButton intent="cancel" size="sm" onClick={() => setDuplicateTarget(null)}>
                <X className="h-3.5 w-3.5" />
                {t('actions.cancel')}
              </AppButton>
              <AppButton
                intent="primary"
                size="sm"
                disabled={page.isSaving}
                onClick={() => { void submitDuplicateApplication(); }}
              >
                {page.isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                {page.isSaving ? t('portals.duplicating') : t('portals.duplicateAction')}
              </AppButton>
            </>
          )}
        >
          <div className={CREATE_EDIT_MODAL_BODY_INNER_CLASS}>
            {duplicateError ? (
              <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {duplicateError}
              </div>
            ) : null}
            <FormSection title={t('portals.basicsSection')} ink="accent">
            <div className={resolveFormFieldPairGridClass(true)}>
              <FormField label={t('portals.urlSegment')}>
                <UrlSegmentSlugInput
                  size="sm"
                  value={duplicateSegmentInput}
                  onChange={(nextSegment) => {
                    setDuplicateError(null);
                    setDuplicateSegmentInput(nextSegment);
                  }}
                  ariaLabel={t('portals.duplicateUrlSegmentAria')}
                  placeholder={t('portals.duplicateUrlSegmentPlaceholder')}
                />
              </FormField>
              <FormField label={t('portals.displayName')}>
                <UiInput
                  size="sm"
                  className={APPLICATION_FORM_CONTROL_CLASS}
                  value={duplicateNameInput}
                  onChange={(event) => {
                    setDuplicateError(null);
                    setDuplicateNameInput(event.target.value);
                  }}
                  ariaLabel={t('portals.duplicateDisplayNameAria')}
                  placeholder={t('portals.duplicateDisplayNamePlaceholder')}
                  autoDir
                />
              </FormField>
            </div>
            </FormSection>
          </div>
        </CreateEditModalShell>
      ) : null}

      {deleteSegment ? (
        <PortalDeleteConfirmModal
          segment={deleteSegment}
          deleteError={deleteError}
          isDeleting={page.isSaving}
          onClose={() => {
            setDeleteSegment(null);
            setDeleteError(null);
          }}
          onConfirm={() => {
            void page.removePortal(deleteSegment, MODAL_MUTATION_OPTIONS)
              .then(() => {
                setDeleteSegment(null);
                setDeleteError(null);
              })
              .catch((caught) => {
                setDeleteError(formatPortalMutationError(caught, t('portals.deleteFailed')));
              });
          }}
        />
      ) : null}
    </ListPageShell>
  );
};

