/**
 * Canonical upgrade for non-Prisma control-plane schema (Sequelize features + optional Hawiety).
 *
 *   npm run schema:install-extensions
 *   npm run schema:install-extensions -- --hwy
 *   npm run schema:install-extensions -- --force
 *   npm run schema:install-extensions -- --push-prisma
 */
import { installControlPlaneExtensionSchema } from '../../src/server/db/installControlPlaneExtensionSchema';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';

const args = new Set(process.argv.slice(2).filter((a) => a !== '--'));

const hwy = args.has('--hwy');
const force = args.has('--force');
const pushPrisma = args.has('--push-prisma');

const main = async (): Promise<void> => {
  const { steps } = await installControlPlaneExtensionSchema({ hwy, force, pushPrisma });
  console.log('[schema:install-extensions] Done.');
  for (const step of steps) {
    console.log(`  ${step.layerId}: ${step.detail}`);
  }
};

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[schema:install-extensions] failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
