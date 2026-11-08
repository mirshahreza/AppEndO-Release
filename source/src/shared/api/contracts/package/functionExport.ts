export type PackageFunctionExportKind = 'extension';

export type PackageFunctionExportRequest = {
  functionIds: string[];
  packageId: string;
  kind?: PackageFunctionExportKind;
  name?: string;
  version?: string;
  description?: string;
  createdBy?: string;
  requiredAppVersion?: string;
};

export type PackageFunctionExportPreview = {
  packageId: string;
  version: string;
  functionCount: number;
  apis: Array<{
    id: string;
    method: string;
    path: string;
    entry: string;
    metaEntry: string;
    auth: 'public' | 'authenticated' | 'admin';
  }>;
  warnings: string[];
};
