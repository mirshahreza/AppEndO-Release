export type AccessibleApiRouteItem = {
  id: string;
  name: string;
  folder: string;
  method: string;
  path: string;
  testPayload: string;
  engineType: 'SANDBOX_JS' | 'DATA_API';
  isBuiltIn: boolean;
};

export type AccessibleApiRoutesResponse = {
  success: boolean;
  items: AccessibleApiRouteItem[];
  count: number;
  error?: string;
};
