import * as React from 'react';
import '../../../../shared/ui/site-shell.css';
import { CultureProvider } from '../../../../core/culture/CultureContext';
import { DesignerDocumentPreview } from '../../../../domain/component-designer/designerRuntimePreview';
import { ShellBoundedLayoutCanvas } from '../../../../shared/ui/shell-foundation/ShellBoundedLayoutCanvas';
import {
  documentUsesShellFrame,
  readShellBoundedEdge,
  readShellBoundedMaxWidth,
  resolveShellLayoutBackdropStyle,
  ShellLayoutWidthProvider,
  useResolvedShellLayoutWidth,
} from '../../../../shared/ui/shell-foundation';
import type {
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerViewportPreset,
} from '../../../../domain/component-designer/types';
import { STUDIO_PORTAL_SEGMENT } from '../../../../shared/api/contracts/platform/mountConstants';
import { documentNeedsShellRuntimeSlots } from '../../../../shared/lib/shellDocumentRuntime';
import { DEFAULT_PREVIEW_CULTURE_ID } from '../../lib/designerPreviewSession';
import { useDesignerShellRuntimeSlots } from '../../lib/designerShellRuntimeSlots';
import { ViewportTierContext } from '../../../../shared/lib/ViewportTierProvider';
import type { ViewportTier } from '../../../../shared/lib/viewportTokens';
import {
  collapseResponsiveClassNameForBreakpoint,
  styleBreakpointIdFromViewportPreset,
  type DesignerStyleBreakpointId,
} from '../../lib/designerStyleBreakpoints';
import { cn } from '../../../../lib/utils';
import { DesignerPreviewRuntimeProviders } from '../DesignerPreviewRuntimeProviders';

export type LiveDesignerPreviewProps = {
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  interactive?: boolean;
  className?: string;
  /** Keeps paint collapse aligned with Style breakpoint / canvas viewport preset. */
  viewportPreset?: DesignerViewportPreset;
};

const designerPresetToViewportTier = (preset: DesignerViewportPreset): ViewportTier => {
  if (preset === 'mobile') {
    return 'phone';
  }
  if (preset === 'tablet') {
    return 'tablet';
  }
  return 'desktop';
};

export { documentNeedsShellRuntimeSlots };

/**
 * Eager WYSIWYG surface for Live Designer.
 * Avoids DesignerPreviewViewport's lazy/Suspense shell so document prop edits
 * re-render immediately on the same path proven by liveDesignerPreviewPropSync tests.
 *
 * Shell layouts (`portal-layouts/*`) also need the same chrome/nav `runtimeSlots` wiring
 * as `DesignerPreviewViewport` — without it, logo/header/sidebar/nav fall back to amber
 * "Available at application runtime" placeholders and the canvas looks broken.
 * Route outlet stays a design-time placeholder (no `routeOutlet` injected here).
 */
const LiveDesignerPreviewCanvas: React.FC<LiveDesignerPreviewProps> = ({
  document,
  bindingDefinitions,
  interactive = false,
  className,
  viewportPreset = 'desktop',
}) => {
  const paintBreakpointId: DesignerStyleBreakpointId = styleBreakpointIdFromViewportPreset(viewportPreset);
  const collapsePaintClassName = React.useCallback(
    (tokenClassName: string) => collapseResponsiveClassNameForBreakpoint(tokenClassName, paintBreakpointId),
    [paintBreakpointId],
  );
  const needsShellRuntime = documentNeedsShellRuntimeSlots(document);
  const layoutWidth = useResolvedShellLayoutWidth(document);
  const boundedEdge = readShellBoundedEdge(document);
  const boundedMaxWidth = readShellBoundedMaxWidth(document);
  const usesShellFrame = documentUsesShellFrame(document);
  const boundedBackdropStyle = React.useMemo(
    () => resolveShellLayoutBackdropStyle(document),
    [document],
  );
  // No routeOutlet: keep the design-canvas "Page content loads here" placeholder while editing a shell.
  const runtimeSlots = useDesignerShellRuntimeSlots(document);

  const preview = (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-col',
        needsShellRuntime && layoutWidth === 'bounded' ? 'bg-transparent' : 'bg-white',
        needsShellRuntime
          ? 'overflow-hidden [&_.h-screen]:!h-full [&_.h-dvh]:!h-full [&_.min-h-screen]:!h-full [&_.min-h-dvh]:!h-full'
          : 'overflow-y-auto',
        className,
      )}
      data-testid="live-designer-preview"
      data-document-revision={document.metadata.updatedAt ?? ''}
      data-interactive={interactive ? 'true' : 'false'}
      data-paint-breakpoint={paintBreakpointId}
      data-shell-runtime={needsShellRuntime ? 'true' : 'false'}
    >
      {needsShellRuntime && layoutWidth === 'bounded' && !usesShellFrame ? (
        <ShellBoundedLayoutCanvas
          layoutWidth={layoutWidth}
          boundedMaxWidth={boundedMaxWidth}
          boundedEdge={boundedEdge}
          backdropStyle={boundedBackdropStyle}
          className="min-h-full flex-1"
        >
          <DesignerDocumentPreview
            document={document}
            bindingDefinitions={bindingDefinitions}
            interactive={interactive}
            collapsePaintClassName={collapsePaintClassName}
            runtimeSlots={runtimeSlots}
            layoutMode="shell"
          />
        </ShellBoundedLayoutCanvas>
      ) : (
        <DesignerDocumentPreview
          document={document}
          bindingDefinitions={bindingDefinitions}
          interactive={interactive}
          collapsePaintClassName={collapsePaintClassName}
          runtimeSlots={needsShellRuntime ? runtimeSlots : undefined}
          // Same height chain as DesignerPublishedPage: flex column so fillHeight
          // grids (toolbar sibling + flex-1 body) stretch. The default preview
          // wrapper (`space-y-3 overflow-y-auto`) is not a flex parent, so 100%
          // height on the canvas viewport never reaches the component.
          layoutMode="shell"
        />
      )}
    </div>
  );

  return preview;
};

export const LiveDesignerPreview: React.FC<LiveDesignerPreviewProps> = React.memo((props) => {
  const needsShellRuntime = documentNeedsShellRuntimeSlots(props.document);

  return (
    <div
      className={cn('relative z-0 flex h-full min-h-0 w-full flex-col', !props.interactive && 'pointer-events-none')}
      data-testid="live-designer-preview-host"
      data-designer-hit-root="true"
      data-interactive={props.interactive ? 'true' : 'false'}
    >
      <CultureProvider cultureId={DEFAULT_PREVIEW_CULTURE_ID}>
        <ViewportTierContext.Provider value={designerPresetToViewportTier(props.viewportPreset ?? 'desktop')}>
          {needsShellRuntime ? (
            <DesignerPreviewRuntimeProviders
              portalSegment={STUDIO_PORTAL_SEGMENT}
              portalOptions={[]}
            >
              <ShellLayoutWidthProvider document={props.document} shellKey={props.document.id}>
                <LiveDesignerPreviewCanvas {...props} />
              </ShellLayoutWidthProvider>
            </DesignerPreviewRuntimeProviders>
          ) : (
            <LiveDesignerPreviewCanvas {...props} />
          )}
        </ViewportTierContext.Provider>
      </CultureProvider>
    </div>
  );
});
LiveDesignerPreview.displayName = 'LiveDesignerPreview';
