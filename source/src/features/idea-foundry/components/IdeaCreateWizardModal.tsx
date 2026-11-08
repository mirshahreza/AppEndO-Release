import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Layers, Lightbulb, Package, Sparkles, Users } from 'lucide-react';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import type {
  CreateProductIdeaInput,
  IdeaPackageHome,
  IdeaTeamModel,
  IdeaTeamPerson,
  ProductIdeaRecord,
} from '../../../shared/api/contracts/idea-foundry/types';
import {
  DEFAULT_IDEA_ICON,
  DEFAULT_IDEA_IMPORTANCE,
  DEFAULT_IDEA_MATURITY,
  DEFAULT_IDEA_SCALE,
  DEFAULT_IDEA_TARGET_KIND,
  IDEA_WHOLE_PACKAGE_SECTION_KEY,
  type IdeaImportance,
  type IdeaScale,
  type IdeaTargetKind,
} from '../../../shared/api/contracts/idea-foundry/types';
import { markdownToolbarProps } from '../../../shared/lib/markdownEditorToolbar';
import {
  AiAssistFormField,
  AiFieldAssistSectionProvider,
  DesignerMarkdownEditorField,
  DialogBand,
  FORM_FIELD_ERROR_CLASS,
  FormSection,
  StepWizardShell,
  UiInput,
  UiOptionCardGroup,
  type StepWizardStepDef,
  type UiOptionCardOption,
} from '../../../shared/ui';
import {
  IDEA_IMPORTANCE_OPTIONS,
  IDEA_SCALE_OPTIONS,
  IDEA_TARGET_KIND_OPTIONS,
  withLeadModel,
  type IdeaOptionCard,
} from '../ideaFoundryCatalog';
import { IdeaIconPickerField } from './IdeaIconPickerField';
import { IdeaTeamStep } from './IdeaTeamStep';

export type IdeaCreateForm = Omit<CreateProductIdeaInput, 'decisionMaker'> & {
  decisionMaker: IdeaTeamPerson | null;
};

const EMPTY_FORM: IdeaCreateForm = {
  title: '',
  description: '',
  icon: null,
  importance: DEFAULT_IDEA_IMPORTANCE,
  scale: DEFAULT_IDEA_SCALE,
  maturity: DEFAULT_IDEA_MATURITY,
  targetKind: DEFAULT_IDEA_TARGET_KIND,
  packageId: null,
  packageTitle: null,
  sectionKey: null,
  sectionTitle: null,
  frontOffice: '',
  backOffice: '',
  note: '',
  decisionMaker: null,
  collaborators: [],
  models: [],
};

export const formFromIdea = (idea: ProductIdeaRecord): IdeaCreateForm => ({
  title: idea.title,
  description: idea.description,
  icon: idea.icon,
  importance: idea.importance,
  scale: idea.scale,
  maturity: idea.maturity,
  targetKind: idea.targetKind,
  packageId: idea.packageId,
  packageTitle: idea.packageTitle,
  sectionKey: idea.sectionKey,
  sectionTitle: idea.sectionTitle,
  frontOffice: idea.frontOffice,
  backOffice: idea.backOffice,
  note: idea.note ?? '',
  decisionMaker: idea.decisionMaker,
  collaborators: [...idea.collaborators],
  models: [...idea.models],
});

const pickDefaultTeamModels = (models: readonly IdeaTeamModel[]): IdeaTeamModel[] => {
  const preferred = models.find((model) => model.isDefault) ?? models[0];
  return preferred ? [preferred] : [];
};

const emptyCreateForm = (
  actor: IdeaTeamPerson | null,
  availableModels: readonly IdeaTeamModel[],
): IdeaCreateForm => ({
  ...EMPTY_FORM,
  decisionMaker: actor,
  models: pickDefaultTeamModels(availableModels),
});

const toOptionCards = (
  options: readonly IdeaOptionCard[],
): UiOptionCardOption[] => options.map((option) => ({
  value: option.value,
  title: option.title,
  description: option.description,
  icon: option.icon,
  tone: option.tone,
}));

export type IdeaWizardMode = 'create' | 'reconfigure';

type IdeaCreateWizardModalProps = {
  open: boolean;
  isSaving: boolean;
  error: string | null;
  homes: readonly IdeaPackageHome[];
  homesLoading?: boolean;
  actor: IdeaTeamPerson | null;
  availableModels: readonly IdeaTeamModel[];
  modelsLoading?: boolean;
  mode?: IdeaWizardMode;
  initialIdea?: ProductIdeaRecord | null;
  onClose: () => void;
  onClearError?: () => void;
  onCreate: (input: CreateProductIdeaInput) => void;
};

export const IdeaCreateWizardModal: React.FC<IdeaCreateWizardModalProps> = ({
  open,
  isSaving,
  error,
  homes,
  homesLoading = false,
  actor,
  availableModels,
  modelsLoading = false,
  mode = 'create',
  initialIdea = null,
  onClose,
  onClearError,
  onCreate,
}) => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<IdeaCreateForm>(EMPTY_FORM);
  const [homeTouched, setHomeTouched] = useState(false);
  const [teamTouched, setTeamTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      setStep(0);
      setForm(
        mode === 'reconfigure' && initialIdea
          ? formFromIdea(initialIdea)
          : emptyCreateForm(actor, availableModels),
      );
      setHomeTouched(false);
      setTeamTouched(false);
      setFormError(null);
      return;
    }
    if (mode === 'reconfigure') return;
    setForm((prev) => {
      let next = prev;
      if (actor) {
        if (!next.decisionMaker) {
          next = { ...next, decisionMaker: actor };
        } else if (next.decisionMaker.userId === actor.userId) {
          next = { ...next, decisionMaker: actor };
        }
      }
      if (next.models.length === 0) {
        const defaults = pickDefaultTeamModels(availableModels);
        if (defaults.length > 0) {
          next = { ...next, models: defaults };
        }
      }
      return next;
    });
  }, [actor, availableModels, initialIdea, mode, open]);

  const sparkNeighborFields = useMemo(() => [
    { label: 'Title', value: form.title },
    { label: 'Description', value: form.description },
  ], [form.description, form.title]);

  const surfaceNeighborFields = useMemo(() => [
    { label: 'Title', value: form.title },
    { label: 'Description', value: form.description },
    { label: 'Front office', value: form.frontOffice },
    { label: 'Back office', value: form.backOffice },
  ], [form.backOffice, form.description, form.frontOffice, form.title]);

  const wizardSteps = useMemo<readonly StepWizardStepDef[]>(() => [
    {
      title: 'Spark',
      icon: Lightbulb,
      description: 'Give it a title, then write the pitch in Markdown.',
      tone: 'indigo',
    },
    {
      title: 'Domain',
      icon: Package,
      description: 'A brand-new package, or one already in the catalog. Core Studio is out of scope.',
      tone: 'violet',
    },
    {
      title: 'Surfaces',
      icon: Layers,
      description: 'Where this idea shows up in front office and back office, and which operations it handles.',
      tone: 'emerald',
    },
    {
      title: 'Weight',
      icon: Sparkles,
      description: 'How hard this idea should pull attention, and how big the slice is.',
      tone: 'amber',
    },
    {
      title: 'Team',
      icon: Users,
      description: 'Who decides, who collaborates, and which models join.',
      tone: 'rose',
    },
  ], []);

  const selectedHome = useMemo(
    () => homes.find((home) => home.packageId === form.packageId) ?? null,
    [form.packageId, homes],
  );

  const titleValid = form.title.trim().length > 0;
  const descriptionValid = form.description.trim().length > 0;
  const frontOfficeValid = form.frontOffice.trim().length > 0;
  const backOfficeValid = form.backOffice.trim().length > 0;
  const isExistingHome = form.targetKind === 'existing-package';
  const packageValid = !isExistingHome || Boolean(form.packageId?.trim());
  const homeValid = packageValid;
  const surfacesValid = frontOfficeValid && backOfficeValid;
  const peopleValid = Boolean(form.decisionMaker);
  const modelsValid = form.models.length > 0;
  const teamValid = peopleValid && modelsValid;
  const peopleError = teamTouched && !peopleValid ? 'Choose who makes the final decision.' : null;
  const modelsError = teamTouched && !modelsValid ? 'Choose at least one model.' : null;
  const packageError = homeTouched && isExistingHome && !packageValid
    ? (homes.length === 0 ? 'No packages in the catalog yet.' : 'Choose a package.')
    : null;

  const applyTargetKind = (value: string) => {
    const nextKind = value as IdeaTargetKind;
    setForm((prev) => ({
      ...prev,
      targetKind: nextKind,
      packageId: nextKind === 'existing-package' ? prev.packageId : null,
      packageTitle: nextKind === 'existing-package' ? prev.packageTitle : null,
      sectionKey: nextKind === 'existing-package' ? prev.sectionKey : null,
      sectionTitle: nextKind === 'existing-package' ? prev.sectionTitle : null,
    }));
  };

  const applyPackageId = (packageId: string) => {
    const home = homes.find((item) => item.packageId === packageId) ?? null;
    const whole = home?.sections.find((section) => section.key === IDEA_WHOLE_PACKAGE_SECTION_KEY)
      ?? { key: IDEA_WHOLE_PACKAGE_SECTION_KEY, title: 'Whole package' };
    setForm((prev) => ({
      ...prev,
      packageId: home?.packageId ?? null,
      packageTitle: home?.displayName ?? null,
      sectionKey: home ? whole.key : null,
      sectionTitle: home ? whole.title : null,
    }));
  };

  const handleNext = (): boolean => {
    if (step === 0) {
      if (!titleValid || !descriptionValid) {
        setFormError(null);
        return false;
      }
    }
    if (step === 1) {
      setHomeTouched(true);
      if (!homeValid) {
        setFormError(null);
        return false;
      }
    }
    if (step === 2) {
      if (!surfacesValid) {
        setFormError(null);
        return false;
      }
    }
    setFormError(null);
    onClearError?.();
    return true;
  };

  const handleSubmit = () => {
    setHomeTouched(true);
    if (!titleValid || !descriptionValid) {
      setStep(0);
      return;
    }
    if (!homeValid) {
      setStep(1);
      return;
    }
    if (!surfacesValid) {
      setStep(2);
      return;
    }
    setTeamTouched(true);
    if (!form.decisionMaker || !teamValid) {
      setStep(4);
      return;
    }
    const existing = form.targetKind === 'existing-package';
    onCreate({
      title: form.title.trim(),
      description: form.description.trim(),
      icon: existing ? (selectedHome?.icon ?? DEFAULT_IDEA_ICON) : (form.icon?.trim() || DEFAULT_IDEA_ICON),
      importance: form.importance,
      scale: form.scale,
      maturity: mode === 'reconfigure' ? form.maturity : DEFAULT_IDEA_MATURITY,
      targetKind: form.targetKind,
      packageId: existing ? form.packageId : null,
      packageTitle: existing ? (selectedHome?.displayName ?? form.packageTitle) : null,
      sectionKey: existing ? (form.sectionKey ?? IDEA_WHOLE_PACKAGE_SECTION_KEY) : null,
      sectionTitle: existing ? (form.sectionTitle ?? 'Whole package') : null,
      frontOffice: form.frontOffice.trim(),
      backOffice: form.backOffice.trim(),
      note: null,
      decisionMaker: form.decisionMaker,
      collaborators: form.collaborators.filter((person) => person.userId !== form.decisionMaker?.userId),
      models: form.models,
    });
  };

  if (!open) return null;

  const displayError = formError ?? error;
  const fillBodyStep = step === 0 || step === 2 || step === 4;
  const isReconfigure = mode === 'reconfigure';
  const wizardTitle = isReconfigure ? 'Reconfigure idea' : 'Register idea';
  const submitLabel = isSaving ? 'Saving…' : wizardTitle;

  return (
    <StepWizardShell
      size="maximized"
      title={wizardTitle}
      titleIcon={Lightbulb}
      steps={wizardSteps}
      step={step}
      onStepChange={(nextStep) => {
        setFormError(null);
        onClearError?.();
        setStep(nextStep);
      }}
      onClose={onClose}
      onNext={handleNext}
      finalStepAction={{
        label: submitLabel,
        icon: <Check className="h-3.5 w-3.5" />,
        disabled: isSaving,
        onClick: handleSubmit,
      }}
      bodyInnerClassName={fillBodyStep ? '!overflow-hidden' : '!overflow-auto'}
    >
      <div className={fillBodyStep ? 'flex h-full min-h-0 flex-1 flex-col' : 'flex flex-col gap-1'}>
        {step !== 0 && displayError ? (
          <div className="mb-3 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {displayError}
          </div>
        ) : null}

        {step === 0 ? (
          <AiFieldAssistSectionProvider
            sectionTitle="Spark"
            sectionDescription="Give it a title, then write the pitch in Markdown."
            neighborFields={sparkNeighborFields}
          >
            <DialogBand tone="muted" className="-mt-[15px]">
              <AiAssistFormField
                label="Title"
                required
                layout="side"
                invalid={!titleValid}
                hint="The name that appears on the heatmap tile."
                className="min-w-0 w-full flex-1"
                fieldKind="singleLine"
                getValue={() => form.title}
                onApplyValue={(next) => setForm((prev) => ({ ...prev, title: next }))}
              >
                <UiInput
                  size="sm"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Night-shift dispatch board"
                  ariaLabel="Idea title"
                  autoDir
                  aiAutocomplete
                  fieldLabel="Title"
                />
              </AiAssistFormField>
            </DialogBand>
            {displayError ? (
              <div className="mt-3 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {displayError}
              </div>
            ) : null}
            <AiAssistFormField
              label="Description"
              required
              invalid={!descriptionValid}
              hint="The problem, who it is for, and why now. Markdown fills the rest of this step."
              className="mt-3 flex min-h-0 flex-1 flex-col"
              fieldKind="multiline"
              getValue={() => form.description}
              onApplyValue={(next) => setForm((prev) => ({ ...prev, description: next }))}
            >
              <DesignerMarkdownEditorField
                editorHeight="100%"
                value={form.description}
                onChange={(next) => setForm((prev) => ({ ...prev, description: next }))}
                placeholder="Warehouse clerks lose half an hour each night reconciling pick lists by hand."
                ariaLabel="Idea description"
                isRequired
                className="min-h-0 flex-1"
                fieldLabel="Description"
                {...markdownToolbarProps('standard')}
              />
            </AiAssistFormField>
          </AiFieldAssistSectionProvider>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-1">
            <UiOptionCardGroup
              value={form.targetKind}
              onChange={applyTargetKind}
              options={toOptionCards(IDEA_TARGET_KIND_OPTIONS.filter((option) => option.value === 'new-package'))}
              ariaLabel="New package"
              columns={1}
              className="w-full"
            />
            {!isExistingHome ? (
              <div className="mt-3">
                <IdeaIconPickerField
                  value={form.icon ?? null}
                  onChange={(icon) => setForm((prev) => ({ ...prev, icon }))}
                />
              </div>
            ) : null}
            <div role="separator" className="my-2 border-t border-border-subtle" />
            <UiOptionCardGroup
              value={form.targetKind}
              onChange={applyTargetKind}
              options={toOptionCards(IDEA_TARGET_KIND_OPTIONS.filter((option) => option.value === 'existing-package'))}
              ariaLabel="Existing package choice"
              columns={1}
              className="w-full"
            />
            <FormSection
              title={isExistingHome ? 'Existing Packages' : 'Package'}
              ink="complement"
              divided
              hint="Installed packages in the catalog. Core Studio is not listed."
            >
              <UiOptionCardGroup
                value={form.packageId ?? ''}
                onChange={applyPackageId}
                options={homes.map((home) => ({
                  value: home.packageId,
                  title: home.displayName,
                  icon: home.icon
                    ? ({ className }: { className?: string }) => (
                      <NavigationIcon iconRef={home.icon ?? ''} className={className} />
                    )
                    : Package,
                }))}
                ariaLabel="Existing packages"
                density="compact"
                columns="auto"
                disabled={!isExistingHome || homesLoading}
              />
              {packageError ? (
                <p className={FORM_FIELD_ERROR_CLASS}>{packageError}</p>
              ) : null}
            </FormSection>
          </div>
        ) : null}

        {step === 2 ? (
          <AiFieldAssistSectionProvider
            sectionTitle="Surfaces"
            sectionDescription="Where this idea shows up in front office and back office, and which operations it handles."
            neighborFields={surfaceNeighborFields}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
              <AiAssistFormField
                label="Front office"
                required
                invalid={!frontOfficeValid}
                hint="Public and customer surfaces: pages, self-service, and the operations people do there."
                className="flex min-h-0 flex-1 flex-col"
                fieldKind="multiline"
                getValue={() => form.frontOffice}
                onApplyValue={(next) => setForm((prev) => ({ ...prev, frontOffice: next }))}
              >
                <DesignerMarkdownEditorField
                  editorHeight="100%"
                  value={form.frontOffice}
                  onChange={(next) => setForm((prev) => ({ ...prev, frontOffice: next }))}
                  placeholder={'Catalog search, product page, and checkout.\n- Guest finds a SKU by barcode\n- Pays and gets an order number'}
                  ariaLabel="Front office"
                  isRequired
                  className="min-h-0 flex-1"
                  fieldLabel="Front office"
                  {...markdownToolbarProps('standard')}
                />
              </AiAssistFormField>
              <AiAssistFormField
                label="Back office"
                required
                invalid={!backOfficeValid}
                hint="Operator and staff surfaces: lists, queues, and the operations the workshop handles."
                className="flex min-h-0 flex-1 flex-col"
                fieldKind="multiline"
                getValue={() => form.backOffice}
                onApplyValue={(next) => setForm((prev) => ({ ...prev, backOffice: next }))}
              >
                <DesignerMarkdownEditorField
                  editorHeight="100%"
                  value={form.backOffice}
                  onChange={(next) => setForm((prev) => ({ ...prev, backOffice: next }))}
                  placeholder={'Pick-list desk and exception queue.\n- Clerk confirms the pick\n- Supervisor clears a short-pick'}
                  ariaLabel="Back office"
                  isRequired
                  className="min-h-0 flex-1"
                  fieldLabel="Back office"
                  {...markdownToolbarProps('standard')}
                />
              </AiAssistFormField>
            </div>
          </AiFieldAssistSectionProvider>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-1">
            <FormSection
              title="Importance"
              ink="accent"
              hint="How hard this idea should pull attention on the board."
            >
              <UiOptionCardGroup
                value={form.importance}
                onChange={(value) => setForm((prev) => ({ ...prev, importance: value as IdeaImportance }))}
                options={toOptionCards(IDEA_IMPORTANCE_OPTIONS)}
                ariaLabel="Importance"
                columns={2}
              />
            </FormSection>
            <FormSection
              title="Scale"
              ink="complement"
              divided
              hint="How big the slice is — not how loud the tile should be."
            >
              <UiOptionCardGroup
                value={form.scale}
                onChange={(value) => setForm((prev) => ({ ...prev, scale: value as IdeaScale }))}
                options={toOptionCards(IDEA_SCALE_OPTIONS)}
                ariaLabel="Scale"
                columns={2}
              />
            </FormSection>
          </div>
        ) : null}

        {step === 4 ? (
          <IdeaTeamStep
            decisionMaker={form.decisionMaker}
            collaborators={form.collaborators}
            models={form.models}
            availableModels={availableModels}
            modelsLoading={modelsLoading}
            peopleError={peopleError}
            modelsError={modelsError}
            onChangeDecisionMaker={(person) => {
              setForm((prev) => {
                const previous = prev.decisionMaker;
                const collaborators = prev.collaborators.filter((item) => item.userId !== person.userId);
                if (previous && previous.userId !== person.userId) {
                  collaborators.unshift(previous);
                }
                return { ...prev, decisionMaker: person, collaborators };
              });
            }}
            onAddCollaborators={(people) => {
              setForm((prev) => {
                const seen = new Set([
                  prev.decisionMaker?.userId,
                  ...prev.collaborators.map((item) => item.userId),
                ]);
                const next = [...prev.collaborators];
                for (const person of people) {
                  if (seen.has(person.userId)) continue;
                  seen.add(person.userId);
                  next.push(person);
                }
                return { ...prev, collaborators: next };
              });
            }}
            onRemoveCollaborator={(userId) => {
              setForm((prev) => ({
                ...prev,
                collaborators: prev.collaborators.filter((person) => person.userId !== userId),
              }));
            }}
            onMakeDecisionMaker={(person) => {
              setForm((prev) => {
                const previous = prev.decisionMaker;
                return {
                  ...prev,
                  decisionMaker: person,
                  collaborators: [
                    ...(previous && previous.userId !== person.userId ? [previous] : []),
                    ...prev.collaborators.filter((item) => item.userId !== person.userId),
                  ],
                };
              });
            }}
            onAddModels={(picked) => {
              setForm((prev) => {
                const seen = new Set(prev.models.map((item) => item.id));
                const extra = picked.filter((model) => !seen.has(model.id));
                if (extra.length === 0) return prev;
                return { ...prev, models: [...prev.models, ...extra] };
              });
            }}
            onRemoveModel={(modelId) => {
              setForm((prev) => {
                if (prev.models.length <= 1) return prev;
                if (prev.models[0]?.id === modelId) return prev;
                return { ...prev, models: prev.models.filter((model) => model.id !== modelId) };
              });
            }}
            onMakeLeadModel={(model) => {
              setForm((prev) => ({ ...prev, models: withLeadModel(prev.models, model) }));
            }}
          />
        ) : null}
      </div>
    </StepWizardShell>
  );
};
