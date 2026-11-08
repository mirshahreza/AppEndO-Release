import * as React from 'react';
import { Suspense, lazy } from 'react';
import { CultureProvider } from '../../../core/culture/CultureContext';
import { resolveCultureById } from '../../../core/culture/MountCultureResolver';
import { ShellRouteOutlet } from '../../../app/platform/ShellRouteOutlet';
import { collectAccessibilityDiagnostics } from '../../../domain/component-designer/a11yDiagnostics';
import type { DesignerBindingDefinitions, DesignerDocument } from '../../../domain/component-designer/types';
import type { ExperienceManifestPortal } from '../../../shared/api/contracts/platform/experienceManifest';
import { cn } from '../../../lib/utils';
import { documentHasShellRouteOutletSlot } from '../../../shared/lib/shellRouteOutlet';
import { documentNeedsShellRuntimeSlots } from '../../../shared/lib/shellDocumentRuntime';
import { ShellBoundedLayoutCanvas } from '../../../shared/ui/shell-foundation/ShellBoundedLayoutCanvas';
import {
  documentUsesShellFrame,
  readShellBoundedEdge,
  readShellBoundedMaxWidth,
  resolveShellLayoutBackdropStyle,
  ShellLayoutWidthProvider,
  useResolvedShellLayoutWidth,
} from '../../../shared/ui/shell-foundation';
import { resolvePreviewCultureId } from '../lib/designerPreviewSession';
import { resolveEffectivePreviewDirection } from '../lib/designerPreviewDirection';
import { COMPONENT_ALONE_SHELL_LAYOUT_KEY } from '../lib/designerPreviewPortal';
import { useDesignerShellRuntimeSlots } from '../lib/designerShellRuntimeSlots';
import { DesignerPreviewPortalShell } from './DesignerPreviewPortalShell';
import { DesignerPreviewRuntimeProviders } from './DesignerPreviewRuntimeProviders';
const DesignerDocumentPreview = lazy(async () => {
  const module = await import('../../../domain/component-designer/designerRuntimePreview');
  return { default: module.DesignerDocumentPreview };
});

export type DesignerPreviewViewportProps = {
  document: DesignerDocument;
  bindingDefinitions?: DesignerBindingDefinitions | Record<string, unknown>;
  previewResults?: Record<string, unknown>;
  selectedCultureId: string;
  portalShellKey: string | null;
  portalSegment: string;
  portalOptions: readonly ExperienceManifestPortal[];
  previewDirectionOverride?: 'ltr' | 'rtl' | null;
  className?: string;
  fullHeight?: boolean;
  simulatedRole?: string;
};

const checkA11yIssues = (document: DesignerDocument) => {
  // Phase 50: single source of truth — same rules as validation.ts / Diagnostics panel.
  return collectAccessibilityDiagnostics(document);
};

const DesignerPreviewViewportBody: React.FC<DesignerPreviewViewportProps> = ({
  document,
  bindingDefinitions = {},
  previewResults = {},
  selectedCultureId,
  portalShellKey,
  portalSegment,
  portalOptions,
  previewDirectionOverride = null,
  className,
  fullHeight = false,
  simulatedRole = '',
}) => {
  const cultureId = resolvePreviewCultureId(selectedCultureId);
  const resolvedCulture = React.useMemo(() => resolveCultureById(cultureId), [cultureId]);
  const effectiveDirection = resolveEffectivePreviewDirection(
    resolvedCulture.direction,
    previewDirectionOverride,
  );
  const isComponentAloneShell = portalShellKey === COMPONENT_ALONE_SHELL_LAYOUT_KEY;
  const layoutIncludesRouteOutlet = documentHasShellRouteOutletSlot(document);
  const previewPaddingClass = isComponentAloneShell || layoutIncludesRouteOutlet ? '' : ' p-[15px]';
  const useShellFrame = Boolean(portalShellKey) && !isComponentAloneShell && !layoutIncludesRouteOutlet;
  const runtimeSlots = useDesignerShellRuntimeSlots(document, {
    routeOutlet: layoutIncludesRouteOutlet ? <ShellRouteOutlet /> : undefined,
  });
  const shellLayoutWidth = useResolvedShellLayoutWidth(document);
  const boundedMaxWidth = readShellBoundedMaxWidth(document);
  const boundedEdge = readShellBoundedEdge(document);
  const usesShellFrame = documentUsesShellFrame(document);
  const boundedBackdropStyle = React.useMemo(
    () => resolveShellLayoutBackdropStyle(document),
    [document],
  );
  const needsShellRuntime = documentNeedsShellRuntimeSlots(document);

  const [isA11yPanelOpen, setIsA11yPanelOpen] = React.useState(false);
  const a11yIssues = React.useMemo(() => checkA11yIssues(document), [document]);

  const documentPreview = (
    <Suspense fallback={<div className="flex min-h-[120px] items-center justify-center text-xs text-slate-500">Loading preview…</div>}>
      <DesignerDocumentPreview
        document={document}
        bindingDefinitions={bindingDefinitions}
        previewResults={previewResults}
        runtimeSlots={runtimeSlots}
        simulatedRole={simulatedRole}
        layoutMode="shell"
      />
    </Suspense>
  );

  const componentPreview = (
    <div
      dir={effectiveDirection}
      className={cn(
        needsShellRuntime && shellLayoutWidth === 'bounded' ? 'bg-transparent' : 'bg-white',
        previewPaddingClass,
        fullHeight && 'flex h-full min-h-0 w-full flex-col overflow-y-auto',
        needsShellRuntime && shellLayoutWidth === 'bounded' && 'overflow-hidden [&_.h-screen]:!h-full [&_.h-dvh]:!h-full',
      )}
    >
      {needsShellRuntime && shellLayoutWidth === 'bounded' && !usesShellFrame ? (
        <ShellBoundedLayoutCanvas
          layoutWidth={shellLayoutWidth}
          boundedMaxWidth={boundedMaxWidth}
          boundedEdge={boundedEdge}
          backdropStyle={boundedBackdropStyle}
          className="min-h-full flex-1"
        >
          {documentPreview}
        </ShellBoundedLayoutCanvas>
      ) : (
        documentPreview
      )}
    </div>
  );

  const framedPreview = useShellFrame ? (
    <DesignerPreviewPortalShell
      shellKey={portalShellKey!}
      className={fullHeight
        ? 'h-full min-h-0 w-full overflow-hidden'
        : 'min-h-[240px] w-full overflow-hidden rounded-md border border-slate-200'}
      routeOutlet={componentPreview}
    />
  ) : componentPreview;

  return (
    <div
      className={cn(
        fullHeight && 'flex h-full min-h-0 w-full flex-col',
        className,
      )}
    >
      <div className="flex-1 min-h-0 relative">
        {framedPreview}
      </div>
      {a11yIssues.length > 0 && (
        <div
          data-testid="a11y-warnings-panel"
          className="mt-2 border border-amber-200 bg-amber-50 rounded-lg p-2.5 text-xs text-amber-900 shadow-sm shrink-0"
        >
          <div className="flex items-center justify-between font-semibold">
            <span className="flex items-center gap-1">
              ⚠️ Accessibility Warnings ({a11yIssues.length})
            </span>
            <button
              type="button"
              data-testid="a11y-toggle-details-btn"
              onClick={() => setIsA11yPanelOpen(!isA11yPanelOpen)}
              className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 transition-colors text-[10px] cursor-pointer"
            >
              {isA11yPanelOpen ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
          {isA11yPanelOpen && (
            <ul className="mt-2 space-y-1 pl-4 list-disc max-h-36 overflow-y-auto" data-testid="a11y-issues-list">
              {a11yIssues.map((issue) => (
                <li key={issue.id} data-testid={`a11y-issue-${issue.id}`}>
                  {issue.message} {issue.nodeId && <span className="text-[10px] text-slate-400">({issue.nodeId})</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export const DesignerPreviewViewport: React.FC<DesignerPreviewViewportProps> = (props) => {
  const cultureId = resolvePreviewCultureId(props.selectedCultureId);

  return (
    // CultureProvider must wrap DesignerPreviewRuntimeProviders, not the other way around:
    // DesignerPublishedShellChromeProvider (mounted inside DesignerPreviewRuntimeProviders)
    // renders ProfileDrawer/AboutAppModal as *siblings* of `children`, not descendants of it —
    // so when CultureProvider only wrapped `children`, those always-mounted shell chrome pieces
    // sat outside its reach. Opening the profile menu's "more" modal (which calls useCultureT)
    // then threw "useCulture must be used within CultureProvider" and crashed this entire preview
    // route, taking the actual document preview down with it.
    <CultureProvider cultureId={cultureId}>
      <DesignerPreviewRuntimeProviders
        portalSegment={props.portalSegment}
        portalOptions={props.portalOptions}
      >
        <ShellLayoutWidthProvider document={props.document} shellKey={props.document.id}>
          <DesignerPreviewViewportBody {...props} />
        </ShellLayoutWidthProvider>
      </DesignerPreviewRuntimeProviders>
    </CultureProvider>
  );
};
