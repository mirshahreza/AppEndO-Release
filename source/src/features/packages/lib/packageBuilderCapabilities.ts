export type PackageBuilderCapabilityCounts = {
  apiCount: number;
  componentCount: number;
  portalCount: number;
  shellCount: number;
  navigationCount: number;
  workflowCount: number;
  edgeModelCount: number;
  edgeApiCount: number;
  manualFileCount: number;
  installSql: string;
  optionalInstallSql?: string;
};

export function hasPackageCapabilities(input: PackageBuilderCapabilityCounts): boolean {
  return input.apiCount > 0
    || input.componentCount > 0
    || input.portalCount > 0
    || input.shellCount > 0
    || input.navigationCount > 0
    || input.workflowCount > 0
    || input.edgeModelCount > 0
    || input.edgeApiCount > 0
    || input.manualFileCount > 0
    || input.installSql.trim().length > 0
    || Boolean(input.optionalInstallSql?.trim());
}
