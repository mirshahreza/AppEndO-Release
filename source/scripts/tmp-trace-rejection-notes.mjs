import { QueryTypes } from 'sequelize';
import { SETTINGS_PATH } from '../src/server/config/settingsFile.ts';
import { ensureControlPlaneInitialized } from '../src/server/db/controlPlaneInit.ts';
import { getControlPlaneSequelize } from '../src/server/db/controlPlaneSequelize.ts';
import { attachHwyMemberRejectionListParityFields } from '../src/server/domain/hwy/hwyMemberRejectionListParity.service.ts';
import { splitHwyMembershipDecisionNoteBody } from '../src/domain/hwy/hwyMembershipDecisionNoteBody.ts';

const codes = process.argv.slice(2);
if (!codes.length) {
  codes.push('1887111', '1900095');
}

await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false, seedSampleData: false });
const seq = getControlPlaneSequelize();

for (const code of codes) {
  const members = await seq.query(
    `SELECT TOP 1 CAST(id AS VARCHAR(32)) AS id
     FROM dbo.hwy_members
     WHERE CAST(id AS VARCHAR(32)) = :code OR id = TRY_CAST(:code AS BIGINT)`,
    { replacements: { code }, type: QueryTypes.SELECT },
  );
  const m = members[0];
  if (!m?.id) {
    console.log('NO MEMBER', code);
    continue;
  }
  const notes = await seq.query(
    `SELECT TOP 12 CAST(body AS NVARCHAR(MAX)) AS body, subj.short_name AS subject, n.created_at
     FROM dbo.hwy_member_notes n
     LEFT JOIN dbo.base_info subj ON subj.id = n.subject_code
     WHERE n.member_id = :id
     ORDER BY n.created_at DESC`,
    { replacements: { id: m.id }, type: QueryTypes.SELECT },
  );
  const row = { id: m.id };
  await attachHwyMemberRejectionListParityFields(seq, [row], 'HWY_Members_List_Waited_1_Rejected');
  console.log('===', code, 'member', m.id, '===');
  console.log('notes count', notes.length);
  for (const n of notes) {
    const body = String(n.body ?? '');
    const p = splitHwyMembershipDecisionNoteBody(body);
    console.log('---', n.subject, n.created_at);
    console.log('raw:', body.slice(0, 200).replace(/\s+/g, ' '));
    console.log('parsed reason:', p.reasonTitle?.slice(0, 80), 'noteLen:', p.note.length);
  }
  const memberRow = await seq.query(
    `SELECT CAST(note AS NVARCHAR(MAX)) AS note, membership_status_updated_on,
            membership_status_code, membership_status_updated_by
     FROM dbo.hwy_members WHERE id = :id`,
    { replacements: { id: m.id }, type: QueryTypes.SELECT },
  );
  console.log('MEMBER', JSON.stringify(memberRow[0], null, 2));
  console.log('PARITY', JSON.stringify({
    reason: row.membershipStatusDecisionReasonTitle,
    note: row.membershipStatusDecisionNote,
    prev: row.membershipStatusDecisionPreviousNote,
    cc: row.membershipStatusNoteByCallCenter,
    latest: row.membershipLatestNote,
    badge: row.membershipStatusReturnedFromRegionBadge,
  }, null, 2));
}
