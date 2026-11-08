import type { ExtensionUiRoutesPreviewRoute } from './extensionUiRoutes';
import type {
  VerticalAppDeploymentBlueprint,
  VerticalAppDesignerLayoutCapability,
  VerticalAppPageCapability,
  VerticalAppShellCapability,
} from './verticalApp';

export type PackageDeploymentAppliedBase = {
  schema: 'package-deployment-applied';
  schemaVersion: '1.0.0';
  packageId: string;
  version: string;
  appliedAt: string;
};

export type VerticalAppDeploymentApplied = PackageDeploymentAppliedBase & {
  kind: 'vertical-app';
  deployment: VerticalAppDeploymentBlueprint;
  capabilities: {
    shell: VerticalAppShellCapability;
    pages?: VerticalAppPageCapability[];
    designer_layouts?: VerticalAppDesignerLayoutCapability[];
  };
  /** True when the mount row is contributed by this deployment (not pre-existing core mount). */
  includeMount: boolean;
};

export type ExtensionUiRoutesDeploymentApplied = PackageDeploymentAppliedBase & {
  kind: 'extension-ui-routes';
  routes: ExtensionUiRoutesPreviewRoute[];
};

export type PackageDeploymentApplied =
  | VerticalAppDeploymentApplied
  | ExtensionUiRoutesDeploymentApplied;

export function isPackageDeploymentApplied(value: unknown): value is PackageDeploymentApplied {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (value as PackageDeploymentApplied).schema === 'package-deployment-applied';
}

export function isVerticalAppDeploymentApplied(
  value: PackageDeploymentApplied,
): value is VerticalAppDeploymentApplied {
  return value.kind === 'vertical-app';
}

export function isExtensionUiRoutesDeploymentApplied(
  value: PackageDeploymentApplied,
): value is ExtensionUiRoutesDeploymentApplied {
  return value.kind === 'extension-ui-routes';
}
