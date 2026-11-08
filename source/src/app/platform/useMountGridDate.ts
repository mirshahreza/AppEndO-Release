import { useCallback } from 'react';
import type { MountExperienceCalendar } from '../../shared/api/contracts/platform/types';
import { formatGridDateForCalendar, normalizeGridDateInput } from '../../shared/lib/gridDateFormat';
import { resolveMountCalendar } from './platformConfigHelpers';
import { useOptionalPlatformMount } from './PlatformMountContext';

export function useMountCalendar(): MountExperienceCalendar {
  const mount = useOptionalPlatformMount();
  return mount ? resolveMountCalendar(mount) : 'gregorian';
}

export function useMountGridDateFormat(): (value?: string | null) => string {
  const calendar = useMountCalendar();
  return useCallback((value?: string | null) => {
    const normalized = normalizeGridDateInput(value);
    return formatGridDateForCalendar(normalized, calendar);
  }, [calendar]);
}
