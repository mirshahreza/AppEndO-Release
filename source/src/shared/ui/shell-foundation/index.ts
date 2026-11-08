export { ShellFrame, type ShellFrameProps } from './ShellFrame';
export { ShellBoundedLayoutCanvas, type ShellBoundedLayoutCanvasProps } from './ShellBoundedLayoutCanvas';
export {
  documentUsesShellFrame,
  findShellFrameNode,
  readShellBoundedEdge,
  readShellBoundedMaxWidth,
  readShellLayoutWidth,
  readShellLayoutWidthUserControl,
  resolveShellLayoutBackdropStyle,
  shellBoundedChromeBaseClass,
  SHELL_BOUNDED_EDGE_CLASS,
  SHELL_BOUNDED_MAX_WIDTH_CLASS,
  SHELL_BOUNDED_MAX_WIDTH_DEFAULT,
  SHELL_LAYOUT_WIDTH_DEFAULT,
  type ShellBoundedEdge,
  type ShellBoundedMaxWidth,
  type ShellLayoutWidth,
} from './shellLayoutWidth';
export {
  ShellLayoutWidthProvider,
  useOptionalShellLayoutWidth,
  useResolvedShellLayoutWidth,
  useShellLayoutWidth,
  type ShellLayoutWidthContextValue,
  type ShellLayoutWidthProviderProps,
} from './ShellLayoutWidthContext';
export { ShellPageWidthHeaderControl } from './ShellPageWidthHeaderControl';
export { SiteShellHeaderWidthControl } from './SiteShellHeaderWidthControl';
export { ShellRegion, type ShellRegionProps } from './ShellRegion';
export { ShellHeader, type ShellHeaderProps } from './ShellHeader';
export { ShellSidebar, type ShellSidebarProps } from './ShellSidebar';
export { ShellContentHost, type ShellContentHostProps } from './ShellContentHost';
export { ShellAside, type ShellAsideProps } from './ShellAside';
export { ShellHero, type ShellHeroProps } from './ShellHero';
export { ShellFooter, type ShellFooterProps } from './ShellFooter';
export { ShellSurface, type ShellSurfaceProps } from './ShellSurface';
export { ShellLogoRegion, type ShellLogoRegionProps, type ShellLogoAsset } from './ShellLogoRegion';
export { ShellHeaderContext, type ShellHeaderContextProps } from './ShellHeaderContext';
export { ShellHeaderActions, type ShellHeaderActionsProps } from './ShellHeaderActions';
export { ShellResponsiveDrawer, type ShellResponsiveDrawerProps } from './ShellResponsiveDrawer';
export { ShellResponsivePopover, type ShellResponsivePopoverProps } from './ShellResponsivePopover';
export { ShellAccentControl, type ShellAccentControlProps, type ShellAccentOption } from './ShellAccentControl';
export { ShellMotionControl, type ShellMotionControlProps } from './ShellMotionControl';
export { ShellBackToTop, type ShellBackToTopProps } from './ShellBackToTop';
export {
  shellBackdropStyle,
  shellColorValue,
  shellDesignTokenStyle,
  shellShapeDepthClass,
  shellTypographyStyle,
} from './shellVisualOptions';
export type {
  ShellDirection,
  ShellElementProps,
  ShellLogicalSide,
  ShellRegionPlacement,
  ShellRegionWidth,
  ShellSafeArea,
  ShellSeparator,
  ShellSpacing,
  ShellViewportTier,
  ShellVisibility,
} from './shellFoundation';
