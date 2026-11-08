# Optimization workflow

> **Shard:** `optimization`  
> **Axis aliases:** `dead-code` · `optimization-dead-code` · `optimization-performance` · `optimization-security`  
> **Skills:** [all](../../.claude/skills/appendo-perf-full/SKILL.md) · [dead-code](../../.claude/skills/appendo-perf-dead-code/SKILL.md) · [performance (runtime)](../../.claude/skills/appendo-perf-app/SKILL.md) · [startup (boot)](../../.claude/skills/appendo-perf-startup/SKILL.md) · [security](../../.claude/skills/appendo-perf-security/SKILL.md)

Hygiene baseline: this shard. Security backlog: `plans/core/next/p-66-security-hardening.md`.

---

## محور را اول انتخاب کن

سه محور **مستقل**اند. هر کدام را می‌توان **تنهایی** صدا کرد. فقط محور(های) نام‌برده را اجرا کن.

| محور | کلید | صدا کردن | فازهای مجاز |
|------|------|----------|-------------|
| **Dead code** | `dead-code` | `@appendo-perf-dead-code` · «کلین آپ» · «کد مرده» · «فقط dead code» | ۰ → ۱ → ۴ |
| **Performance** | `optimization-performance` | `@appendo-perf-app` · «پرفورمنس» · «فقط performance» | ۰ → ۲ → ۴ |
| **Security** | `optimization-security` | `@appendo-perf-security` · «سکیوریتی» · «امنیت» · «فقط security» | ۰ → ۳ → ۴ |
| **هر سه** | `optimization` | `@appendo-perf-full` · «اوپتیمایزیشن کن» · «هر سه محور» | ۰ → ۱ → ۲ → ۳ → ۴ |

چند محور با هم: «کلین آپ و سکیوریتی» → فقط همان‌ها (اینجا ۰ → ۱ → ۳ → ۴).

**هرگز** محور نخواسته را اسکن، فیکس، یا در جدول گزارش پر نکن — بنویس `N/A — axis not requested`.

**Boot / startup** (server READY، `/api/boot`، first shell paint) is **not** a fourth shard axis — use skill [`appendo-perf-startup`](../../.claude/skills/appendo-perf-startup/SKILL.md) (`@appendo-perf-startup`). Baseline: [`docs/perf/p-56-startup-baseline.md`](../perf/p-56-startup-baseline.md).

اگر فقط «بهینه‌سازی» گفت و محور مشخص نبود → بپرس کدام محور. «اوپتیمایزیشن» بدون قید = هر سه.

**Scope اختیاری:** مسیر/فیچر (`src/features/cms/` · `server-functions` · `component-designer`) یا «کل ریپو — یک batch کوچک».

---

## اصول اجرا (همیشه)

| قانون | توضیح |
|-------|--------|
| **فقط محور خواسته** | محورهای دیگر را اجرا نکن؛ گزارش‌شان `N/A` است |
| **حداقل diff** | فقط تغییر مرتبط با یافته؛ بدون refactor اضافی |
| **بدون greenfield شکستن** | [`greenfield.md`](./greenfield.md) — parser/migration/runtime دوگانه نساز |
| **تأیید قبل از حذف** | فایل/export را حذف کن فقط وقتی import استاتیک + dynamic + entry نقطه‌ها را چک کردی |
| **فقط تست = مرده** | مصرف در `*.test.ts` / `__tests__` / `*.spec.ts` نماد production را زنده نمی‌کند — Knip این importها را usage می‌شمارد |
| **Verify قبل از گزارش امنیتی** | grep hit کافی نیست؛ تعریف واقعی را بخوان. commit / push / PR نکن مگر کاربر خواست |
| **تست بعد از fix** | حداقل `npm run lint` + تست‌های مرتبط؛ برای تغییرات گسترده `npm run test:critical` |
| **گزارش خروجی** | در پایان از [قالب گزارش](#قالب-گزارش-خروجی) استفاده کن — محورهای خارج از scope را خالی نگذار، `N/A` بنویس |
| **batch کوچک** | هر session: ≤۱۵ فایل حذف/ویرایش یا ≤۵ fix امنیتی/پرفورمنسی — مگر کاربر scope بزرگ‌تر بخواهد |

---

## فاز ۰ — آماده‌سازی

همیشه اجرا می‌شود (هر محور).

1. **محور(ها)** را از prompt استخراج کن (`dead-code` · `performance` · `security` · `all`). اگر خالی و مبهم است، بپرس — حدس نزن.
2. **Scope** را از prompt کاربر استخراج کن (مسیر، فیچر، یا کل ریپو).
3. **Baseline** بگیر — فقط ابزار همان محور:
   ```bash
   npm run lint                         # همهٔ محورها
   npm run hygiene:knip                 # فقط dead-code یا all
   ```
4. اگر dead-code است و scope مشخص است، Knip را روی همان مسیر فیلتر کن (grep خروجی یا `--include` patterns در `knip.json` project).
5. [`CODEBASE_INDEX.md`](../ai/CODEBASE_INDEX.md) یا `get_feature_graph` برای context فیچر.

---

## فاز ۱ — Dead code (کد غیرقابل استفاده)

**Skip unless axis includes `dead-code`.**

**هدف:** حذف فایل‌ها، exportها، dependencyها و aliasهای `@deprecated` که واقعاً مصرف ندارند.

### ۱.۱ ابزارها

| ابزار | دستور | یادداشت |
|-------|--------|---------|
| Knip | `npm run hygiene:knip` | `files: error` · `exports/types: warn` — [`knip.json`](../../knip.json) |
| TypeScript | `npm run lint` | `tsc --noEmit` |
| Translation audit | `npm run codegen:translation-audit` | کلیدهای culture بدون مصرف (info) |
| Grep | `rg` | dynamic import · `import(` · barrel re-export |

### ۱.۲ چک‌لیست کشف

- [ ] فایل‌های بدون import استاتیک (Knip `files`)
- [ ] export/type بدون مصرف — **batch تدریجی**؛ اول P0 UI مرده و stubها
- [ ] npm dependency بدون import — قبل از حذف `@fontsource/*` و icon packهای dynamic را در `ignoreDependencies` ببین
- [ ] barrel `index.ts` بلااستفاده در `src/features/*`
- [ ] `@deprecated` aliasها — اگر هیچ import نمانده، حذف
- [ ] اسکریپت‌های `scripts/` بدون npm script و بدون import
- [ ] import شکسته در تست‌ها (مسیر refactor نشده)
- [ ] فایل/export که importerهایش **فقط تست**اند (Knip آن‌ها را زنده نشان می‌دهد)
- [ ] فایل‌های `runtime/designer/drafts/*` — فقط اگر کاربر صریحاً خواست (معمولاً خارج از scope)

### ۱.۲b فقط تست = هنوز مرده

Knip و TypeScript import تست را usage می‌شمارند. **فقط مصرف production** نماد را زنده می‌کند.

| الگو | اقدام |
|------|--------|
| فایل/export که importerهایش فقط `*.test.ts` · `__tests__` · `*.spec.ts` اند | حذف نماد production، بعد تست‌هایی که **فقط** همان را می‌پوشاندند |
| helper داخل خود تست یا `**/__tests__/helpers` | نگه دار — زیرساخت تست است، API مرده نیست |
| تست قرارداد عمومی (OpenAPI / package ZIP) | نگه دار — §۱.۳ Public API |

قبل از حذف: `rg` روی نماد، بعد فیلتر مسیرهای تست. اگر چیزی بیرون از تست نماند، مرده است.

### ۱.۳ قبل از حذف — false positive

این‌ها را **حذف نکن** مگر مطمئن شدی واقعاً مرده‌اند:

| الگو | دلیل |
|------|------|
| Entry points در `knip.json` | `main.tsx` · `server/index.ts` · `scripts/*` |
| Dynamic import | `import(\`…\`)` · lazy routes · `lazyPages.tsx` |
| Runtime reflection | MCP tool registration · workflow action registry |
| Generated | `src/generated/**` · Prisma client |
| Config-only deps | `@fontsource/*` · `vite` (dev) |
| Public API عمدی | export برای package ZIP / OpenAPI contract |

### ۱.۴ اقدام

1. حذف فایل یا export با کمترین blast radius.
2. اگر فقط تست باقی مانده → نماد production را بردار، بعد تست‌های اختصاصی‌اش را.
3. اگر dependency حذف شد → `package.json` + `npm install`.
4. اگر Knip false positive → `knip.json` `ignore` / `ignoreDependencies` با کامنت کوتاه.
5. `npm run lint` + `npm run hygiene:knip` دوباره.

---

## فاز ۲ — Performance (پرفورمنس)

**Skip unless axis includes `performance`.**

**هدف:** کاهش latency، payload، re-render، و بار DB/cache در مسیرهای پرترافیک.

مرجع عمیق: PERF-B/C in this shard.

### ۲.۱ Backend

| سیگنال | کجا بگرد | fix معمول |
|--------|----------|-----------|
| Payload سنگین JSON | repositories · `findMany` بدون `select` | slim `select` · pagination · `messageCount` بدون parse کل blob |
| N+1 query | Prisma loops · nested `include` | `include` batch · raw aggregate |
| Cache full scan | `listEntries()` · invalidate بدون prefix | [`cache-keys.md`](./cache-keys.md) · `invalidateByPrefix` |
| Index نبودن | slow list/filter · audit logs | [`apply-performance-indexes.ts`](../../scripts/apply-performance-indexes.ts) |
| Sandbox compile | cold managed functions | compile cache · worker pool (موجود — tune فقط با evidence) |
| Dashboard aggregate | `findMany` + JS reduce | SQL `COUNT` / `GROUP BY` |

```bash
npm run db:apply-performance-indexes   # SQL Server indexes
npm run benchmark:api                  # اگر endpoint مشخص است
```

### ۲.۲ Client

| سیگنال | کجا بگرد | fix معمول |
|--------|----------|-----------|
| Re-render زیاد | Context بزرگ · props unstable | split context · `useMemo`/`useCallback` · `React.memo` row |
| لیست بدون virtual | `AppTableGrid` · tree-grid | [`gridVirtualizationConstants.ts`](../../src/shared/lib/gridVirtualizationConstants.ts) |
| Query storm | `staleTime: 0` · refetch on focus | `RECORDS_LIST_QUERY_OPTIONS` · manifest staleTime |
| Bundle بزرگ | import سنگین در route والد | lazy route · dynamic import Monaco/HeroUI |
| Designer monolith | canvas re-render | `memo` روی node card · boundary باریک (CRO-4) |

### ۲.۳ چک‌لیست کشف

- [ ] API list بدون `skip`/`take` یا limit
- [ ] Avatar/base64 داخل JSON لیست کاربر
- [ ] Chat history: کل `messagesJson` در list
- [ ] `refetchOnWindowFocus: true` روی queryهای سنگین
- [ ] Effect بدون dependency درست · subscription leak
- [ ] Debounce نبودن روی search/typeahead
- [ ] `key={index}` در لیست‌های قابل sort

### ۲.۴ اقدام

1. **Measure first** — حجم پاسخ، تعداد query، یا تعداد render (code review + در صورت امکان benchmark).
2. Fix کوچک با بیشترین impact (معمولاً pagination + select slim).
3. تست: unit/integration مرتبط + `npm run lint`.

---

## فاز ۳ — Security (امنیت)

**Skip unless axis includes `security`.**

**هدف:** بستن آسیب‌پذیری‌های واقعی — نه hardening تئوری بدون evidence.

مرجع backlog: [`p-66-security-hardening.md`](../../plans/core/next/p-66-security-hardening.md).

### ۳.۱ Secrets & config

| چک | دستور/محل |
|----|-----------|
| `.env` track نشده | `secretsHygiene.test.ts` · `git ls-files` |
| API key pattern در repo | `rg` برای `sk-` · `ghp_` · `AIza` |
| Secret پیش‌فرض در production | `authSecrets.ts` · `settings.example.json` → `change_me` |
| Credential plaintext | `gitCredentialStore.ts` · فایل‌های ریشه repo |

```bash
npm run test:critical   # شامل secretsHygiene
```

### ۳.۲ Injection & validation

| چک | الگو |
|----|------|
| SQL injection | `$executeRawUnsafe` + string interpolation → `Prisma.sql` / parameterized |
| XSS | `dangerouslySetInnerHTML` · user SVG · markdown بدون sanitize → DOMPurify |
| Path traversal | file-manager · upload path — allowlist نه فقط blacklist |
| SSRF | URL fetch از input کاربر — allowlist host |
| Auth bypass | route بدون middleware · `ADMIN` check ناقص |
| IDOR | resource by id بدون ownership check |

```bash
rg '\$executeRawUnsafe|dangerouslySetInnerHTML|eval\(|new Function\(' src/
rg 'req\.(body|query|params)\.' src/server --glob '*.ts' | head
```

### ۳.۳ Platform hardening (اگر در scope)

- Rate limit روی auth routes (`rateLimit.ts`)
- HTTP security headers (`helmet` / CSP)
- CSRF برای mutations حساس
- Server Functions: `edge-auth.policy` · sandbox escape
- MCP tool access (`mcpAccess.service.ts`)

### ۳.۴ اقدام

1. **Verify روی سورس** — grep / pattern hit کافی نیست. فایل تعریف را بخوان. اگر SQL parameterized است، HTML sanitize شده، host allowlist دارد، یا فقط fixture تست است → گزارش نکن (false positive).
2. **Severity اول:** secret leak · SQLi · auth bypass · RCE sandbox.
3. Fix در working tree + تست regression (حتماً برای auth/SQL). **هرگز** `git commit` / push / PR نکن مگر کاربر صریحاً خواست.
4. اگر مورد در `p-66` هست، همان ID را در گزارش cite کن.

**هرگز** secret واقعی را در گزارش/chat لاگ نکن — فقط مسیر فایل و نوع مشکل.

---

## فاز ۴ — تأیید نهایی

همیشه اجرا می‌شود — فقط دستورهای محورِ انجام‌شده:

```bash
npm run lint
npm run hygiene:knip          # فقط اگر dead-code اجرا شد
npm run test:critical         # فقط اگر security یا تغییر گسترده
# تست‌های scope‌دار:
npx vitest run <path-to-related-tests>
```

- [ ] هیچ رفتار عمدی نشکسته
- [ ] diff متمرکز و قابل review
- [ ] false positiveهای Knip documented نشده‌اند مگر لازم

---

## قالب گزارش خروجی

هر session اوپتیمایزیشن با این قالب تمام شود. محور اجرا نشده = یک خط `N/A — axis not requested` در Summary و جدول خالی نگذار.

```markdown
# Optimization report — <scope> — <axes> — <date>

## Summary
- Axes run: <dead-code | performance | security | all>
- Dead code: <N files removed> · <N exports cleaned> · <N deps removed>  |  N/A — axis not requested
- Performance: <N fixes> — estimated impact: <one line>  |  N/A — axis not requested
- Security: <N issues> — <severity breakdown>  |  N/A — axis not requested

## Dead code
| Item | Action | Risk |
|------|--------|------|
| `path/to/file.ts` | deleted | low — no static/dynamic imports |
| `unusedHelper.ts` | deleted + its unit test | low — test-only importers |

## Performance
| Issue | Location | Fix | Impact |
|-------|----------|-----|--------|
| Unbounded list | `fooRepository.ts` | added `take: 50` | ~60% smaller payload |

## Security
| Severity | Issue | Location | Fix |
|----------|-------|----------|-----|
| High | Raw SQL interpolation | `userRepository.ts:468` | Prisma.sql params (verified on source) |

## Verification
- [ ] `npm run lint` ✅
- [ ] `npm run hygiene:knip` ✅ / N/A
- [ ] `npm run test:critical` ✅ / N/A
- [ ] <other tests>

## Deferred (out of scope)
- …
```

---

## محورهای ترکیبی (فقط وقتی `all` است)

وقتی کاربر **هر سه** را خواست و اولویت نداد، این ترتیب را برو. وقتی یک محور تنهایی صدا شده، این بخش را نادیده بگیر.

1. **P0 Security** — secret · SQLi · auth (اگر یافت شد، اول fix)
2. **P0 Performance** — unbounded list · giant payload در مسیر admin
3. **P1 Dead code** — فایل‌های Knip `error` در scope
4. **P2** — export sweep · micro-optimizations

---

## لینک‌های مرتبط

| موضوع | سند |
|-------|-----|
| Cache keys | [`cache-keys.md`](./cache-keys.md) |
| Server Functions auth | [`data-studio.md`](./data-studio.md) |
| Greenfield | [`greenfield.md`](./greenfield.md) |
| Hygiene baseline | this shard |
| Security plan | [`p-66-security-hardening.md`](../../plans/core/next/p-66-security-hardening.md) |

**IDs:** `hygiene.optimization.independent-axes`, `hygiene.optimization.test-only-is-dead`, `hygiene.optimization.verify-before-report`
