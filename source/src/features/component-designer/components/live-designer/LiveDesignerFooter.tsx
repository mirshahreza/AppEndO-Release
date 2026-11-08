import * as React from 'react';
import { AlertTriangle, CircleAlert } from 'lucide-react';
import type { DesignerDiagnostic } from '../../../../domain/component-designer/types';
import { getDesignerDiagnosticCategory } from '../../../../domain/component-designer/a11yDiagnostics';
import { FooterLabelDropdown } from '../../../../shared/ui';
import { ShellResponsivePopover } from '../../../../shared/ui/shell-foundation/ShellResponsivePopover';
import { cn } from '../../../../lib/utils';
import { DesignerDiagnosticsPanel } from '../DesignerDiagnosticsPanel';
import type { LiveDesignerInteractionMode } from './liveDesignerInteractionMode';
import { LIVE_DESIGNER_TOOLBOX_MINIMIZE_ABOVE_ATTR } from './liveDesignerToolboxAnchor';

const INTERACTION_MODE_OPTIONS: ReadonlyArray<{
  value: LiveDesignerInteractionMode;
  label: string;
}> = [
  { value: 'inspect', label: 'Inspect' },
  { value: 'interact', label: 'Interact' },
];

export type LiveDesignerFooterProps = {
  selectionLabel?: string | null;
  isDirty?: boolean;
  interactionMode?: LiveDesignerInteractionMode;
  onInteractionModeChange?: (mode: LiveDesignerInteractionMode) => void;
  diagnostics?: readonly DesignerDiagnostic[];
  onSelectDiagnosticNode?: (nodeId: string) => void;
};

const resolveDiagnosticsTone = (diagnostics: readonly DesignerDiagnostic[]): {
  label: string;
  buttonClass: string;
  Icon: typeof CircleAlert;
} => {
  const hasError = diagnostics.some((item) => getDesignerDiagnosticCategory(item) === 'errors');
  if (hasError) {
    return {
      label: 'Errors',
      buttonClass: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
      Icon: CircleAlert,
    };
  }
  const hasWarning = diagnostics.some((item) => getDesignerDiagnosticCategory(item) === 'warnings');
  if (hasWarning) {
    return {
      label: 'Warnings',
      buttonClass: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
      Icon: AlertTriangle,
    };
  }
  return {
    label: 'Accessibility',
    buttonClass: 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100',
    Icon: AlertTriangle,
  };
};

export const LiveDesignerFooter: React.FC<LiveDesignerFooterProps> = ({
  selectionLabel = null,
  isDirty = false,
  interactionMode = 'inspect',
  onInteractionModeChange,
  diagnostics = [],
  onSelectDiagnosticNode,
}) => {
  const [diagnosticsOpen, setDiagnosticsOpen] = React.useState(false);
  const hasDiagnostics = diagnostics.length > 0;
  const tone = hasDiagnostics ? resolveDiagnosticsTone(diagnostics) : null;

  React.useEffect(() => {
    if (!hasDiagnostics && diagnosticsOpen) {
      setDiagnosticsOpen(false);
    }
  }, [diagnosticsOpen, hasDiagnostics]);

  return (
    <footer
      className="flex min-h-6 shrink-0 items-center gap-2 border-t border-slate-200/80 bg-slate-50/70 px-3 py-0.5 text-[10px] leading-none text-slate-500 select-none"
      aria-label="Live Designer status"
      data-testid="live-designer-footer"
      {...{ [LIVE_DESIGNER_TOOLBOX_MINIMIZE_ABOVE_ATTR]: true }}
    >
      <div className="shrink-0" data-testid="live-designer-interaction-mode">
        <FooterLabelDropdown
          ariaLabel="Interaction mode"
          value={interactionMode}
          options={INTERACTION_MODE_OPTIONS}
          onChange={(next) => onInteractionModeChange?.(next)}
          triggerClassName="text-cyan-700 hover:text-cyan-800"
        />
      </div>
      <span className="text-slate-300" aria-hidden>|</span>
      <span className="shrink-0 font-medium uppercase tracking-wide text-slate-400">
        Selected
      </span>
      {selectionLabel ? (
        <span
          className="min-w-0 truncate font-mono text-slate-700"
          title={selectionLabel}
          data-testid="live-designer-selection-label"
        >
          {selectionLabel}
        </span>
      ) : (
        <span className="min-w-0 truncate text-slate-400">
          {interactionMode === 'inspect'
            ? 'None · drag to move · drag from toolbox · Ctrl+A select all · Ctrl+D duplicate · Ctrl+C/V copy/paste'
            : 'Press Esc or I to inspect'}
        </span>
      )}
      <div className="ms-auto flex shrink-0 items-center gap-2">
        <span className="font-medium uppercase tracking-wide" data-testid="live-designer-dirty-flag">
          {isDirty ? (
            <span className="text-amber-700">Unsaved</span>
          ) : (
            <span className="text-slate-400">Saved</span>
          )}
        </span>
        {hasDiagnostics && tone ? (
          <ShellResponsivePopover
            open={diagnosticsOpen}
            onOpenChange={setDiagnosticsOpen}
            placement="top-end"
            fallbackPlacement="top-start"
            portal
            ariaLabel="Document diagnostics"
            className="w-[22rem] p-2"
            trigger={(
              <button
                type="button"
                data-testid="live-designer-diagnostics-button"
                className={cn(
                  'inline-flex h-5 items-center gap-1 rounded border px-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                  tone.buttonClass,
                )}
                aria-label={`${diagnostics.length} diagnostics`}
                title={`${diagnostics.length} document ${tone.label.toLowerCase()}`}
              >
                <tone.Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
                <span>{diagnostics.length}</span>
              </button>
            )}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Diagnostics
              </p>
              <span className="text-[10px] tabular-nums text-slate-400">{diagnostics.length}</span>
            </div>
            <DesignerDiagnosticsPanel
              diagnostics={diagnostics}
              onSelectNode={(nodeId) => {
                onSelectDiagnosticNode?.(nodeId);
                setDiagnosticsOpen(false);
              }}
            />
          </ShellResponsivePopover>
        ) : null}
      </div>
    </footer>
  );
};
