export type UnusedServerFunctionEntry = {
  id: string;
  name: string;
  path: string;
  lastHitAt: string | null;
};

export type UnusedServerFunctionsReport = {
  functions: UnusedServerFunctionEntry[];
};
