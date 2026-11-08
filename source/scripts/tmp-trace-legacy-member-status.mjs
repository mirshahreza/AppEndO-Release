import sql from 'mssql';
import { readLegacyConn, withLegacyReadOnlyIntent } from './hwy-etl/legacyConn.ts';

const id = Number(process.argv[2] || 1887111);
const pool = await new sql.ConnectionPool(withLegacyReadOnlyIntent(readLegacyConn())).connect();
const req = pool.request();
req.input('id', sql.BigInt, id);
const member = await req.query(`
  SELECT TOP 1
    m.Id,
    m.MembershipStatus_Note,
    m.MembershipStatus_ChangeReasonId,
    cr.Title AS ChangeReasonTitle,
    m.MembershipStatus_UpdatedOn
  FROM dbo.HWY_Members m WITH (NOLOCK)
  LEFT JOIN dbo.HWY_BaseInformation cr WITH (NOLOCK) ON cr.Id = m.MembershipStatus_ChangeReasonId
  WHERE m.Id = @id
`);
console.log('MEMBER', JSON.stringify(member.recordset[0], null, 2));
const notes = await req.query(`
  SELECT TOP 5 Note, NoteSubject, CreatedOn
  FROM dbo.HWY_Members_Notes WITH (NOLOCK)
  WHERE MemberId = @id
  ORDER BY CreatedOn DESC
`);
console.log('LEGACY NOTES', notes.recordset.length);
for (const n of notes.recordset) {
  console.log('---', n.NoteSubject, n.CreatedOn);
  console.log(String(n.Note ?? '').slice(0, 300));
}
await pool.close();
