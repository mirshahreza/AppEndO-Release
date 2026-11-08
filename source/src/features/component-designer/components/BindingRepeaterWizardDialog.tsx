import * as React from 'react';
import { ClipboardCheck, Link2, List, Repeat } from 'lucide-react';
import type { DataSourceDefinition, DesignerAction, DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import {
  buildRepeaterBindingWizardActions,
  getNodeRepeaterListResourceRef,
} from '../../../domain/component-designer/bindingRepeaterEngine';
import { buildRepeaterListRequestPreview } from '../../../domain/component-designer/bindingPayloadPreview';
import { getDataSources } from '../../../domain/component-designer/bindingRegistry';
import { collectNodeBindingHealth } from '../../../domain/component-designer/bindingDiagnostics';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { StepWizardShell, type StepWizardStepDef } from '../../../shared/ui/StepWizardShell';
import { DesignerDialogHostContext } from '../../../shared/ui/designerDialogHostContext';
import { BindingHealthSummary } from './BindingHealthSummary';
import { BindingRequestPreview } from './BindingRequestPreview';
import { BindingResourceQuickConnect } from './BindingResourceQuickConnect';

const WIZARD_STEPS: readonly StepWizardStepDef[] = [
  {
    title: 'Connect',
    icon: Repeat,
    description: 'Connect this repeater to a list API endpoint.',
  },
  {
    title: 'Preview',
    icon: List,
    description: 'Review the array fields that will drive each repeated item.',
  },
  {
    title: 'Done',
    icon: ClipboardCheck,
    description: 'Confirm and apply the repeater binding.',
  },
];

type BindingRepeaterWizardDialogProps = {
  open: boolean;
  onClose: () => void;
  document: DesignerDocument;
  repeaterNode: DesignerNode;
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
};

export const BindingRepeaterWizardDialog: React.FC<BindingRepeaterWizardDialogProps> = ({
  open,
  onClose,
  document,
  repeaterNode,
  bindingDefinitions,
  dispatch,
}) => {
  const dataSourceOptions = React.useMemo(
    () => Object.values(getDataSources(bindingDefinitions)),
    [bindingDefinitions],
  );

  const [step, setStep] = React.useState(0);
  const [dataSourceId, setDataSourceId] = React.useState(() => getNodeRepeaterListResourceRef(repeaterNode) ?? dataSourceOptions[0]?.id ?? '');
  const [quickEndpoint, setQuickEndpoint] = React.useState('');
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [quickConnectSession, setQuickConnectSession] = React.useState(0);

  const selectedDataSource = dataSourceId ? bindingDefinitions.dataSources[dataSourceId] : undefined;

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const existingRef = getNodeRepeaterListResourceRef(repeaterNode);
    const existingSource = existingRef ? bindingDefinitions.dataSources[existingRef] : undefined;
    const initialSourceId = existingRef ?? dataSourceOptions[0]?.id ?? '';

    setStep(0);
    setDataSourceId(initialSourceId);
    setQuickEndpoint(existingSource?.endpoint ?? '');
    setValidationError(null);
    setQuickConnectSession((current) => current + 1);
  }, [open, repeaterNode, bindingDefinitions, dataSourceOptions]);

  const requestPreview = dataSourceId ? buildRepeaterListRequestPreview(dataSourceId, bindingDefinitions) : null;
  const health = React.useMemo(
    () => collectNodeBindingHealth(document, bindingDefinitions, repeaterNode.id),
    [bindingDefinitions, document, repeaterNode.id],
  );

  const validateStep = (stepIndex: number): boolean => {
    if (stepIndex === 0 && !dataSourceId.trim()) {
      setValidationError('Connect an API path or select a list resource.');
      return false;
    }

    setValidationError(null);
    return true;
  };

  const upsertDataSource = (dataSource: DataSourceDefinition) => {
    dispatch({
      type: 'set-data-source',
      dataSourceId: dataSource.id,
      dataSource,
    });
    setDataSourceId(dataSource.id);
  };

  const handleApply = () => {
    if (!dataSourceId.trim()) {
      setValidationError('Resource is required.');
      setStep(0);
      return;
    }

    const resolvedSource = bindingDefinitions.dataSources[dataSourceId];
    if (!resolvedSource) {
      setValidationError('Connect an API path or select a resource first.');
      setStep(0);
      return;
    }

    for (const action of buildRepeaterBindingWizardActions(repeaterNode, resolvedSource)) {
      dispatch(action);
    }

    onClose();
  };

  if (!open) {
    return null;
  }

  const previewFields = selectedDataSource?.fields ?? [];

  return (
    <DesignerDialogHostContext.Provider value>
      <StepWizardShell
        size="3xl"
        title="Connect Repeater to API"
        titleIcon={Repeat}
        subtitle="Paste a list endpoint — one repeated block per row"
        steps={WIZARD_STEPS}
        step={step}
        onStepChange={(next) => {
          setValidationError(null);
          setStep(next);
        }}
        onClose={onClose}
        onBackdropClick={onClose}
        onNext={validateStep}
        finalStepAction={{
          label: 'Apply & connect',
          icon: <Link2 className="h-3.5 w-3.5" strokeWidth={2} />,
          onClick: handleApply,
          disabled: !dataSourceId.trim(),
        }}
      >
        {validationError ? (
          <div className="mb-3 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {validationError}
          </div>
        ) : null}

        {step === 0 ? (
          <BindingResourceQuickConnect
            key={quickConnectSession}
            bindingDefinitions={bindingDefinitions}
            dataSourceId={dataSourceId}
            quickEndpoint={quickEndpoint}
            suggestedFields={previewFields}
            defaultMethod="GET"
            methodFilter={['GET']}
            fieldSource="response"
            onDataSourceIdChange={setDataSourceId}
            onQuickEndpointChange={setQuickEndpoint}
            onCreateResource={upsertDataSource}
          />
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-3">
            {previewFields.length > 0 ? (
              <AppSurfaceBox tone="cyan" title="Array item fields">
                <p className="mb-2 ps-[4px] text-xs text-slate-600">
                  Each API row becomes one repeated block. Child nodes can bind to
                  {' '}
                  <span className="font-mono">item.&lt;field&gt;</span>
                  {' '}
                  inside the repeater.
                </p>
                <ul className="space-y-0.5 font-mono text-[11px] text-slate-600">
                  {previewFields.map((field) => (
                    <li key={field} className="rounded-md border border-slate-100 bg-white px-2 py-1">
                      item.{field}
                    </li>
                  ))}
                </ul>
              </AppSurfaceBox>
            ) : (
              <AppSurfaceBox tone="amber" title="No fields detected">
                <p className="text-xs text-slate-600">
                  Connect a list endpoint in the previous step so we can preview row fields.
                </p>
              </AppSurfaceBox>
            )}

            {requestPreview ? (
              <BindingRequestPreview
                summary={{
                  method: requestPreview.method,
                  endpoint: requestPreview.endpoint,
                  bodyEntries: [],
                  onSuccess: 'One repeated block per list row',
                }}
              />
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-3">
            <AppSurfaceBox tone="cyan" title="Repeater data path">
              <p className="ps-[4px] text-xs text-slate-600">
                After apply, the repeater reads rows from the connected list resource automatically.
                Use
                {' '}
                <span className="font-mono">item.&lt;field&gt;</span>
                {' '}
                on child bindings for per-row values.
              </p>
            </AppSurfaceBox>

            {requestPreview ? (
              <BindingRequestPreview
                summary={{
                  method: requestPreview.method,
                  endpoint: requestPreview.endpoint,
                  bodyEntries: [],
                  onSuccess: 'Rows load from list response',
                }}
              />
            ) : null}

            <BindingHealthSummary summary={health} />
          </div>
        ) : null}
      </StepWizardShell>
    </DesignerDialogHostContext.Provider>
  );
};
