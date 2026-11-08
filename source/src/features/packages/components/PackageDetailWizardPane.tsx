import React from 'react';
import { cn } from '../../../lib/utils';
import { FormSection } from '../../../shared/ui';
import {
  APP_SURFACE_BOX_TONE_CLASS,
  STEP_WIZARD_STEP_CELL_CLASS,
} from '../../../shared/ui/surfaceClasses';
import { MonacoEditorPanel } from '../../server-functions/components/MonacoEditorPanel';
import {
  PACKAGE_CAPABILITY_STEP,
  PACKAGE_CAPABILITY_WIZARD_STEPS,
} from '../lib/packageCapabilityWizardSteps';
import { packageWorkflowIdentity } from '../lib/packageWorkflows';
import type { PackageDetail } from '../types';
import { packageHasInstallScripts, packageHasUninstallScripts } from '../utils';
import { renderReadOnlyWizardTable } from './packageWizardReadOnlyTable';

const DETAIL_WIZARD_STEPS_HEADER_CLASS =
  'flex w-full shrink-0 border-b border-border-divider bg-surface-shell';

const DETAIL_WIZARD_DESCRIPTION_CLASS =
  'flex w-full shrink-0 border-b border-border-subtle bg-surface-elevated px-[15px] py-3';

const DETAIL_WIZARD_BODY_CLASS =
  'flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-white';

const DETAIL_WIZARD_STEP_INNER_CLASS =
  'flex min-h-0 flex-1 flex-col overflow-auto bg-white p-[15px]';
const SQL_EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 12,
  lineNumbers: 'on' as const,
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  automaticLayout: true,
  readOnly: true,
};

export type PackageDetailWizardPaneProps = {
  detailData: PackageDetail;
  step: number;
  onStepChange: (next: number) => void;
};

export const PackageDetailWizardPane: React.FC<PackageDetailWizardPaneProps> = ({
  detailData,
  step,
  onStepChange,
}) => {
  const manifest = detailData.bundleManifest;
  const capabilities = manifest?.capabilities;
  const activeStep = PACKAGE_CAPABILITY_WIZARD_STEPS[step];
  const ActiveStepIcon = activeStep?.icon;
  const isScriptStep = step === PACKAGE_CAPABILITY_STEP.installScripts
    || step === PACKAGE_CAPABILITY_STEP.uninstallScripts;
  const hasInstallScripts = packageHasInstallScripts(manifest);
  const hasUninstallScripts = packageHasUninstallScripts(manifest);

  const renderStepContent = () => {
    if (!manifest || !capabilities) {
      return (
        <p className="text-sm text-amber-700">
          Bundle manifest for the selected version is not available.
        </p>
      );
    }

    if (step === PACKAGE_CAPABILITY_STEP.portal) {
      return (
        <div className="flex flex-col gap-1">
          <FormSection title="Portal" ink="accent">
            {renderReadOnlyWizardTable(
              [
                { key: 'segment', label: 'Segment' },
                { key: 'entry', label: 'Entry' },
              ],
              (capabilities.portals ?? []).map((portal) => ({
                key: portal.segment,
                cells: [
                  <span className="font-mono text-slate-600">{portal.segment}</span>,
                  <span className="font-mono text-slate-600 break-all">{portal.entry}</span>,
                ],
              })),
              'No portals in this package.',
            )}
          </FormSection>

          <FormSection title="Dependencies" ink="complement" divided>
            <div className="flex flex-col gap-[2px]">
              <p className="ps-[4px] text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Navigation manifests
              </p>
              {renderReadOnlyWizardTable(
                [
                  { key: 'id', label: 'ID' },
                  { key: 'entry', label: 'Entry' },
                ],
                (capabilities.navigations ?? []).map((navigation) => ({
                  key: navigation.id,
                  cells: [
                    <span className="font-mono text-slate-600">{navigation.id}</span>,
                    <span className="font-mono text-slate-600 break-all">{navigation.entry}</span>,
                  ],
                })),
                'No navigation manifests in this package.',
              )}
            </div>
          </FormSection>
        </div>
      );
    }

    if (step === PACKAGE_CAPABILITY_STEP.serverFunctions) {
      return renderReadOnlyWizardTable(
        [
          { key: 'method', label: 'Method' },
          { key: 'path', label: 'Path' },
          { key: 'name', label: 'Name' },
        ],
        capabilities.apis.map((api) => ({
          key: api.id,
          cells: [
            <span className="font-semibold">{api.method}</span>,
            <span className="text-slate-600">{api.path}</span>,
            api.id,
          ],
        })),
        'No server functions in this package.',
      );
    }

    if (step === PACKAGE_CAPABILITY_STEP.clientComponents) {
      return (
        <div className="flex flex-col gap-3">
          {detailData.installStatus === 'installed' ? (
            <div className="rounded-md border border-sky-200 bg-sky-50/70 px-3 py-2 text-xs text-sky-800">
              Installed components appear in
              {' '}
              <span className="font-semibold">Client Components</span>
              {' '}
              as read-only package source.
            </div>
          ) : null}
          {renderReadOnlyWizardTable(
            [
              { key: 'component', label: 'Component' },
              { key: 'entry', label: 'Entry' },
            ],
            capabilities.ui_components.map((ui) => ({
              key: `${ui.componentKey}:${ui.entry}`,
              cells: [
                ui.componentKey,
                <span className="font-mono text-slate-600 break-all">{ui.entry}</span>,
              ],
            })),
            'No client components in this package.',
          )}
        </div>
      );
    }

    if (step === PACKAGE_CAPABILITY_STEP.edgeData) {
      return (
        <div className="flex flex-col gap-1">
          <FormSection title="Models" ink="accent">
            {renderReadOnlyWizardTable(
              [
                { key: 'id', label: 'Id' },
                { key: 'entry', label: 'Entry' },
              ],
              (capabilities.edge_models ?? []).map((model) => ({
                key: model.id,
                cells: [
                  <span className="font-mono text-slate-700">{model.id}</span>,
                  <span className="font-mono text-slate-600 break-all">{model.entry}</span>,
                ],
              })),
              'No Edge models in this package.',
            )}
          </FormSection>
          <FormSection title="APIs" ink="contrast" divided>
            {renderReadOnlyWizardTable(
              [
                { key: 'id', label: 'Id' },
                { key: 'model', label: 'Model' },
              ],
              (capabilities.edge_apis ?? []).map((api) => ({
                key: api.id,
                cells: [
                  <span className="font-mono text-slate-700">{api.id}</span>,
                  <span className="font-mono text-slate-600">{api.edgeModelId}</span>,
                ],
              })),
              'No Edge APIs in this package.',
            )}
          </FormSection>
        </div>
      );
    }

    if (step === PACKAGE_CAPABILITY_STEP.workflows) {
      return renderReadOnlyWizardTable(
        [
          { key: 'workflow', label: 'Workflow' },
          { key: 'entry', label: 'Entry' },
        ],
        (capabilities.workflows ?? []).map((workflow) => ({
          key: packageWorkflowIdentity(workflow.scopeKey, workflow.key),
          cells: [
            <span className="font-mono text-slate-700">{packageWorkflowIdentity(workflow.scopeKey, workflow.key)}</span>,
            <span className="font-mono text-slate-600 break-all">{workflow.entry}</span>,
          ],
        })),
        'No workflows in this package.',
      );
    }

    if (step === PACKAGE_CAPABILITY_STEP.installScripts) {
      if (!hasInstallScripts) {
        return <div className="text-xs text-slate-500">No install scripts in this package.</div>;
      }
      return (
        <div className="flex flex-1 min-h-0 w-full overflow-hidden">
          <MonacoEditorPanel
            language="sql"
            defaultLanguage="sql"
            value={detailData.installSql ?? ''}
            onChange={() => {}}
            options={SQL_EDITOR_OPTIONS}
            documentKey={`package-detail-install-sql-${detailData.packageId}-${detailData.version}`}
          />
        </div>
      );
    }

    if (!hasUninstallScripts) {
      return <div className="text-xs text-slate-500">No uninstall scripts in this package.</div>;
    }
    return (
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        <MonacoEditorPanel
          language="sql"
          defaultLanguage="sql"
          value={detailData.uninstallSql ?? ''}
          onChange={() => {}}
          options={SQL_EDITOR_OPTIONS}
          documentKey={`package-detail-uninstall-sql-${detailData.packageId}-${detailData.version}`}
        />
      </div>
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <div className={DETAIL_WIZARD_STEPS_HEADER_CLASS}>
        <div
          className="grid w-full"
          style={{ gridTemplateColumns: `repeat(${PACKAGE_CAPABILITY_WIZARD_STEPS.length}, minmax(0, 1fr))` }}
        >
          {PACKAGE_CAPABILITY_WIZARD_STEPS.map((stepDef, index) => {
            const isActive = index === step;
            const StepIcon = stepDef.icon;

            return (
              <button
                key={stepDef.title}
                type="button"
                onClick={() => onStepChange(index)}
                className={cn(
                  STEP_WIZARD_STEP_CELL_CLASS,
                  'cursor-pointer transition-colors',
                  isActive
                    ? 'bg-primary-subtle text-primary-700'
                    : 'text-text-nav hover:bg-slate-50',
                )}
              >
                {StepIcon ? (
                  <StepIcon
                    className={cn(
                      'size-4 shrink-0',
                      isActive
                        ? 'text-primary-600'
                        : 'text-text-nav-icon',
                    )}
                    aria-hidden
                  />
                ) : null}
                <span className="w-full truncate text-[11px] font-semibold leading-tight">
                  {stepDef.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {activeStep?.description ? (
        <div className={DETAIL_WIZARD_DESCRIPTION_CLASS}>
          <div className="flex items-center gap-3">
            {ActiveStepIcon ? (
              <div
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-lg',
                  activeStep.tone
                    ? APP_SURFACE_BOX_TONE_CLASS[activeStep.tone].strip
                    : 'bg-primary-subtle',
                )}
              >
                <ActiveStepIcon
                  className={cn(
                    'size-6',
                    activeStep.tone
                      ? APP_SURFACE_BOX_TONE_CLASS[activeStep.tone].title
                      : 'text-primary-600',
                  )}
                  aria-hidden
                />
              </div>
            ) : null}
            <p className="min-w-0 text-sm leading-snug text-slate-500">{activeStep.description}</p>
          </div>
        </div>
      ) : null}

      <div className={DETAIL_WIZARD_BODY_CLASS}>
        <div
          className={cn(
            DETAIL_WIZARD_STEP_INNER_CLASS,
            isScriptStep && '!overflow-hidden flex flex-col min-h-0 !p-0',
          )}
        >
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
};
