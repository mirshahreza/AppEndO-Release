import type { ServerFunctionEngineType } from './types';

export const isDataApiEngine = (engineType?: ServerFunctionEngineType | null): boolean => (
  engineType === 'DATA_API'
);

export const isDataApiManagedFunction = (activeFn: {
  engineType?: ServerFunctionEngineType | null;
  metadataJson?: Record<string, unknown> | null;
}): boolean => (
  isDataApiEngine(activeFn.engineType) || activeFn.metadataJson?.origin === 'data-api'
);
