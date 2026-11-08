import { useCallback, useMemo } from 'react';
import { useWorkspaceOverlayDeepLink } from '../../../shared/routing/useWorkspaceOverlayDeepLink';
import {
  buildDataStudioModelerColumnOverlayToken,
  parseDataStudioModelerColumnOverlayToken,
} from '../lib/dataStudioModelerOverlay';

type Args = {
  enabled: boolean;
  selectedColumnName: string | null;
  setSelectedColumnName: (name: string | null) => void;
  columnNames: string[];
};

export function useDataStudioModelerColumnOverlayDeepLink(args: Args): void {
  const activeToken = useMemo(
    () => (
      args.selectedColumnName
        ? buildDataStudioModelerColumnOverlayToken(args.selectedColumnName)
        : null
    ),
    [args.selectedColumnName],
  );

  const openFromUrl = useCallback((token: string) => {
    const columnName = parseDataStudioModelerColumnOverlayToken(token);
    if (columnName && args.columnNames.includes(columnName)) {
      args.setSelectedColumnName(columnName);
    }
  }, [args]);

  useWorkspaceOverlayDeepLink({ enabled: args.enabled, activeToken, openFromUrl });
}
