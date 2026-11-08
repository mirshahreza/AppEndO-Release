# رفرنس سطوح اجرای کد دینامیک در AppEndO

> **هدف سند:** نقشه‌ی دقیق تمام جاهایی در پلتفرم (سرور + کلاینت) که کد/عبارت نوشته‌شده توسط کاربر، طراح، یا نویسنده‌ی پکیج — نه سورس خود پلتفرم — در زمان اجرا (runtime) اجرا می‌شه؛ و این‌که در هرکدوم چه یوتیلیتی‌هایی (چه از قبل بوده، چه تازه اضافه‌شده) در دسترسه و چطور استفاده می‌شن.
>
> **تاریخ نگارش:** ۲۰۲۶-۰۷-۱۶. اگر بعداً سطح جدیدی اضافه شد یا یوتیلیتی جدیدی به یکی از سندباکس‌ها وصل شد، این سند رو به‌روز کنید — منبع حقیقت کد است، این سند فقط نقشه‌ست.

---

## خلاصه‌ی سریع

| سطح | کجا | کد رو کی می‌نویسه؟ | ایزوله‌سازی | دسترسی به npm packages |
|---|---|---|---|---|
| Server Functions | `src/core/api/sandboxWorkerPool.ts` | کاربر (Edge Function author) | `vm` واقعی + `worker_threads` + memory cap | فقط از طریق `util.*` صریح — بدون `require` |
| Package API Handlers | `src/server/services/package-runtime/packageApiRuntime.service.ts` | نویسنده‌ی پکیج نصب‌شده | `vm` واقعی، main thread، بدون memory cap | فقط از طریق `util.*` صریح — بدون `require` |
| Package UI Module Compile | `src/server/services/package-runtime/packageUiModuleCompile.service.ts` | نویسنده‌ی پکیج نصب‌شده | فقط esbuild bundling، بدون sandbox اجرایی جدا | **بله** — هر import در `node_modules` هاست در زمان build واقعاً bundle می‌شه |
| Workflow corePack Actions | `src/server/domain/workflow/actions/corePack/*.ts` | نه کد آزاد — طراح Workflow فقط Action آماده رو انتخاب/کانفیگ می‌کنه | Action registry بسته (closed contract)، بدون eval | فقط از طریق Actionهای از پیش ثبت‌شده |
| Designer Expressions (client) | `src/domain/component-designer/*.ts` (۴ فایل، پایین توضیح داده شده) | طراح UI (متن عبارت در JSON سند ذخیره می‌شه) | **هیچ sandbox‌ای نیست** — `new Function` خام در مرورگر کاربر نهایی | فقط globalهای مرورگر (window/fetch/...)، هیچ util جدیدی وصل نشده |

---

## ۱. Server Functions — سندباکس واقعی Node.js

**فایل‌ها:** `src/core/api/sandbox.ts` (نقطه‌ی ورود `executeServerFunction`) → `sandboxCompileCache.ts` (کامپایل TS/JS با esbuild) → `sandboxWorkerPool.ts` (اجرای واقعی داخل `vm.createContext` درون یک pool از `worker_threads`).

- **محدودیت‌ها:** timeout بین ۱۰۰ تا ۱۵۰۰۰ میلی‌ثانیه (پیش‌فرض ۳۰۰۰)، حافظه بین ۶۴/۱۲۸/۲۵۶ مگابایت (`resourceLimits.maxOldGenerationSizeMb`). خطای heap/OOM باعث retire شدن worker می‌شه.
- **globalهای در دسترس کد کاربر** (دقیقاً همینا، هیچ‌چیز دیگه‌ای — چون `sandboxEnv` کل global object این `vm.createContext` رو تشکیل می‌ده):

```js
req        // body, query, params, method, headers, auth: { userId, email, roles }
res        // res.json(data) / res.status(code) / res.send(data) / res.headersSent()
db.query(operation, params?, context?)   // به هاست proxy می‌شه (postMessage)
ctx.get(key) / ctx.server.get(key) / ctx.client.get(key)   // session context
console.log(...) / console.error(...)
util.regexMatch(pattern, text, options?)     // <-- جدید، ۲۰۲۶-۰۷-۱۶
util.validateSchema(schema, value)           // <-- جدید، ۲۰۲۶-۰۷-۱۶
```

هیچ `require`/`import`/`process`/`module`/`global` در این context وجود نداره و نمی‌تونه وجود داشته باشه — تست `sandbox.util.test.ts`'s `"sandbox still has no require()..."` این رو صریحاً تأیید می‌کنه.

### `util.regexMatch(pattern, text, options?)`

Regex ایمن در برابر ReDoS، بک‌اند آن RE2 (از طریق `re2-wasm`، بدون نیاز به کامپایل native). محدودیت: الگو حداکثر ۵۰۰ کاراکتر، متن ورودی حداکثر ۱۰۰٬۰۰۰ کاراکتر.

```js
const result = util.regexMatch('(\\w+)@(\\w+)', 'contact: ada@example', { flags: 'i' });
// { ok: true, matched: true, matches: [{ match: 'ada@example', index: 9, groups: ['ada','example'], namedGroups: {} }] }

res.json(result);
```

خروجی خطا (بدون throw کردن):

```js
util.regexMatch('[', 'abc');
// { ok: false, errorCode: 'INVALID_PATTERN', message: '...' }
```

### `util.validateSchema(schema, value)`

اعتبارسنجی مقدار در برابر یک JSON Schema خام (بک‌اند: `ajv` + `ajv-formats`، پس فرمت‌های استاندارد مثل `email`/`date-time` هم پشتیبانی می‌شن).

```js
const schema = { type: 'object', properties: { email: { type: 'string', format: 'email' } }, required: ['email'] };
const check = util.validateSchema(schema, req.body);
if (!check.valid) {
  res.status(400).json({ success: false, errors: check.errors });
  return;
}
```

**پیاده‌سازی:** چون کل worker source یک رشته‌ی خام هست که با `new Worker(source, { eval: true })` اجرا می‌شه (بدون فایل واقعی برای import کردن)، منطق `regexMatch`/`validateSchema` این‌جا به‌صورت inline (نه import از فایل‌های canonical) نوشته شده — اما دقیقاً همون semantics و محدودیت‌های `src/server/utils/safeRegex.ts`/`jsonSchemaValidate.ts` رو دنبال می‌کنه. اگر یکی از این دو رو تغییر دادید، اون یکی رو هم sync کنید (کامنت بالای این بخش در خود کد هم همین رو یادآوری می‌کنه).

---

## ۲. Package API Handlers — سندباکس مشابه، برای هندلرهای پکیج‌های نصب‌شده

**فایل:** `src/server/services/package-runtime/packageApiRuntime.service.ts`

مشابه Server Functions ولی: روی **main thread** اجرا می‌شه (نه worker_thread جدا)، بدون سقف حافظه، timeout بین ۱۰۰۰ تا ۶۰۰۰۰ میلی‌ثانیه (پیش‌فرض ۳۰۰۰). سورس از فایل API entry داخل zip پکیج نصب‌شده میاد.

**globalهای در دسترس:**

```js
module, exports         // برای module.exports = async function handler(req, res) {...}
req, res                // status/json/send/headersSent
util.regexMatch(...)    // <-- جدید، همون تابع src/server/utils/safeRegex.ts (import مستقیم، بدون duplicate)
util.validateSchema(...) // <-- جدید، همون تابع src/server/utils/jsonSchemaValidate.ts
```

```js
// edge/health.js داخل پکیج
module.exports = async function handler(req, res) {
  const check = util.validateSchema({ type: 'object', required: ['name'] }, req.body);
  if (!check.valid) return res.status(400).json({ success: false, errors: check.errors });
  res.json({ success: true });
};
```

برخلاف Server Functions، این‌جا چون فایل واقعی TS است (نه رشته‌ی eval‌شده)، `util.regexMatch`/`util.validateSchema` مستقیماً از `src/server/utils/safeRegex.ts`/`jsonSchemaValidate.ts` import شدن — بدون تکرار کد.

---

## ۳. Package UI Module Compile — تنها جایی که واقعاً به `node_modules` هاست دسترسی داره

**فایل:** `src/server/services/package-runtime/packageUiModuleCompile.service.ts`

این سندباکس اجرایی نیست — یک **مرحله‌ی build-time** با `esbuild.build({ bundle: true, format: 'esm', platform: 'browser' })` است که سورس UI پکیج نصب‌شده رو به یک ماژول ESM واقعی برای مرورگر تبدیل می‌کنه. فقط `react`/`react/jsx-runtime` به globalهای هاست map می‌شن؛ هر import دیگه‌ای (مثل `import { z } from 'zod'` یا `import dayjs from 'dayjs'`) با resolution عادی Node در `node_modules` سرور جست‌وجو و **واقعاً bundle** می‌شه.

> این دقیقاً جواب سؤال اولیه‌ی این گفتگو («میشه در پروداکشن کاربر پکیج نصب کنه؟») برای مسیر UI پکیج‌هاست: تا وقتی پکیج در `node_modules` هاست موجوده (یعنی موقع build/deploy نصب شده، نه در لحظه توسط کاربر نهایی)، کد UI پکیج نصب‌شده می‌تونه ازش import کنه. این با ریسک‌های بحث‌شده در ابتدای گفتگو (نصب runtime توسط کاربر نهایی) فرق داره — این یک مسیر build-time کنترل‌شده است، نه نصب دلخواه در لحظه.

---

## ۴. Workflow corePack Actions — بلوک‌های آماده‌ی بدون کد برای طراح Workflow

**پوشه:** `src/server/domain/workflow/actions/corePack/` (ثبت در `index.ts`)

این‌جا طراح Workflow کد آزاد نمی‌نویسه — یک Action از رجیستری بسته انتخاب و کانفیگ می‌کنه. عبارت‌های شرطی/نگاشت داخل تعریف Workflow هم یک AST بسته و از پیش‌تعیین‌شده هستن (`engine/expressionEvaluator.ts`)، **نه** کد آزاد JS — پس این سطح از نظر امنیتی کاملاً متفاوت با سه‌تای بالاست.

Actionهای مرتبط با این گفتگو:

| Action key | وضعیت | توضیح |
|---|---|---|
| `text.regex-match` | **AVAILABLE** (تازه فعال شد، ۲۰۲۶-۰۷-۱۶ — قبلاً به‌خاطر نبود پریمیتیو ReDoS-safe غیرفعال بود) | همون `util.regexMatch` بالا، پشت یک Action |
| `ai.llm-structured` / `ai.classify` / `ai.extract` | AVAILABLE (خروجی مدل حالا در برابر `outputSchema` پین‌شده با ajv چک می‌شه) | |
| `ai.embedding` | همچنان UNAVAILABLE | provider embedding در پلتفرم وجود نداره — یک پکیج npm این gap رو نمی‌بنده |
| `communication.notification-send` | همچنان UNAVAILABLE | کانال notification عمومی در پلتفرم وجود نداره |

مثال کانفیگ یک نود ACTION در تعریف Workflow (JSON، نه کد):

```json
{
  "kind": "ACTION",
  "actionRef": { "key": "text.regex-match", "version": "1" },
  "config": { "pattern": "(\\w+)@(\\w+)", "flags": "i" },
  "input": { "text": { "type": "PATH", "path": "$.trigger.emailBody" } }
}
```

---

## ۵. Designer Expressions (کلاینت) — بدون سندباکس، اجرای مستقیم در مرورگر کاربر نهایی

**فایل‌ها** (هر ۴ تا مسیر واقعی runtime، نه فقط ابزار داخلی طراحی):

| فایل | چه عبارتی رو ارزیابی می‌کنه | متغیرهای در دسترس |
|---|---|---|
| `visibilityConditionEngine.ts` | شرط "Visible When" کامپوننت | `designerStore, dataContext, item, index` |
| `previewFieldValidation.ts` | قانون validation فیلد | `designerStore, dataContext, value` |
| `designerGridRowDisableRules.ts` | شرط غیرفعال بودن ردیف گرید | `designerStore, item` |
| `bindingDynamicActionsRuntime.ts` | `valueExpression` یک dynamic action (مثل setValue) | `designerStore, event, value` |

عبارت به‌صورت متن در JSON سند طراحی ذخیره می‌شه و با `new Function(...)` — بدون هیچ نوع sandbox، بدون scope محدودشده — در مرورگر واقعیِ کاربر نهایی (نه فقط محیط طراحی) اجرا می‌شه؛ صفحه‌ی `DesignerPublishedPage`/`DesignerPublishedShell` همین عبارت‌ها رو برای هر بازدیدکننده اجرا می‌کنه.

**نکته‌ی مهم و صادقانه:** این سطح **هیچ ارتباطی با `util.regexMatch`/`util.validateSchema` نداره و نباید هم داشته باشه** — دلایل:
1. مدل اعتماد فرق داره: این عبارت‌ها رو طراح UI (نه یک کاربر نهایی ناشناس) می‌نویسه، و از قبل بدون sandbox در مرورگر اجرا می‌شن؛ اضافه کردن RE2/ajv این‌جا فقط وزن بروزر رو (با WASM) زیاد می‌کنه بدون این‌که مرز امنیتی جدیدی اضافه کنه.
2. اگر یک عبارت طراحی حاوی regex باشه، از `RegExp` بومی جاوااسکریپت مرورگر استفاده می‌کنه — همون ریسک ReDoS بومی JS هنوز این‌جا صادقانه باقی مونده (مستند نشده جای دیگه، این سند اولین جاییه که این gap رو صریح می‌گه).

---

## ۶. فهرست پکیج‌های یوتیلیتی — قدیمی و جدید

| پکیج | از قبل بود؟ | کجا واقعاً استفاده می‌شه |
|---|---|---|
| `zod` | قبلی | schema های runtime سمت سرور (`AiModelGatewayAdapter`, corePack aiActions, بسیاری جای دیگه) |
| `ajv` / `ajv-formats` | **این‌ها به‌صورت transitive از قبل بودن** (از `@modelcontextprotocol/sdk`/`prisma`/`vite-plugin-pwa`، همون نسخه‌ی ۸.۲۰.۰/۳.۰.۱) — امروز صریح/پین‌شده کردیم | `src/server/utils/jsonSchemaValidate.ts`، از اون‌جا در corePack `ai.llm-structured` و هر دو سندباکس (`util.validateSchema`) |
| `re2-wasm` | **جدید، ۲۰۲۶-۰۷-۱۶** | `src/server/utils/safeRegex.ts`، از اون‌جا در corePack `text.regex-match` و هر دو سندباکس (`util.regexMatch`) |
| `cron-parser` | قبلی | زمان‌بندی‌های سرور (خارج از scope این سند) |
| `adm-zip` / `jszip` | قبلی | استخراج/ساخت آرتیفکت‌های پکیج |
| `bcryptjs`, `jsonwebtoken`, `nodemailer` | قبلی | auth، ایمیل — خارج از scope این سند |

---

## قاعده‌ی کلی برای اضافه کردن یوتیلیتی جدید در آینده

اگر یک قابلیت جدید (مثلاً یک پارسر CSV یا یک تولیدکننده‌ی ID) نیاز شد:
1. اول در `src/server/utils/` یک پریمیتیو کانونیک بسازید (مثل الگوی `safeRegex.ts`/`jsonSchemaValidate.ts`) — یک‌بار، در کل پلتفرم قابل استفاده.
2. اگر لازمه در Server Functions هم در دسترس باشه، چون آن سندباکس یک رشته‌ی مستقل (`eval: true`) است، منطق باید **inline duplicate** بشه (نه import) — دقیقاً مثل کاری که برای `util.regexMatch`/`validateSchema` انجام شد.
3. اگر لازمه در Package API handlers هم در دسترس باشه، چون آن‌جا فایل TS واقعیه، مستقیم **import** کنید — چیزی رو duplicate نکنید.
4. هیچ‌وقت `require`/`import` خام رو در دسترس کد کاربر (سندباکس‌های بخش ۱ و ۲) قرار ندید — فقط تابع‌های صریح و bounded از طریق `util.*` یا مشابه.
