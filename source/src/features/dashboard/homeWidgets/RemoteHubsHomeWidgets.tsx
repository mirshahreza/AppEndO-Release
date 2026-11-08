import React from 'react';
import { FolderOpen, Monitor, Terminal } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { useFileHubConnectionsQuery } from '../../../shared/api/queries/file-hub';
import { useRdpHubConnectionsQuery } from '../../../shared/api/queries/rdp-hub';
import { useSshHubConnectionsQuery } from '../../../shared/api/queries/ssh-hub';
import type { CoreHomeWidgetProps } from '../components/homeWidgetResolvers';
import { DashboardFitAction } from '../components/DashboardFitAction';
import { DashboardWidgetShell } from '../components/DashboardWidgetShell';
import {
  DASHBOARD_BODY_PAD_STRIP_CLASS,
  DASHBOARD_CAPTION_ACTION_GLYPH_CLASS,
  dashboardFitCaptionGridClass,
} from '../dashboardDensity';
import { useDashboardWidgetFit } from '../components/DashboardWidgetFitContext';
import { HomeWidgetOpenLink } from './useHomeWidgetDeepLink';
import { useRemoteHubConnectionHomePath } from './useRemoteHubHomeLink';
import type { RemoteHubPageKey } from '../../../shared/routing/remoteHubDeepLink';

export const REMOTE_HUB_HOME_WIDGET_MAX_CONNECTIONS = 5;

type ConnectionRow = {
  id: string;
  key: string;
  name: string;
  host: string;
  port: number;
};

function formatConnectionCaption(row: ConnectionRow): string {
  return `${row.host}:${row.port}`;
}

type RemoteHubConnectionsHomeWidgetProps = CoreHomeWidgetProps & {
  pageKey: RemoteHubPageKey;
  connections: ConnectionRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  icon: React.ReactNode;
  hintTone: 'emerald' | 'cyan' | 'sky';
};

const RemoteHubConnectionTile: React.FC<{
  pageKey: RemoteHubPageKey;
  connection: ConnectionRow;
  icon: React.ReactNode;
  hintTone: 'emerald' | 'cyan' | 'sky';
}> = ({ pageKey, connection, icon, hintTone }) => {
  const path = useRemoteHubConnectionHomePath(pageKey, connection.key);
  if (!path) {
    return null;
  }
  return (
    <DashboardFitAction
      layout="caption"
      iconOnly
      icon={icon}
      label={connection.name}
      caption={formatConnectionCaption(connection)}
      hintTone={hintTone}
      to={path}
    />
  );
};

const RemoteHubConnectionsHomeWidget: React.FC<RemoteHubConnectionsHomeWidgetProps> = ({
  entry,
  headerIcon,
  pageKey,
  connections,
  isLoading,
  isError,
  icon,
  hintTone,
}) => {
  const t = useCultureT();
  const fit = useDashboardWidgetFit();
  const rows = (connections ?? [])
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, REMOTE_HUB_HOME_WIDGET_MAX_CONNECTIONS);
  const gridClass = rows.length <= 3
    ? 'grid grid-cols-3 gap-1'
    : dashboardFitCaptionGridClass(Math.min(6, Math.max(3, fit.iconColumns)) as 3 | 4 | 5 | 6);

  return (
    <DashboardWidgetShell
      title={t(entry.catalog.labelKey)}
      subtitle={t(entry.catalog.descriptionKey)}
      headerIcon={headerIcon}
      titleExtra={!isLoading && !isError ? (
        <span className="text-sm font-semibold tabular-nums text-slate-600">{connections?.length ?? 0}</span>
      ) : null}
      headerExtra={(
        <HomeWidgetOpenLink deepLink={entry.deepLink} className="text-xs font-semibold text-primary-700 hover:text-primary-800" />
      )}
      bodyClassName={DASHBOARD_BODY_PAD_STRIP_CLASS}
    >
      {isLoading ? (
        <p className="px-3 py-2 text-sm text-slate-500">{t('homeWidget.remoteHubs.loading')}</p>
      ) : isError ? (
        <p className="px-3 py-2 text-sm text-slate-500">{t('homeWidget.remoteHubs.unavailable')}</p>
      ) : rows.length === 0 ? (
        <p className="px-3 py-2 text-sm text-slate-500">{t('homeWidget.remoteHubs.empty')}</p>
      ) : (
        <div className={gridClass}>
          {rows.map((connection) => (
            <RemoteHubConnectionTile
              key={connection.id}
              pageKey={pageKey}
              connection={connection}
              icon={icon}
              hintTone={hintTone}
            />
          ))}
        </div>
      )}
    </DashboardWidgetShell>
  );
};

export const SshHubHomeWidget: React.FC<CoreHomeWidgetProps> = (props) => {
  const query = useSshHubConnectionsQuery();
  return (
    <RemoteHubConnectionsHomeWidget
      {...props}
      pageKey="ssh-hub"
      connections={query.data}
      isLoading={query.isLoading}
      isError={query.isError}
      icon={<Terminal className={DASHBOARD_CAPTION_ACTION_GLYPH_CLASS} />}
      hintTone="emerald"
    />
  );
};

export const FileHubHomeWidget: React.FC<CoreHomeWidgetProps> = (props) => {
  const query = useFileHubConnectionsQuery();
  return (
    <RemoteHubConnectionsHomeWidget
      {...props}
      pageKey="file-hub"
      connections={query.data}
      isLoading={query.isLoading}
      isError={query.isError}
      icon={<FolderOpen className={DASHBOARD_CAPTION_ACTION_GLYPH_CLASS} />}
      hintTone="cyan"
    />
  );
};

export const RdpHubHomeWidget: React.FC<CoreHomeWidgetProps> = (props) => {
  const query = useRdpHubConnectionsQuery();
  return (
    <RemoteHubConnectionsHomeWidget
      {...props}
      pageKey="rdp-hub"
      connections={query.data}
      isLoading={query.isLoading}
      isError={query.isError}
      icon={<Monitor className={DASHBOARD_CAPTION_ACTION_GLYPH_CLASS} />}
      hintTone="sky"
    />
  );
};
