<div dir="rtl" lang="fa" class="vx-parity-doc">
<style>
  .vx-parity-doc { text-align: right; unicode-bidi: plaintext; }
  .vx-parity-doc h1, .vx-parity-doc h2, .vx-parity-doc h3, .vx-parity-doc h4, .vx-parity-doc p, .vx-parity-doc li { text-align: right; }
  .vx-parity-doc table { direction: rtl; text-align: right; width: 100%; border-collapse: collapse; margin: 0.75rem 0; }
  .vx-parity-doc th, .vx-parity-doc td { border: 1px solid #c4c4c4; padding: 0.35rem 0.5rem; vertical-align: top; text-align: right; }
  .vx-parity-doc th { background: #f6f6f6; font-weight: 600; }
  .vx-parity-doc ul, .vx-parity-doc ol { padding-right: 1.25rem; padding-left: 0; }
  .vx-parity-doc pre, .vx-parity-doc code { direction: ltr; text-align: left; unicode-bidi: embed; }
</style>

<p><strong>خلاصه برای operatore:</strong> هر بلوک را جدا به agent بدهید؛ بعد از هر فاز «done criteria» را از <a href="./p-packages-voting.md">پلن</a> چک کنید.</p>

# پرامپت‌های اجرا — Voting (Elections)

---

## فاز ۰ — inventory legacy (فقط خواندن)

```
@plans/packages/todo/voting-package فاز ۰ بساز

فقط سند بخوان و inventory تولید کن (بدون کد production):
۱) فهرست کنترلرهای Elections_* و VX_* مرتبط (Mortakez، JoinToEghtera، VoteQuestions) از VerticalSite
۲) جدول RPC → SP (از MembersUtils / VX_SP_Elections_*)
۳) خروجی: voting-package/voting-legacy-rpc-inventory.md (RTL) + ستون «فاز هدف» (۱/۲/۳/ETL)
ممنوع: تغییر src/ · تغییر vx package
```

## فاز ۱ — schema + Base Info + studio-meta

```
@plans/packages/todo/voting-package فاز ۱ بساز

الگو: scripts/cms-phase1/ (idempotent install/rollback).
بساز scripts/voting-phase1/: vote_* DDL + uninstall · Base Info روت Voting · studio-meta
(هسته: vote_elections، vote_ballots، vote_ballot_roles، vote_cast_events — جدول کامل در پلن §۶).
پذیرش: Data Studio هر مدل + associations · Base Info زنده · npm run voting:phase1 / voting:phase1:rollback
ممنوع: seed عضو/ناخب · mount در bootstrapFullRuntime · کد داخل src/features/vx-*
```

## فاز ۲ — API دامنه (Sequelize Edge)

```
@plans/packages/todo/voting-package فاز ۲ بساز

فقط بعد از فاز ۱ ✅. Server Functions / edge APIs تحت /api/voting/* — الگوی cms edge، نه Prisma.
سناریوهای پذیرش (تست خودکار): CRUD دوره · بستن/باز کردن ballot · ثبت رأی با idempotency ·
لیست مرتكزین با فیلتر geo · دعوت رأی‌دهنده · ربط candidate به vx_member_id (FK اختیاری، بدون import features).
ممنوع: db.query خام در route · duplicate parser legacy
```

## زیر‌فاز ۳a — Studio nav + Settings + واژگان

```
@plans/packages/todo/voting-package زیر‌فاز 3a بساز

package-ui.md + Base Components. scripts/voting-phase3/votingStudioNav.ts (الگوی cmsStudioNav).
گروه nav مستقل Voting در Studio — نه داخل منوی Vertical تا زمان ادغام فاز ۴.
صفحه voting/settings = فقط واژگان Base Info (وضعیت دوره، نوع ballot، …).
```

## زیر‌فاز ۳b–۳e — صفحات operatore (به ترتیب)

```
@plans/packages/todo/voting-package زیر‌فاز 3b بساز   # Elections catalog + editor
@plans/packages/todo/voting-package زیر‌فاز 3c بساز   # Mortakezin / candidates lists (parity Read_List_AlMoMortakezin*)
@plans/packages/todo/voting-package زیر‌فاز 3d بساز   # Voters · invited · stations (Cars) · observers (Moragheb)
@plans/packages/todo/voting-package زیر‌فاز 3e بساز   # Internal polls (VoteQuestions) — اختیاری اگر scope قفل شد

هر صفحه: CrudSet/grid از scaffold Designer مثل cms-phase3 · parity-read hook برای QA اختیاری
```

## فاز ۴ — بسته vertical-app + ادغام هویتی

```
@plans/packages/todo/voting-package فاز ۴ بساز

بعد از ۳e ✅: src/core/packages/votingPackage.ts + pack recipe · voting:pack ·
manifest kind vertical-app · capabilities: shell optional · pages · edge_apis · db_objects.
ادغام: package dependency «vertical» پیشنهادی + nav injection زیر /{culture}/vertical/elections/*
(قرارداد در پلن §۱۰). ETL: scripts/voting-etl/* از MembersV2 — بدون seed install.
پذیرش: نصب/حذف voting بدون leak API در core · vertical بدون voting نصب‌شده همان رفتار امروز
```

</div>
