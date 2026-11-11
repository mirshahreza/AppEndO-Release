<div dir="rtl" lang="fa" class="hwy-parity-doc">
<style>
  .hwy-parity-doc { text-align: right; unicode-bidi: plaintext; }
  .hwy-parity-doc table { direction: rtl; text-align: right; width: 100%; border-collapse: collapse; margin: 0.75rem 0; }
  .hwy-parity-doc th, .hwy-parity-doc td { border: 1px solid #c4c4c4; padding: 0.35rem 0.5rem; vertical-align: top; text-align: right; }
  .hwy-parity-doc th { background: #f6f6f6; font-weight: 600; }
  .hwy-parity-doc code { direction: ltr; text-align: left; unicode-bidi: embed; }
  .hwy-parity-doc pre, .hwy-parity-doc code { direction: ltr; text-align: left; unicode-bidi: embed; }
</style>

<p><strong>خلاصه برای operatore:</strong> فهرست خودکار RPCهای انتخابات legacy — برای فازبندی build پکیج <code dir="ltr">voting</code>. تولید: ۲۰۲۶-۱۱-۰۹.</p>

# Voting — legacy RPC inventory

> منبع: <code dir="ltr">C:\Workspace\Projects\HawietySite\HawietySite\workspace\controllers\Elections_*.cs</code> و <code dir="ltr">HWY_Vote*.cs</code>

## نماد فاز هدف

<table dir="rtl">
<thead><tr><th>فاز</th><th>معنی</th></tr></thead>
<tbody>
<tr><td><strong>۳b</strong></td><td>دوره / مدیریت</td></tr>
<tr><td><strong>۳c</strong></td><td>مرتكزین / invited / reports</td></tr>
<tr><td><strong>۳d</strong></td><td>صندوق · رأی‌دهنده · مراقب · اعلان</td></tr>
<tr><td><strong>۳e</strong></td><td>رأی داخلی VoteQuestions</td></tr>
<tr><td><strong>ETL</strong></td><td>فقط migration داده</td></tr>
<tr><td><strong>⏸</strong></td><td>موکول / حذف scope</td></tr>
</tbody></table>

## Elections_Cars (حمل‌ونقل / صندوق — ۳d + ETL)

<table dir="rtl">
<thead><tr><th>متد</th><th>فاز</th></tr></thead>
<tbody>
<tr><td>Create, Read, Delete, Update_ByContext, Update_Status</td><td>۳d</td></tr>
<tr><td>SetDriverApproved/Rejected, SetPassengerApproved/Rejected</td><td>۳d</td></tr>
<tr><td>AssignPassengerToCar, GetPassengersByContext</td><td>۳d</td></tr>
<tr><td>SetTripStarted/Finished/Rejected, RemoveTrip</td><td>۳d</td></tr>
<tr><td>RegisterCarRequest, RegisterNakhebIdByDriver</td><td>۳d · ETL</td></tr>
<tr><td>PerformanceByDriver, MasoolinByCenters</td><td>⏸ گزارش</td></tr>
</tbody></table>

## Elections_InvitedVoters (هسته operatore — ۳c)

<table dir="rtl">
<thead><tr><th>متد</th><th>فاز</th></tr></thead>
<tbody>
<tr><td>Read_List, Read_One, Read_ByContext, Update, Approve, Reject</td><td>۳c</td></tr>
<tr><td>JoinToNakheb, JoinToFamily, JoinToEghtera, ClearJoinToNakhebin</td><td>۳c · قرارداد با hawiety</td></tr>
<tr><td>Read_Report_* (Creators, Rafedin, …)</td><td>⏸ → گزارشات پلتفرم</td></tr>
<tr><td>Read_Marfoozeh*, Read_Waited_1</td><td>۳c</td></tr>
</tbody></table>

## Elections_Candidates · Internal · Voters · Moragheb · Notifications

<table dir="rtl">
<thead><tr><th>کنترلر</th><th>متدها</th><th>فاز</th></tr></thead>
<tbody>
<tr><td>Candidates</td><td>Read, Read_Management, Read_ListPublic</td><td>۳c</td></tr>
<tr><td>Internal_Candidates</td><td>RegisterVoter, SaveMemberVote, RemoveVotesFor</td><td>۳e</td></tr>
<tr><td>Voters</td><td>CreateBySelf, IsCreated</td><td>۳d</td></tr>
<tr><td>Moragheb</td><td>Get_Statistics*, Save_Mahatteh*, Save_NakhebinVotes</td><td>۳d · ETL</td></tr>
<tr><td>Notifications</td><td>Read_ByContext*</td><td>۳d</td></tr>
<tr><td>HWY_VoteQuestions</td><td>Read_List, Update_Status, Update_Grades</td><td>۳e</td></tr>
<tr><td>HWY_VoteVotes</td><td>Vote_ByContext, RemoveVote</td><td>۳e</td></tr>
</tbody></table>

## HWY_Members (انتخابات — لینک به hawiety)

<table dir="rtl">
<thead><tr><th>متد</th><th>فاز</th></tr></thead>
<tbody>
<tr><td>JoinToEghtera, SetAddrEghtera, MortakezIsRepetitive, Update_Mortakez*</td><td>۳c · API voting + deep link از hawiety</td></tr>
<tr><td>Read_List_AlMoMortakezin_*</td><td>۳c · <code dir="ltr">voting-mortakezin-list</code></td></tr>
</tbody></table>

</div>
