import * as React from 'react';
import { LayoutTemplate, Plus, Tag } from 'lucide-react';
import { StepWizardShell, type StepWizardStepDef } from '../../../../shared/ui/StepWizardShell';
import {
  FormField,
  FormSection,
  UiInput,
  UiSelect,
} from '../../../../shared/ui';
import type { AutoFormBuildConfig } from '../../../../domain/component-designer/autoFormTemplateBuilder';
import type { AutoTableBuildConfig } from '../../../../domain/component-designer/autoTableTemplateBuilder';
import type { NewLayoutPresetId } from '../../../../domain/component-designer/layout-presets/types';
import type { NewLayoutPresetCategory } from '../../../../domain/component-designer/layout-presets/newLayoutPresets';
import {
  CATALOG_OPERATOR_KIND_OPTIONS,
  parseCatalogKind,
  type CatalogKind,
} from '../../../../domain/component-designer/layout-presets/catalogSystemTags';
import { sanitizeDesignerComponentNameInput } from '../../utils/componentName';
import { CreateTemplatesStep } from './CreateTemplatesStep';
import {
  type CatalogCreateKind,
  type CreateComponentIdentity,
  defaultCatalogKindForCreate,
} from './catalogCreateKinds';
import {
  CreateCrudSetWizardSteps,
  CRUD_SET_WIZARD_CONTENT_STEPS,
  type CreateCrudSetWizardHandle,
} from './CreateCrudSetWizardSteps';
import type { CrudSetSpec } from '../../../../domain/component-designer/crudSetSpec';

export type CreateComponentKind = 'form' | 'grid' | CatalogCreateKind;

export type { CreateComponentIdentity };

export type CreateComponentWizardResult =
  | { kind: 'form'; config: AutoFormBuildConfig; identity: CreateComponentIdentity }
  | { kind: 'grid'; config: AutoTableBuildConfig; identity: CreateComponentIdentity }
  | { kind: 'crud-set'; spec: CrudSetSpec; identity: CreateComponentIdentity }
  | { kind: 'templates'; presetId: NewLayoutPresetId; identity: CreateComponentIdentity }
  | { kind: 'empty'; identity: CreateComponentIdentity };

export type CreateComponentWizardDialogProps = {
  open: boolean;
  initialKind: CatalogCreateKind;
  onClose: () => void;
  onComplete: (result: CreateComponentWizardResult) => void;
};

const TEMPLATES_STEP: StepWizardStepDef = {
  title: 'Templates',
  icon: LayoutTemplate,
  description: 'Pick a starter layout from the gallery.',
};

const NAME_STEP: StepWizardStepDef = {
  title: 'Name',
  icon: Tag,
  description: 'Name the component and choose Custom, Shell, or Template.',
};

const WIZARD_COPY: Record<CatalogCreateKind, { title: string; subtitle: string }> = {
  'crud-set': {
    title: 'Create CRUD Set',
    subtitle: 'Collect CrudSet options, then name it. The wizard only sets CrudSet props.',
  },
  templates: {
    title: 'Create component',
    subtitle: 'Pick a starter layout, then name it.',
  },
  empty: {
    title: 'Create component',
    subtitle: 'Name the blank canvas.',
  },
};

const buildSteps = (kind: CatalogCreateKind): readonly StepWizardStepDef[] => {
  if (kind === 'templates') {
    return [TEMPLATES_STEP, NAME_STEP];
  }
  if (kind === 'crud-set') {
    return [...CRUD_SET_WIZARD_CONTENT_STEPS, NAME_STEP];
  }
  return [NAME_STEP];
};

export const CreateComponentWizardDialog: React.FC<CreateComponentWizardDialogProps> = ({
  open,
  initialKind,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = React.useState(0);
  const [kind, setKind] = React.useState<CatalogCreateKind>(initialKind);
  const [componentName, setComponentName] = React.useState('');
  const [catalogKind, setCatalogKind] = React.useState<CatalogKind>(defaultCatalogKindForCreate());
  const [selectedCategory, setSelectedCategory] = React.useState<NewLayoutPresetCategory>('all');
  const [selectedPresetId, setSelectedPresetId] = React.useState<NewLayoutPresetId | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const crudSetRef = React.useRef<CreateCrudSetWizardHandle>(null);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    setStep(0);
    setKind(initialKind);
    setComponentName('');
    setCatalogKind(defaultCatalogKindForCreate());
    setSelectedCategory('all');
    setSelectedPresetId(null);
    setValidationError(null);
  }, [initialKind, open]);

  const steps = React.useMemo(() => buildSteps(kind), [kind]);
  const lastStepIndex = steps.length - 1;
  const isNameStep = step === lastStepIndex;
  const showTemplates = kind === 'templates' && !isNameStep;
  const nameInvalid = isNameStep && componentName.trim() === '';
  const copy = WIZARD_COPY[kind];

  const validateCurrentStep = (): boolean => {
    if (kind === 'crud-set' && !isNameStep) {
      const result = crudSetRef.current?.handleNext(step, lastStepIndex);
      if (result === false) {
        return false;
      }
      if (result && typeof result === 'object' && typeof result.jumpTo === 'number') {
        if (!componentName.trim() && crudSetRef.current?.suggestedName) {
          setComponentName(sanitizeDesignerComponentNameInput(crudSetRef.current.suggestedName));
        }
        setStep(result.jumpTo);
        return false;
      }
      return true;
    }
    if (kind === 'templates' && !isNameStep) {
      if (!selectedPresetId) {
        setValidationError('Pick a template before continuing.');
        return false;
      }
      setValidationError(null);
      return true;
    }

    setValidationError(null);
    return true;
  };

  const collectIdentity = (): CreateComponentIdentity | null => {
    const name = componentName.trim();
    if (!name) {
      setValidationError('Component name is required.');
      return null;
    }
    return {
      name,
      catalogKind,
    };
  };

  const handleCreate = () => {
    const identity = collectIdentity();
    if (!identity) {
      return;
    }

    if (kind === 'templates') {
      if (!selectedPresetId) {
        setValidationError('Pick a template before creating.');
        setStep(0);
        return;
      }
      onComplete({ kind: 'templates', presetId: selectedPresetId, identity });
      return;
    }
    if (kind === 'crud-set') {
      const spec = crudSetRef.current?.getSpec(identity);
      if (!spec) {
        return;
      }
      onComplete({ kind: 'crud-set', spec, identity });
      return;
    }

    onComplete({ kind: 'empty', identity });
  };

  const canFinish = !nameInvalid && (kind !== 'templates' || Boolean(selectedPresetId));

  if (!open) {
    return null;
  }

  return (
    <StepWizardShell
      size="maximized"
      title={copy.title}
      titleIcon={Plus}
      subtitle={copy.subtitle}
      steps={steps}
      step={step}
      onStepChange={(next) => {
        setValidationError(null);
        setStep(next);
      }}
      onClose={onClose}
      onBackdropClick={onClose}
      onNext={() => validateCurrentStep()}
      canMoveNext={step < lastStepIndex}
      canActivateStep={(index) => index <= step}
      bodyInnerClassName={showTemplates ? '!overflow-hidden flex flex-col min-h-0' : undefined}
      finalStepAction={{
        label: 'Create',
        icon: <Plus className="h-3.5 w-3.5" strokeWidth={2} />,
        onClick: handleCreate,
        disabled: !canFinish,
      }}
    >
      {validationError ? (
        <div className="mb-3 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {validationError}
        </div>
      ) : null}

      {showTemplates ? (
        <CreateTemplatesStep
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          selectedPresetId={selectedPresetId}
          onSelectPreset={(presetId) => {
            setSelectedPresetId(presetId);
            setValidationError(null);
          }}
        />
      ) : null}

      {kind === 'crud-set' ? (
        <div className={isNameStep ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
          <CreateCrudSetWizardSteps ref={crudSetRef} open={open} visibleStep={step} />
        </div>
      ) : null}

      {isNameStep ? (
        <FormSection title="Identity" ink="accent">
          <FormField label="Component Name" required error={nameInvalid ? 'Component name is required.' : undefined}>
            <UiInput
              size="sm"
              autoDir={false}
              value={componentName}
              onChange={(event) => setComponentName(sanitizeDesignerComponentNameInput(event.target.value))}
              ariaLabel="Component name"
              placeholder="e.g. order-summary"
            />
          </FormField>
          <FormField label="Type" required>
            <UiSelect
              size="sm"
              ariaLabel="Type"
              value={catalogKind}
              onChange={(event) => setCatalogKind(parseCatalogKind(event.target.value))}
            >
              {CATALOG_OPERATOR_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </UiSelect>
          </FormField>
        </FormSection>
      ) : null}
    </StepWizardShell>
  );
};
