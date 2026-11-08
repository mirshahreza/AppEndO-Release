/**
 * Wipe existing Idea Foundry rows and insert a mixed sample board.
 *
 * Usage:
 *   npx tsx scripts/seed-idea-foundry.ts
 */
import { seedProductIdeasSampleBoard } from '../src/server/domain/idea-foundry/ideaFoundrySeed';
import { closeControlPlaneSequelize } from '../src/server/db/controlPlaneSequelize';

const main = async () => {
  const result = await seedProductIdeasSampleBoard();
  console.log(`Idea Foundry sample board: wiped previous rows, seeded ${result.count} ideas.`);
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeControlPlaneSequelize();
  });
