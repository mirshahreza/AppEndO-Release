import { STUDIO_PORTAL_SEGMENT } from '../api/contracts/platform/mountConstants';
import {
  DEFAULT_SHELL_LAYOUT_KEY,
  parseDesignerShellEntry,
  SHELL_DRAFT_FOLDER,
} from './designerShellEntry';
import { parseDesignerComponentPath } from './designerComponentPath';

const REGISTRY_SHELL_KEYS = new Set(['admin', 'designer', 'studio', 'home-shell']);

/**
 * Designer layout draft key for `core:AppShell` chrome (not the platform shell registry key).
 */
export function resolveAppShellLayoutDraftKey(
  portal: { portalSegment?: string; shellKey?: string } | null | undefined,
): string {
  const registryKey = portal?.shellKey?.trim() ?? '';
  const designerEntry = registryKey ? parseDesignerShellEntry(registryKey) : null;
  if (designerEntry?.shellKey) {
    return designerEntry.shellKey;
  }

  const parsedPath = registryKey ? parseDesignerComponentPath(registryKey) : null;
  if (parsedPath?.folder === SHELL_DRAFT_FOLDER && parsedPath.componentName) {
    return parsedPath.componentName;
  }

  if (registryKey && !REGISTRY_SHELL_KEYS.has(registryKey)) {
    return registryKey;
  }

  const segment = portal?.portalSegment?.trim();
  if (segment === STUDIO_PORTAL_SEGMENT || !segment) {
    return 'app-shell';
  }

  return registryKey || DEFAULT_SHELL_LAYOUT_KEY;
}
