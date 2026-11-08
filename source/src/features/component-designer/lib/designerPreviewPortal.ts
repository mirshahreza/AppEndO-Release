import type { DesignerDocument } from '../../../domain/component-designer/types';
import {
  defaultComponentAlonePortal,
  isBuiltInComponentAlonePortal,
  resolvePortalLayoutKey,
  type ExperienceManifestPortal,
} from '../../../shared/api/contracts/platform/experienceManifest';
import { COMPONENT_ALONE_PORTAL_SEGMENT } from '../../../shared/api/contracts/platform/mountConstants';
import { SHELL_DRAFT_FOLDER, COMPONENT_ALONE_SHELL_LAYOUT_KEY } from '../../../shared/lib/designerShellEntry';
import { documentHasShellRouteOutletSlot } from '../../../shared/lib/shellRouteOutlet';

export { COMPONENT_ALONE_PORTAL_SEGMENT, COMPONENT_ALONE_SHELL_LAYOUT_KEY };

export function isComponentAlonePreviewPortal(
  portal: Pick<ExperienceManifestPortal, 'segment'>,
): boolean {
  return isBuiltInComponentAlonePortal(portal);
}

export function defaultComponentAlonePreviewPortal(): ExperienceManifestPortal {
  return defaultComponentAlonePortal();
}

export function mergePreviewPortalOptions(
  manifestPortals: ExperienceManifestPortal[],
): ExperienceManifestPortal[] {
  if (manifestPortals.some((portal) => isBuiltInComponentAlonePortal(portal))) {
    return manifestPortals;
  }

  return [defaultComponentAlonePortal(), ...manifestPortals];
}

export function resolvePreviewPortalShellKey(
  portalSegment: string,
  portalOptions: ExperienceManifestPortal[],
): string | null {
  const trimmed = portalSegment.trim();
  if (!trimmed) {
    return null;
  }

  const portal = portalOptions.find((entry) => entry.segment === trimmed);
  if (!portal) {
    return null;
  }

  if (isBuiltInComponentAlonePortal(portal)) {
    return COMPONENT_ALONE_SHELL_LAYOUT_KEY;
  }

  return resolvePortalLayoutKey(portal.segment, portal.shellKey);
}

export function shouldFrameDesignerCanvas(options: {
  document: DesignerDocument;
  componentFolder?: string | null;
  portalShellKey: string | null;
}): boolean {
  const { document, componentFolder, portalShellKey } = options;
  if (!portalShellKey) {
    return false;
  }

  if (componentFolder?.trim() === SHELL_DRAFT_FOLDER) {
    return false;
  }

  if (portalShellKey === COMPONENT_ALONE_SHELL_LAYOUT_KEY) {
    return false;
  }

  if (documentHasShellRouteOutletSlot(document)) {
    return false;
  }

  return true;
}
