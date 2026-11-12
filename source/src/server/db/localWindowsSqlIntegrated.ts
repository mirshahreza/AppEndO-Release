import { isLikelyLocalSqlHost } from '../../core/database/sqlServerLocalInstancePort';

/** Force Windows integrated auth for local SQL Server (release/pack when sa password drifts). */
export const isLocalWindowsSqlIntegratedEnabled = (server: string): boolean =>
  process.env.APPENDO_WINDOWS_SQL_TRUSTED === '1'
  && process.platform === 'win32'
  && isLikelyLocalSqlHost(server);

export const useWindowsIntegratedSqlForServer = (server: string, password: string): boolean => {
  if (isLocalWindowsSqlIntegratedEnabled(server)) {
    return true;
  }
  return (
    process.env.APPENDO_CLONE_WINDOWS_SQL_TRUSTED === '1'
    && process.platform === 'win32'
    && isLikelyLocalSqlHost(server)
    && !String(password ?? '').trim()
  );
};
