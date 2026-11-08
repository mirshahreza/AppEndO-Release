import * as React from 'react';
import { ClipboardCheck, Eye, Link2, PanelTop } from 'lucide-react';
import type { DataSourceDefinition, DesignerAction, DesignerBindingDefinitions, DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import {
  buildGridDetailWizardActions,
  findFormRegionInside,
  gridNodeHasListBinding,
  listDesignerModalNodes,
  parseGridDetailFlowConfig,
  resolveDetailLoadEndpoint,
  suggestGridDetailPrimaryKeyField,
  validateDetailDataSourceForGridFlow,
  type GridDetailWizardConfig,
} from '../../../domain/component-designer/bindingGridDetailEngine';
import { getNodeGridListResourceRef } from '../../../domain/component-designer/bindingGridEngine';
import { getDataSources } from '../../../domain/component-designer/bindingRegistry';
import { buildDataSourceFromEndpoint } from '../../../domain/component-designer/bindingResourceModel';
import { collectNodeBindingHealth } from '../../../domain/component-designer/bindingDiagnostics';
import { AppSurfaceBox } from '../../../shared/ui/AppSurfaceBox';
import { StepWizardShell, type StepWizardStepDef } from '../../../shared/ui/StepWizardShell';
import { DesignerDialogHostContext } from '../../../shared/ui/designerDialogHostContext';
import { UiInput, UiSelect } from '../../../shared/ui';
import { BindingHealthSummary } from './BindingHealthSummary';
import { BindingResourceQuickConnect } from './BindingResourceQuickConnect';
import { DesignerFieldRow } from './DesignerFieldRow';

const WIZARD_STEPS: readonly StepWizardStepDef[] = [
  {
    title: 'Detail API',
    icon: Link2,
    description: 'Connect the GET-one endpoint used when a row action opens the detail view.',
  },
  {
    title: 'Modal',
    icon: PanelTop,
    description: 'Choose the modal shell and which fields to show inside it.',
  },
  {
    title: 'Done',
    icon: ClipboardCheck,
    description: 'Adds an action column and wires row click → selection → modal → detail load.',
  },
];

type BindingGridDetailWizardDialogProps = {
  open: boolean;
  onClose: () => void;
  document: DesignerDocument;
  gridNode: DesignerNode;
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
};

const defaultDetailColumns = (dataSource: DataSourceDefinition | undefined): string[] => {
  if (!dataSource) {
    return ['title'];
  }

  const preferred = ['topic_label', 'title', 'note', 'created_by_username', 'created_at'];
  const available = preferred.filter((field) => dataSource.fields.includes(field));
  if (available.length > 0) {
    return available;
  }

  return dataSource.fields.filter((field) => field !== 'id').slice(0, 4);
};

export const BindingGridDetailWizardDialog: React.FC<BindingGridDetailWizardDialogProps> = ({
  open,
  onClose,
  document,
  gridNode,
  bindingDefinitions,
  dispatch,
}) => {
  const listRef = getNodeGridListResourceRef(gridNode);
  const listDataSource = listRef ? bindingDefinitions.dataSources[listRef] : undefined;
  const existingFlow = parseGridDetailFlowConfig(gridNode);
  const modalNodes = React.useMemo(() => listDesignerModalNodes(document), [document]);

  const [step, setStep] = React.useState(0);
  const [detailDataSourceId, setDetailDataSourceId] = React.useState(
    () => existingFlow?.detailDataSourceRef ?? '',
  );
  const [quickEndpoint, setQuickEndpoint] = React.useState('');
  const [detailModalNodeId, setDetailModalNodeId] = React.useState(
    () => existingFlow?.detailModalNodeId ?? modalNodes[0]?.id ?? '',
  );
  const [detailRegionNodeId, setDetailRegionNodeId] = React.useState(
    () => existingFlow?.detailRegionNodeId ?? '',
  );
  const [primaryKeyField, setPrimaryKeyField] = React.useState(
    () => existingFlow?.primaryKeyField ?? suggestGridDetailPrimaryKeyField(listDataSource, undefined),
  );
  const [rowActionLabel, setRowActionLabel] = React.useState(
    () => existingFlow?.rowActionLabel ?? 'Details',
  );
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const detailDataSource = detailDataSourceId
    ? bindingDefinitions.dataSources[detailDataSourceId]
    : undefined;

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const flow = parseGridDetailFlowConfig(gridNode);
    const modals = listDesignerModalNodes(document);
    setStep(0);
    setDetailDataSourceId(flow?.detailDataSourceRef ?? '');
    setQuickEndpoint(flow ? bindingDefinitions.dataSources[flow.detailDataSourceRef]?.endpoint ?? '' : '');
    setDetailModalNodeId(flow?.detailModalNodeId ?? modals[0]?.id ?? '');
    setDetailRegionNodeId(flow?.detailRegionNodeId ?? '');
    setPrimaryKeyField(flow?.primaryKeyField ?? suggestGridDetailPrimaryKeyField(listDataSource, undefined));
    setRowActionLabel(flow?.rowActionLabel ?? 'Details');
    setValidationError(null);
  }, [open, gridNode, document, bindingDefinitions, listDataSource]);

  React.useEffect(() => {
    if (!detailModalNodeId) {
      return;
    }

    const existingRegion = findFormRegionInside(document, detailModalNodeId);
    if (existingRegion) {
      setDetailRegionNodeId(existingRegion);
    }
  }, [detailModalNodeId, document]);

  const health = React.useMemo(
    () => collectNodeBindingHealth(document, bindingDefinitions, gridNode.id),
    [bindingDefinitions, document, gridNode.id],
  );

  const validateStep = (stepIndex: number): boolean => {
    if (stepIndex === 0) {
      if (!gridNodeHasListBinding(gridNode)) {
        setValidationError('Connect the grid to a list API before adding row details.');
        return false;
      }
      if (!detailDataSourceId.trim()) {
        setValidationError('Connect a GET-one detail endpoint.');
        return false;
      }
      const detailValidation = validateDetailDataSourceForGridFlow(detailDataSource);
      if (detailValidation) {
        setValidationError(detailValidation);
        return false;
      }
    }

    if (stepIndex === 1) {
      if (!detailModalNodeId.trim()) {
        setValidationError('Add a Modal component to the canvas or select an existing one.');
        return false;
      }
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
    setDetailDataSourceId(dataSource.id);
    setPrimaryKeyField(suggestGridDetailPrimaryKeyField(listDataSource, dataSource));
  };

  const handleApply = () => {
    if (!validateStep(0) || !validateStep(1)) {
      return;
    }

    const source = bindingDefinitions.dataSources[detailDataSourceId]
      ?? buildDataSourceFromEndpoint(quickEndpoint, { existingId: detailDataSourceId });

    const config: GridDetailWizardConfig = {
      gridNodeId: gridNode.id,
      detailDataSourceId,
      detailDataSource: source,
      detailModalNodeId,
      detailRegionNodeId,
      primaryKeyField: primaryKeyField.trim() || 'id',
      rowActionLabel: rowActionLabel.trim() || 'Details',
      detailDisplayColumns: defaultDetailColumns(source),
    };

    for (const action of buildGridDetailWizardActions(document, bindingDefinitions, config)) {
      dispatch(action as DesignerAction);
    }

    onClose();
  };

  if (!open) {
    return null;
  }

  return (
    <DesignerDialogHostContext.Provider value>
      <StepWizardShell
        size="4xl"
        title="Row Details Flow"
        titleIcon={Eye}
        subtitle="Action column → selection store → modal → GET detail"
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
          label: 'Apply row details',
          icon: <Link2 className="h-3.5 w-3.5" strokeWidth={2} />,
          onClick: handleApply,
          disabled: !detailDataSourceId.trim() || !detailModalNodeId.trim(),
        }}
      >
        {validationError ? (
          <div className="mb-3 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {validationError}
          </div>
        ) : null}

        {step === 0 ? (
          <div className="flex flex-col gap-3">
            <AppSurfaceBox tone="indigo" title="List resource">
              <p className="ps-[4px] text-xs text-slate-600">
                Grid list:
                {' '}
                <span className="font-mono text-[11px]">{listDataSource?.endpoint ?? 'Not connected'}</span>
              </p>
            </AppSurfaceBox>

            <BindingResourceQuickConnect
              bindingDefinitions={bindingDefinitions}
              dataSourceId={detailDataSourceId}
              quickEndpoint={quickEndpoint}
              suggestedFields={defaultDetailColumns(detailDataSource)}
              defaultMethod="GET"
              methodFilter={['GET']}
              fieldSource="response"
              onDataSourceIdChange={(value) => {
                setDetailDataSourceId(value);
                const nextSource = getDataSources(bindingDefinitions)[value];
                setPrimaryKeyField(suggestGridDetailPrimaryKeyField(listDataSource, nextSource));
              }}
              onQuickEndpointChange={setQuickEndpoint}
              onCreateResource={upsertDataSource}
            />

            <DesignerFieldRow label="Primary key field" layout="stack">
              <UiInput
                size="sm"
                value={primaryKeyField}
                onChange={(event) => setPrimaryKeyField(event.target.value)}
                ariaLabel="Primary key field"
              />
            </DesignerFieldRow>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="flex flex-col gap-3">
            <AppSurfaceBox tone="violet" title="Modal target">
              {modalNodes.length === 0 ? (
                <p className="ps-[4px] text-xs text-amber-800">
                  No modal found. Drag a Modal from the palette onto the canvas, add an html.form inside it with read-only fields, then return here.
                </p>
              ) : (
                <div className="flex flex-col gap-[2px]">
                  <span className="ps-[4px] text-xs text-slate-500">Modal component</span>
                  <UiSelect
                    size="sm"
                    value={detailModalNodeId}
                    onChange={(event) => setDetailModalNodeId(event.target.value)}
                  >
                    {modalNodes.map((modal) => (
                      <option key={modal.id} value={modal.id}>
                        {typeof modal.props.title === 'string' && modal.props.title.trim()
                          ? modal.props.title
                          : modal.id}
                      </option>
                    ))}
                  </UiSelect>
                </div>
              )}
            </AppSurfaceBox>

            <DesignerFieldRow label="Action button label" layout="stack">
              <UiInput
                size="sm"
                value={rowActionLabel}
                onChange={(event) => setRowActionLabel(event.target.value)}
                ariaLabel="Action button label"
              />
            </DesignerFieldRow>

            {detailRegionNodeId ? (
              <p className="ps-[4px] text-[11px] text-slate-500">
                Detail form region:
                {' '}
                <span className="font-mono">{detailRegionNodeId}</span>
              </p>
            ) : (
              <p className="ps-[4px] text-[11px] text-slate-500">
                No form inside the modal yet. Apply will auto-create a read-only detail form from the connected API fields.
              </p>
            )}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-3">
            <AppSurfaceBox tone="cyan" title="What will be wired">
              <ul className="space-y-1 ps-[4px] text-xs text-slate-700">
                <li>Action column &quot;{rowActionLabel}&quot; on the grid</li>
                <li>
                  Row click sets
                  {' '}
                  <span className="font-mono">selection.id</span>
                  {' '}
                  from
                  {' '}
                  <span className="font-mono">{primaryKeyField}</span>
                </li>
                <li>Modal becomes visible and detail API reloads</li>
                <li>
                  Detail endpoint:
                  {' '}
                  <span className="font-mono text-[11px]">
                    {resolveDetailLoadEndpoint(detailDataSource) || detailDataSource?.endpoint}
                  </span>
                </li>
              </ul>
            </AppSurfaceBox>
            <BindingHealthSummary summary={health} />
          </div>
        ) : null}
      </StepWizardShell>
    </DesignerDialogHostContext.Provider>
  );
};
