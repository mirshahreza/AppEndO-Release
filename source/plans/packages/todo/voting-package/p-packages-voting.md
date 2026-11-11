<div dir="rtl" lang="fa" class="hwy-parity-doc">
<style>
  .hwy-parity-doc { text-align: right; unicode-bidi: plaintext; }
  .hwy-parity-doc h1, .hwy-parity-doc h2, .hwy-parity-doc h3, .hwy-parity-doc h4, .hwy-parity-doc p, .hwy-parity-doc li { text-align: right; }
  .hwy-parity-doc table { direction: rtl; text-align: right; width: 100%; border-collapse: collapse; margin: 0.75rem 0; }
  .hwy-parity-doc th, .hwy-parity-doc td { border: 1px solid #c4c4c4; padding: 0.35rem 0.5rem; vertical-align: top; text-align: right; }
  .hwy-parity-doc th { background: #f6f6f6; font-weight: 600; }
  .hwy-parity-doc blockquote { text-align: right; border-right: 3px solid #ccc; border-left: none; padding-right: 1rem; margin-right: 0; }
  .hwy-parity-doc ul, .hwy-parity-doc ol { padding-right: 1.25rem; padding-left: 0; }
  .hwy-parity-doc pre, .hwy-parity-doc code { direction: ltr; text-align: left; unicode-bidi: embed; }
</style>

<p><strong>خلاصه برای operatore:</strong> **ووتینگ/انتخابات** مثل **CMS** یک **پکیج vertical-app مستقل** می‌شود — نه کد داخل <code dir="ltr">hawiety</code>. بعد از ship، نصب هم‌زمان هویتی + voting و منوی <code dir="ltr">…/hawiety/elections/*</code> جایگزین سایت قدیم می‌شود. دادهٔ تاریخی فقط با **ETL**، نه seed نصب.</p>

# p-packages-voting — Voting &amp; Elections (هویتی + عمومی)

> **Package:** **Voting** (#118) — [p-packages-backlog.md](../p-packages-backlog.md)  
> **مسیر اجرا:** اسکوپ در <code dir="ltr">plans/packages/todo/voting-package/</code> — کنترل: [p-00-packages-index.md](../p-00-packages-index.md)  
> **وضعیت:** 🟡 **در حال ساخت روی dev** — فاز ۱–۲ ✅ · ۳a–۳c ✅ · ادیتور: سؤال + گزینه + **ایستگاه رأی** (شروع ۳d) · `voting:refresh-edge-models` + `voting:smoke` · `voting:pack` ✅ — بقیه ۳d (رأی‌دهنده · ناظر) · ۳e · فاز ۴ · ETL ⬜  
> **آخرین به‌روزرسانی:** 2026-11-10  
> **وابستگی نرم‌افزاری:** پلتفرم (auth · Record Policy · Geographic Divisions) · برای سناریوی هویتی: پکیج <strong>hawiety</strong> نصب‌شده  
> **استانداردها:** <code dir="ltr">AGENTS.md</code> · [package-ui.md](../../../docs/standards/package-ui.md) · [data-model.md](../../../docs/standards/data-model.md) · Greenfield · Sequelize control-plane  
> **Legacy مرجع:** <code dir="ltr">HawietySite/workspace/controllers/Elections_*.cs</code> · <a href="../hawiety-package/hwy-legacy-vs-appendo-feature-parity.md">parity §۱۳</a> · <a href="../hawiety-package/hwy-legacy-sp-write-gaps-decision-list.md">SP decision-list</a> (رده انتخابات)

AppEndO **platform-first** است نه voting-first: عضو، ناخب، نشانی انتخاباتی، و پرونده در **hawiety** می‌ماند؛ این پکیج فقط **چرخهٔ انتخابات** (دوره، صندوق، مرتكز/مرشح، دعوت، رأی، مراقب، اعلان) را مالکیت می‌کند. CMS محتوای اعلان را می‌دهد؛ درگاه پرداخت → Payment Gateways؛ نظرسنجی ساده → Engagement (#6) — **نه** این پکیج.

---

## دستورات ورود (مثل CMS)

```
@plans/packages/todo/voting-package برو جلو
@plans/packages/todo/voting-package فاز ۱ بساز
@plans/packages/todo/voting-package فاز ۲ بساز
@plans/packages/todo/voting-package زیر‌فاز 3a بساز
@plans/packages/todo/voting-package فاز ۴ بساز
@plans/packages/todo/voting-package فاز N را رولبک کن
```

پرامپت‌های آماده: [voting-phase-execution-prompts.md](./voting-phase-execution-prompts.md)

---

## هدف اصلی

**تعریف دورهٔ انتخاباتی → ثبت/دعوت رأی‌دهندگان و مرتكزین → اجرای رأی‌گیری → گزارش و بستن دوره** — با همان قابلیت‌های operatore که در legacy زیر <code dir="ltr">Elections_*</code> و لیست‌های <code dir="ltr">AlMoMortakezin</code> داشتند، ولی روی قرارداد پکیج AppEndO (نصب/حذف/ETL).

<table dir="rtl">
<thead><tr><th>دغدغه</th><th>مالک</th></tr></thead>
<tbody>
<tr><td>عضو · ناخب · پرونده · ImageFix</td><td>پکیج <strong>hawiety</strong></td></tr>
<tr><td>درخت جغرافیا (محافظه/دائرة/مكتب/اقتراع)</td><td><strong>Geographic Divisions</strong> + Base Info <code dir="ltr">100.5</code></td></tr>
<tr><td>کاربران · نقش‌ها · JWT</td><td>پلتفرم auth</td></tr>
<tr><td>محدودیت رکورد (Gender/Geo limits)</td><td>Record Policy + ماسک هویتی (بعداً هم‌تراز با <a href="../hawiety-package/hwy-record-level-access-legacy-vs-appendo.md">record-level gap doc</a>)</td></tr>
<tr><td>خبر/اعلان عمومی</td><td>CMS یا Portals</td></tr>
<tr><td>پرداخت مرتبط با انتخابات</td><td>Payment Gateways (بعدی)</td></tr>
<tr><td>نظرسنجی ad-hoc سازمانی</td><td>Engagement (#6)</td></tr>
<tr><td><strong>دوره ballot · رأی · صندوق · مراقب</strong></td><td><strong>این پکیج (vote_*)</strong></td></tr>
</tbody></table>

---

## اصل سخت: Voting بخشی از Hawiety نیست

<table dir="rtl">
<thead><tr><th>کار</th><th>مسیر درست (الگوی CMS)</th></tr></thead>
<tbody>
<tr><td>جداول <code dir="ltr">vote_*</code></td><td>Data Studio + <code dir="ltr">scripts/voting-phase1/db</code> · <strong>نه</strong> <code dir="ltr">hwy_*</code></td></tr>
<tr><td>LOV / وضعیت‌ها</td><td>Base Info روت <strong>Voting</strong> (مثل CMS root)</td></tr>
<tr><td>API</td><td>Edge / Server Functions · <code dir="ltr">/api/voting/*</code> در manifest پکیج — <strong>نه</strong> <code dir="ltr">hwy.routes.ts</code></td></tr>
<tr><td>UI Studio</td><td><code dir="ltr">workspace/platform-registry/page-modules/voting-*</code> + <code dir="ltr">scripts/voting-phase3/</code></td></tr>
<tr><td>بسته نصب</td><td><code dir="ltr">vertical-app</code> id <code dir="ltr">voting</code> · <code dir="ltr">voting:pack</code> (مثل <code dir="ltr">cms:pack</code>)</td></tr>
<tr><td>دادهٔ cutover</td><td><code dir="ltr">scripts/voting-etl/*</code> — <strong>نه</strong> seed در install</td></tr>
</tbody></table>

**ممنوع:** کپی <code dir="ltr">Elections_*.cs</code> به داخل <code dir="ltr">src/server/domain/hwy</code> · dual parser · شیم <code dir="ltr">@deprecated</code> · route ثابت در bootstrap بدون package gate.

---

## دردهای کلاسیک انتخابات legacy و تصمیم AppEndO

<table dir="rtl">
<thead><tr><th>درد legacy</th><th>علت</th><th>تصمیم Voting package</th></tr></thead>
<tbody>
<tr><td>همه‌چیز داخل <code dir="ltr">HWY_Members</code> + SQL inline</td><td>god-controller</td><td>دامنه جدا <code dir="ltr">vote_*</code> + proc/SQL named مثل <code dir="ltr">hwy_*</code></td></tr>
<tr><td>لیست مرتكزین × ۱۰ variant JS</td><td>کامپوننت per-mood</td><td>یک <strong>catalog</strong> با <code dir="ltr">listScope</code> (مثل member-directory)</td></tr>
<tr><td>ربط ناخب/اقتراع پراکنده</td><td><code dir="ltr">JoinToEghtera</code> در Members</td><td>API قرارداد: <code dir="ltr">POST /api/voting/candidates/:id/link-member</code> — hawiety فقط <code dir="ltr">hwy_member_id</code> را می‌دهد</td></tr>
<tr><td>رأی دوبار / race</td><td>بدون idempotency</td><td><code dir="ltr">vote_cast_events</code> با unique (ballot_id, voter_subject_id, attempt)</td></tr>
<tr><td>geo nested per role</td><td>limitهای per-user</td><td>فیلتر server-side با Record Policy + <code dir="ltr">scope.geo</code>؛ UI cascading از همان APIهای geo پلتفرم</td></tr>
<tr><td>SPهای <code dir="ltr">HWY_SP_Elections_*</code> نامشخص</td><td>ETL-only docs</td><td>فاز ۰ inventory + decision-list ردیف «انتخابات» → هر write یک <code dir="ltr">vote_*</code> proc</td></tr>
</tbody></table>

---

## محدوده IN / OUT (فاز ۱ operatore)

### داخل پکیج (MVP cutover هویتی)

<ul dir="rtl">
<li>مدیریت **دوره انتخابات** (باز/بسته · geo scope)</li>
<li>لیست‌ها و عملیات **مرتكزین / مرشح** (parity هستهٔ <code dir="ltr">Read_List_AlMoMortakezin*</code>)</li>
<li>**دعوت‌شوندگان · رأی‌دهندگان · صندوق‌ها** (<code dir="ltr">Elections_InvitedVoters</code>, <code dir="ltr">Elections_Voters</code>, <code dir="ltr">Elections_Cars</code>)</li>
<li>**مراقب** (<code dir="ltr">Elections_Moragheb</code>)</li>
<li>**اعلان انتخابات** (صف/outbox داخلی پکیج — یا fan-out به CMS بعداً)</li>
<li>**رأی داخلی سازمانی** (<code dir="ltr">HWY_VoteQuestions</code> / <code dir="ltr">VoteVotes</code>) — زیر‌فاز ۳e اختیاری اما در مدل داده جا باز می‌شود</li>
</ul>

### خارج از MVP (صریح)

<ul dir="rtl">
<li>پورتال ورود عضو + MyProfile (پلتفرم/پورتال جدا)</li>
<li>پرداخت منتسب به انتخابات</li>
<li>کل ماژول مالی geo قدیمی روی <code dir="ltr">H_*</code></li>
<li>port یک‌به‌یک هر SP legacy بدون تست parity</li>
</ul>

---

## مدل داده (پیشنهاد v1 — Greenfield)

پیشوند جداول: <code dir="ltr">vote_</code> · control-plane Sequelize · بدون Prisma جدید.

<table dir="rtl">
<thead><tr><th>جدول</th><th>نقش</th><th>یادداشت legacy</th></tr></thead>
<tbody>
<tr><td><code dir="ltr">vote_elections</code></td><td>دوره · وضعیت · بازهٔ زمانی · geo root</td><td><code dir="ltr">Elections</code> manage metadata</td></tr>
<tr><td><code dir="ltr">vote_ballots</code></td><td>صندوق/موضوع رأی زیر دوره</td><td>انواع ballot در Base Info</td></tr>
<tr><td><code dir="ltr">vote_candidates</code></td><td>مرتكز/مرشح · ربط اختیاری <code dir="ltr">hwy_member_id</code> · <code dir="ltr">nakheb_id</code></td><td>Mortakezin rows</td></tr>
<tr><td><code dir="ltr">vote_voter_registrations</code></td><td>ثبت‌نام رأی‌دهنده در دوره</td><td>Invited + Voters</td></tr>
<tr><td><code dir="ltr">vote_polling_stations</code></td><td>صندوق فیزیکی/مکتب</td><td><code dir="ltr">Elections_Cars</code></td></tr>
<tr><td><code dir="ltr">vote_station_assignments</code></td><td>انتساب رأی‌دهنده به صندوق</td><td>junction legacy</td></tr>
<tr><td><code dir="ltr">vote_observers</code></td><td>مراقب</td><td><code dir="ltr">Elections_Moragheb</code></td></tr>
<tr><td><code dir="ltr">vote_cast_events</code></td><td>رأی ثبت‌شده (append-only)</td><td>idempotent writes</td></tr>
<tr><td><code dir="ltr">vote_poll_questions</code> / <code dir="ltr">vote_poll_answers</code></td><td>رأی داخلی ۴ بُعدی</td><td><code dir="ltr">HWY_VoteQuestions</code></td></tr>
</tbody></table>

**Base Info** روت عنوان <code dir="ltr">Voting</code> (هم‌تراز <code dir="ltr">CMS</code> در <code dir="ltr">cmsBaseInfoCatalog.ts</code>): وضعیت دوره · نوع ballot · نقش مراقب · نتیجهٔ رأی · …

---

## فازهای اجرا (مسیر CMS)

<table dir="rtl">
<thead><tr><th>فاز</th><th>خروجی</th><th>پذیرش</th></tr></thead>
<tbody>
<tr><td><strong>۰</strong></td><td><code dir="ltr">voting-legacy-rpc-inventory.md</code></td><td>هر متد legacy → فاز هدف یا «حذف scope»</td></tr>
<tr><td><strong>۱</strong></td><td><code dir="ltr">scripts/voting-phase1/</code> · DDL · Base Info · studio-meta · <code dir="ltr">npm run voting:phase1</code></td><td>Data Studio مدل‌ها سبز · rollback پاک</td></tr>
<tr><td><strong>۲</strong></td><td><code dir="ltr">scripts/voting-phase2/</code> · <code dir="ltr">/api/voting/*</code> · تست integration</td><td>سناریوهای CRUD + cast vote + list filters</td></tr>
<tr><td><strong>۳a</strong></td><td><code dir="ltr">votingStudioNav.ts</code> · <code dir="ltr">voting/settings</code> · culture keys</td><td>گروه nav <strong>Voting</strong> جدا در Studio</td></tr>
<tr><td><strong>۳b–۳e</strong></td><td>page-modules + Designer scaffold (CrudSet/grids)</td><td>صفحات §۱۸ لیست زیر · smoke browser</td></tr>
<tr><td><strong>۴</strong></td><td><code dir="ltr">votingPackagePackRecipe.ts</code> · vertical-app · install/uninstall</td><td>بدون leak در core · QA نصب دوتایی با hawiety</td></tr>
<tr><td><strong>۵ ETL</strong></td><td><code dir="ltr">scripts/voting-etl/</code> از MembersV2</td><td>count/list parity روی DB restore · اختیاری <code dir="ltr">npm run voting:parity:*</code></td></tr>
</tbody></table>

---

## صفحات Studio (هدف فاز ۳ — نام پیشنهادی)

<table dir="rtl">
<thead><tr><th>Legacy تقریبی</th><th><code dir="ltr">pageKey</code></th><th>یادداشت UI</th></tr></thead>
<tbody>
<tr><td>مدیریت دوره</td><td><code dir="ltr">voting-elections</code></td><td>catalog cards · editor + rail</td></tr>
<tr><td><code dir="ltr">AlMoMortakezin</code> lists</td><td><code dir="ltr">voting-mortakezin-list</code></td><td><code dir="ltr">listScope</code> مثل member lists</td></tr>
<tr><td>Candidates</td><td><code dir="ltr">voting-candidates</code></td><td>لینک به پرونده hawiety</td></tr>
<tr><td>Invited / Voters</td><td><code dir="ltr">voting-voters</code> · <code dir="ltr">voting-invited</code></td><td>فیلتر geo</td></tr>
<tr><td><code dir="ltr">Elections_Cars</code></td><td><code dir="ltr">voting-polling-stations</code></td><td>CrudSet</td></tr>
<tr><td>Observers</td><td><code dir="ltr">voting-observers</code></td><td>—</td></tr>
<tr><td>اعلان</td><td><code dir="ltr">voting-notifications</code></td><td>صف داخلی</td></tr>
<tr><td>VoteQuestions</td><td><code dir="ltr">voting-internal-polls</code></td><td>۳e اختیاری</td></tr>
</tbody></table>

الگوی بصری: [package-ui.md](../../../docs/standards/package-ui.md) · مرجع زنده CMS Phase 3 · Base Components catalog.

---

## ادغام با هویتی (بعد از ship — مثل CMS + Portal)

<table dir="rtl">
<thead><tr><th>موضوع</th><th>قرارداد</th></tr></thead>
<tbody>
<tr><td><strong>نصب</strong></td><td>Package Manager: ابتدا <code dir="ltr">hawiety</code>، سپس <code dir="ltr">voting</code> (dependency پیشنهادی در manifest)</td></tr>
<tr><td><strong>منو</strong></td><td>زیرمجموعه پورتال: <code dir="ltr">/{culture}/hawiety/elections/*</code> از manifest voting (capability <code dir="ltr">portal_nav_patch</code>) — <strong>نه</strong> کد ثابت در <code dir="ltr">hwyPortal.ts</code></td></tr>
<tr><td><strong>عضو</strong></td><td>فقط شناسه: <code dir="ltr">hwy_member_id</code> / <code dir="ltr">nakheb_id</code>؛ خواندن نام از API hawiety موجود</td></tr>
<tr><td><strong>اقتراع/ناخب</strong></td><td>جایگزین تدریجی <code dir="ltr">JoinToEghtera</code>: پرونده hawiety دکمه «انتخابات» → deep link به voting candidate</td></tr>
<tr><td><strong>parity doc</strong></td><td>به‌روزرسانی §۱۳ و R-40 در <a href="../hawiety-package/hwy-legacy-vs-appendo-feature-parity.md">hwy-legacy-vs-appendo-feature-parity.md</a> پس از فاز ۴</td></tr>
</tbody></table>

---

## اسکریپت‌ها (هدف نام‌گذاری — پس از پیاده‌سازی)

<table dir="rtl">
<thead><tr><th>npm</th><th>معنی</th></tr></thead>
<tbody>
<tr><td><code dir="ltr">voting:phase1</code> / <code dir="ltr">voting:phase1:rollback</code></td><td>schema + meta</td></tr>
<tr><td><code dir="ltr">voting:phase2</code></td><td>API smoke</td></tr>
<tr><td><code dir="ltr">voting:phase3</code></td><td>pages + nav</td></tr>
<tr><td><code dir="ltr">voting:pack</code></td><td>ساخت zip vertical-app</td></tr>
<tr><td><code dir="ltr">voting:etl:full</code></td><td>cutover از legacy DB</td></tr>
<tr><td><code dir="ltr">test:voting-package</code></td><td>گیت CI مشابه <code dir="ltr">test:hawiety-package</code></td></tr>
</tbody></table>

---

## کار بعدی (برای agent)

**فاز ۰** — inventory RPCهای <code dir="ltr">Elections_*</code> + نقشه SP → جدول تصمیم در همین پوشه. سپس **فاز ۱** بدون هیچ تغییری در پکیج hawiety.

---

## ارجاع

<ul dir="rtl">
<li><a href="./README.md">README voting-package</a></li>
<li><a href="../hawiety-package/p-packages-hawiety-extraction.md">extraction هویتی</a> (الگوی vertical-app)</li>
<li><code dir="ltr">scripts/cms-phase1/</code> · <code dir="ltr">scripts/cms-phase3/</code> — الگوی فنی</li>
</ul>

</div>
