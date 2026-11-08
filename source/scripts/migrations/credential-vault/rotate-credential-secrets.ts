/**
 * One-shot operator rotation for credential-vault secrets after a master-key bump.
 *
 * Decrypts blobs still on the previous keyVersion and re-encrypts them with
 * the current APPENDO_CREDENTIAL_MASTER_KEY. Walks:
 *   1. base_credential_vault_secrets
 *   2. default data-source passwordCipher in settings.json
 *   3. Workflow encryptedValueJson (same blob / keyVersion; Prisma model unchanged)
 *
 * Operator steps:
 *   1. Backup settings.json and the control-plane database.
 *   2. APPENDO_CREDENTIAL_MASTER_KEY_PREVIOUS=<current>
 *      APPENDO_CREDENTIAL_MASTER_KEY=<new>
 *      APPENDO_CREDENTIAL_KEY_VERSION=<n+1>
 *   3. Restart so both keys are loaded.
 *   4. npx tsx scripts/migrations/credential-vault/rotate-credential-secrets.ts
 *   5. If every walker reports failed=0, unset PREVIOUS.
 *   6. Do not bump KEY_VERSION again before rotate finishes.
 *
 * Not wired to setup, boot, or cron. Requires the control-plane database.
 * Leftover plaintext / pre-vault blobs still need the matching migrate-*.ts
 * scripts first — this walker only re-encrypts shared-vault blobs.
 */
import { SETTINGS_PATH } from '../../../src/server/config/settingsFile';
import { rotateDefaultDataSourcePasswordCipher } from '../../../src/server/config/dataSourceSecrets';
import { applySecuritySettingsFromPlatformCache } from '../../../src/server/db/securitySettingsStore';
import {
  closePrismaControlPlane,
  initPrismaControlPlane,
} from '../../../src/server/db/prismaControlPlane';
import { closeControlPlaneSequelize } from '../../../src/server/db/controlPlaneSequelize';
import { ensureCredentialVaultTable } from '../../../src/server/domain/security/credentialVault/credentialVaultSequelizeModel';
import { rotateDbVaultSecrets } from '../../../src/server/domain/security/credentialVault/credentialVault';
import { rotateWorkflowSecretBlobs } from '../../../src/server/domain/workflow/workflowSecretReferenceRepository';

type WalkerResult = { migrated: number; failed: string[] };

const printResult = (label: string, result: WalkerResult): void => {
  const failed = result.failed.length;
  console.log(
    `[credential-vault] rotate ${label}: migrated=${result.migrated} failed=${failed}`,
  );
  for (const item of result.failed) {
    console.error(`[credential-vault] rotate ${label} failed: ${item}`);
  }
};

const main = async (): Promise<void> => {
  try {
    applySecuritySettingsFromPlatformCache(SETTINGS_PATH);
  } catch {
    // JWT-derived vault key still works from getAuthSecrets() defaults.
  }

  await initPrismaControlPlane(SETTINGS_PATH);
  await ensureCredentialVaultTable();

  const vault = await rotateDbVaultSecrets();
  printResult('vault', vault);

  const passwordCipher = rotateDefaultDataSourcePasswordCipher(SETTINGS_PATH);
  printResult('passwordCipher', passwordCipher);

  const workflow = await rotateWorkflowSecretBlobs();
  printResult('workflow', workflow);

  await closePrismaControlPlane();
  await closeControlPlaneSequelize();

  if (vault.failed.length > 0 || passwordCipher.failed.length > 0 || workflow.failed.length > 0) {
    process.exitCode = 1;
  }
};

void main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[credential-vault] rotate-credential-secrets failed: ${message}`);
  try {
    await closePrismaControlPlane();
    await closeControlPlaneSequelize();
  } catch {
    // ignore shutdown errors
  }
  process.exitCode = 1;
});
