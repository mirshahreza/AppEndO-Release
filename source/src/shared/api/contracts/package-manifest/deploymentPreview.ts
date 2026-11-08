import type { ExtensionUiRoutesPreview } from './extensionUiRoutes';
import type { VerticalAppDeploymentPreview } from './verticalApp';

export function isVerticalAppDeploymentPreview(value: unknown): value is VerticalAppDeploymentPreview {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (value as VerticalAppDeploymentPreview).schema === 'package-deployment-preview';
}

export function isExtensionUiRoutesPreview(value: unknown): value is ExtensionUiRoutesPreview {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (value as ExtensionUiRoutesPreview).schema === 'package-ui-routes-preview';
}

export type PluginRegistryProposalPreview =
  | VerticalAppDeploymentPreview
  | ExtensionUiRoutesPreview;
