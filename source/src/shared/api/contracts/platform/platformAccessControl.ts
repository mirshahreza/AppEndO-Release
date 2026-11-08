import type { FunctionAccessControl } from '../server-functions/accessControl';
import {
  PUBLIC_FUNCTION_ACCESS_CONTROL,
  parseFunctionAccessControl,
} from '../server-functions/accessControl';
import type { PlatformRouteBindingAuth } from './types';

export const parsePlatformRouteBindingAuth = (
  value: PlatformRouteBindingAuth | null | undefined,
): FunctionAccessControl => {
  if (value == null) {
    return PUBLIC_FUNCTION_ACCESS_CONTROL;
  }

  return parseFunctionAccessControl(value);
};

export const platformAuthFromAccessControl = (
  accessControl: FunctionAccessControl,
): PlatformRouteBindingAuth | null => {
  const parsed = parseFunctionAccessControl(accessControl);
  if (parsed.accessMode === 'public') {
    return null;
  }

  return parsed;
};
