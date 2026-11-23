/**
 * Production HTTP install gate.
 *
 * The unattended path is `npm run deploy:bootstrap` (CLI, no wizard).
 * Browser `/api/install` stays closed in production unless an operator
 * explicitly unlocks it on a trusted network.
 * `APPENDO_LOCAL_PROD_PUBLISH` remains the existing local prod-publish unlock.
 */

export const productionHttpInstallBlocked = (
  nodeEnv: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  if (nodeEnv !== 'production') return false;
  return env.APPENDO_ALLOW_HTTP_INSTALL !== '1' && env.APPENDO_LOCAL_PROD_PUBLISH !== '1';
};

export const PRODUCTION_HTTP_INSTALL_BLOCKED_MESSAGE =
  'HTTP install is disabled in production. Run npm run deploy:bootstrap from the deploy snapshot. Set APPENDO_ALLOW_HTTP_INSTALL=1 only to use the browser wizard on a trusted network.';
