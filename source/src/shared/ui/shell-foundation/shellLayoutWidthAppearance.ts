import type { AppearanceSessionResponse } from '../../api/contracts/appearance/shellExperience.schema';
import type { ShellLayoutWidth } from './shellLayoutWidth';

export type LayoutWidthChromeState = {
  defaultWidth: ShellLayoutWidth;
  canUserToggle: boolean;
  expanded: boolean;
  activeWidth: ShellLayoutWidth;
};

type AppearanceLayoutSession = Pick<
  AppearanceSessionResponse,
  'portalDefaults' | 'effective'
>;

/**
 * Maps portal defaults + effective merge to bounded-canvas chrome (optional fluid expand).
 */
export function resolveLayoutWidthChromeFromAppearance(
  session: AppearanceLayoutSession,
): LayoutWidthChromeState {
  const portalBase = session.portalDefaults.layoutWidth ?? 'fluid';
  const effectiveWidth = session.effective.layoutWidth;
  const canUserToggle = session.effective.layoutWidthUserControl;

  if (portalBase === 'fluid') {
    const activeWidth: ShellLayoutWidth = effectiveWidth === 'bounded' ? 'bounded' : 'fluid';
    if (!canUserToggle) {
      return {
        defaultWidth: 'fluid',
        canUserToggle: false,
        expanded: false,
        activeWidth,
      };
    }
    return {
      defaultWidth: 'fluid',
      canUserToggle: true,
      expanded: activeWidth === 'fluid',
      activeWidth,
    };
  }

  if (!canUserToggle) {
    return {
      defaultWidth: 'bounded',
      canUserToggle: false,
      expanded: false,
      activeWidth: 'bounded',
    };
  }

  const expanded = effectiveWidth === 'fluid';
  return {
    defaultWidth: 'bounded',
    canUserToggle: true,
    expanded,
    activeWidth: expanded ? 'fluid' : 'bounded',
  };
}
