/**
 * Insert sample voting scopes with questions (ballots) and participant choices.
 *
 *   npm run voting:seed-sample
 *   npm run voting:seed-sample -- --rollback
 */
import sql from 'mssql';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { readControlPlaneDatabaseSettings } from '../../src/server/db/controlPlaneDatabase';
import { buildMssqlConfigFromControlPlaneUrl } from '../../src/server/db/mssqlControlPlaneConfig';
import {
  ensureControlPlaneInitialized,
  resetControlPlaneInitState,
} from '../../src/server/db/controlPlaneInit';
import { closePrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { resolveVotingIds } from './votingIds';

const SAMPLE_SCOPE_TITLE = 'QA — Demo poll (questions + choices)';

const isRollback = process.argv.includes('--rollback');

const resolveStatusId = async (
  categoryId: string,
  shortName: 'draft' | 'open' | 'closed',
): Promise<string> => {
  const { prisma } = await import('../../src/server/domain/users/prismaHelpers');
  const row = await prisma().baseInfo.findFirst({
    where: { parentId: categoryId, shortName },
    select: { id: true },
  });
  if (!row) {
    throw new Error(`Voting seed: status "${shortName}" missing under Voting statuses. Run voting:phase1.`);
  }
  return row.id;
};

type BallotSeed = {
  title: string;
  selectionMode: 'single' | 'multiple';
  maxSelections: number | null;
  sortOrder: number;
  choices: Array<{ displayName: string; sortOrder: number }>;
};

const DEMO_BALLOTS: BallotSeed[] = [
  {
    title: 'Who should chair the coordination committee?',
    selectionMode: 'single',
    maxSelections: null,
    sortOrder: 10,
    choices: [
      { displayName: 'Dr. Sara Ahmadi', sortOrder: 1 },
      { displayName: 'Eng. Reza Karimi', sortOrder: 2 },
      { displayName: 'Ms. Narges Hosseini', sortOrder: 3 },
    ],
  },
  {
    title: 'Which working groups should receive extra budget? (pick up to 2)',
    selectionMode: 'multiple',
    maxSelections: 2,
    sortOrder: 20,
    choices: [
      { displayName: 'Field outreach', sortOrder: 1 },
      { displayName: 'Training & onboarding', sortOrder: 2 },
      { displayName: 'Digital voting infrastructure', sortOrder: 3 },
      { displayName: 'Observer program', sortOrder: 4 },
    ],
  },
];

const install = async (): Promise<void> => {
  resetControlPlaneInitState();
  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false });
  const ids = await resolveVotingIds();
  const draftId = await resolveStatusId(ids.categoryIds['Voting statuses'], 'draft');

  const settings = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  const pool = await sql.connect(buildMssqlConfigFromControlPlaneUrl(settings.url));
  try {
    const existing = await pool.request()
      .input('title', sql.NVarChar, SAMPLE_SCOPE_TITLE)
      .query<{ id: number }>(`SELECT id FROM dbo.vote_votings WHERE title = @title`);

    let votingId = existing.recordset[0]?.id;
    if (votingId) {
      console.log(`  scope exists (#${votingId}), skipping insert`);
    } else {
      const inserted = await pool.request()
        .input('title', sql.NVarChar, SAMPLE_SCOPE_TITLE)
        .input('statusCode', sql.NVarChar, draftId)
        .input('note', sql.NVarChar, 'Seeded demo poll with ballots + participant choices.')
        .query<{ id: number }>(`
          INSERT INTO dbo.vote_votings (title, status_code, operator_note)
          OUTPUT INSERTED.id
          VALUES (@title, @statusCode, @note)
        `);
      votingId = inserted.recordset[0]?.id;
      if (!votingId) throw new Error('Voting seed: insert vote_votings failed.');
      console.log(`  inserted scope #${votingId}: ${SAMPLE_SCOPE_TITLE}`);
    }

    for (const ballot of DEMO_BALLOTS) {
      const ballotRow = await pool.request()
        .input('votingId', sql.BigInt, votingId)
        .input('title', sql.NVarChar, ballot.title)
        .query<{ id: number }>(`
          SELECT id FROM dbo.vote_ballots WHERE voting_id = @votingId AND title = @title
        `);

      let ballotId = ballotRow.recordset[0]?.id;
      if (!ballotId) {
        const ins = await pool.request()
          .input('votingId', sql.BigInt, votingId)
          .input('title', sql.NVarChar, ballot.title)
          .input('selectionMode', sql.NVarChar, ballot.selectionMode)
          .input('maxSel', sql.Int, ballot.maxSelections)
          .input('sortOrder', sql.Int, ballot.sortOrder)
          .query<{ id: number }>(`
            INSERT INTO dbo.vote_ballots (voting_id, title, selection_mode, max_selections, sort_order)
            OUTPUT INSERTED.id
            VALUES (@votingId, @title, @selectionMode, @maxSel, @sortOrder)
          `);
        ballotId = ins.recordset[0]?.id;
        console.log(`  ballot #${ballotId}: ${ballot.title}`);
      } else {
        console.log(`  ballot exists (#${ballotId})`);
      }

      for (const choice of ballot.choices) {
        const choiceRow = await pool.request()
          .input('ballotId', sql.BigInt, ballotId)
          .input('name', sql.NVarChar, choice.displayName)
          .query(`SELECT id FROM dbo.vote_candidates WHERE ballot_id = @ballotId AND display_name = @name`);
        if (choiceRow.recordset.length > 0) {
          continue;
        }
        await pool.request()
          .input('votingId', sql.BigInt, votingId)
          .input('ballotId', sql.BigInt, ballotId)
          .input('displayName', sql.NVarChar, choice.displayName)
          .input('sortOrder', sql.Int, choice.sortOrder)
          .query(`
            INSERT INTO dbo.vote_candidates (voting_id, ballot_id, display_name, sort_order)
            VALUES (@votingId, @ballotId, @displayName, @sortOrder)
          `);
        console.log(`    choice: ${choice.displayName}`);
      }
    }

    const stationTitle = 'QA — Demo central polling station';
    const stationRow = await pool.request()
      .input('votingId', sql.BigInt, votingId)
      .input('title', sql.NVarChar, stationTitle)
      .query<{ id: number }>(`
        SELECT id FROM dbo.vote_polling_stations WHERE voting_id = @votingId AND title = @title
      `);
    if (!stationRow.recordset[0]?.id) {
      await pool.request()
        .input('votingId', sql.BigInt, votingId)
        .input('title', sql.NVarChar, stationTitle)
        .query(`
          INSERT INTO dbo.vote_polling_stations (voting_id, title, is_active, operator_note)
          VALUES (@votingId, @title, 1, N'Seeded for polling-stations smoke.')
        `);
      console.log(`  polling station: ${stationTitle}`);
    }
  } finally {
    await pool.close();
  }

  console.log('[Voting seed] Done. Open editor: /{culture}/studio/voting/votings/edit/{id}');
};

const rollback = async (): Promise<void> => {
  const settings = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  const pool = await sql.connect(buildMssqlConfigFromControlPlaneUrl(settings.url));
  try {
    await pool.request()
      .input('title', sql.NVarChar, SAMPLE_SCOPE_TITLE)
      .query(`
        DELETE FROM dbo.vote_votings WHERE title = @title
      `);
    console.log('[Voting seed rollback] removed demo scope (cascades ballots + choices).');
  } finally {
    await pool.close();
  }
};

const main = async () => {
  if (isRollback) {
    await rollback();
    return;
  }
  await install();
};

main()
  .catch((error) => {
    console.error('[Voting seed]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePrismaControlPlane().catch(() => undefined);
  });
