import { apiPut } from '../api/client';
import type { GridColumnLayoutState } from './appTableGridColumnLayout';
import { isValidGridId } from './userGridColumnLayouts';

export const persistUserGridColumnLayout = async (
  gridId: string,
  layout: GridColumnLayoutState,
): Promise<boolean> => {
  if (!isValidGridId(gridId)) {
    return false;
  }

  try {
    const { data, response } = await apiPut<{ success?: boolean; saved?: boolean }>(
      '/api/profile/me/grid-column-layouts',
      { gridId: gridId.trim(), layout },
    );
    return response.ok && Boolean(data.success) && Boolean(data.saved);
  } catch {
    return false;
  }
};
