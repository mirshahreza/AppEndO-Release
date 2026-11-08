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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-91-mobile-apps-platform). ستون وضعیت در <a href="./p-00-next-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# p-91 — Mobile Apps Platform (Expo WebView host · branded ZIP)

> **فاز:** MAPP · **موکول** (`next/`) — طراحی قفل؛ اجرا در موج فعلی نیست  
> **اولویت:** — طراحی پلتفرم · غیر blocker  
> **وضعیت:** ⬜ موکول ۲۰۲۶-۰۸-۱۵ — موتور و تحویل قفل شد؛ اجرا شروع نشده  
> **کنترل:** [p-00-next-index.md](p-00-next-index.md) · ریلیز: [p-00-todo-index.md](../todo/p-00-todo-index.md)  
> **وابستگی مفهومی:** Portals / experience routing ✅ · Component Designer (اسکرین وب) ✅
> **استانداردهای مرتبط:** [`experience-routing.md`](../../../docs/architecture/experience-routing.md) · [`component-designer.md`](../../../docs/standards/component-designer.md) · [`dev-auth.md`](../../../docs/standards/dev-auth.md) · [`ui-core.md`](../../../docs/standards/ui-core.md)

---

## این سند چیست

ثبت تصمیم‌های محصول. **هنوز spec اجرایی / کد نیست.**

**موفقیت این موج طراحی:** اپراتور در استودیو هویت اپ را پر کند، زیپ تمپلیت Expo را بگیرد، خودش بیلد و استور کند؛ روی گوشی پورتال وب داخل WebView باز شود؛ اسکرین از سرور بیاید نه از داخل زیپ.

---

## گردش موتور (قفل ۲۰۲۶-۰۸-۱۵)

<table dir="rtl">
<thead><tr><th>قبل (۱۴ اوت)</th><th>بعد (۱۵ اوت)</th></tr></thead>
<tbody><tr><td>Host نیتیو = تفسیرکنندهٔ <strong>SDUI</strong> (درخت ویجت بسته + OTA JSON)</td><td>Host نیتیو = <strong>Expo + WebView</strong> روی پورتال وب موجود</td></tr>
<tr><td>اسکرین موبایل = catalog ویجت جدا از HeroUI</td><td>اسکرین = همان Client Components / پورتال استودیو</td></tr>
<tr><td>باینری manifest را رندر می‌کند</td><td>باینری URL پورتال را لود می‌کند</td></tr>
<tr><td>سؤال باز ۶: SDUI یا WebView؟</td><td><strong>WebView قفل</strong> — SDUI موتور v1 نیست</td></tr>
</tbody></table>

SDUI به‌عنوان مسیر بعدی فقط اگر WebView از نظر حس نیتیو یا ریویو استور ۴.۲ کافی نباشد. شِل Expo و ماژول‌های دوربین/لوکیشن/پوش دور ریخته نمی‌شوند؛ وسط WebView قابل تعویض است. **v1 را با SDUI نساز.**

کپی JSX/HeroUI به پروژهٔ React Native نکن — فایل استودیو آنجا اجرا نمی‌شود.

---

## مسئله

AppEndO پلتفرم است. اپراتور باید بدون برنامه‌نویس موبایل دائمی، اپ استور به کلاینت بدهد.

نیاز:

1. کاتالوگ **اپ‌های موبایل** در استودیو (ممکن است بیش از یکی)
2. یک **تمپلیت Expo** در ریپو که شِل نیتیو است (نه اسکرین)
3. شخصی‌سازی شِل از استودیو (برند، آیکون، URL پورتال، قابلیت‌های نیتیو)
4. **زیپ** برای اپراتور دیگر: خودش `eas build` و پابلیش استور
5. اسکرین‌ها همان پورتال وب؛ تأخیر ریویو استور قابل قبول است

هدف PO: **اینجا ساخت اسکرین و هویت اپ؛ روی گوشی باینری native.** PWA مسیر این محصول نیست.

---

## تز محصول (قفل)

<table dir="rtl">
<thead><tr><th>#</th><th>تصمیم</th></tr></thead>
<tbody><tr><td>1</td><td>استودیو = کارگاه ساخت اسکرین + پیکربندی شِل. دستگاه = IPA/AAB نیتیو، نه PWA و نه «Add to Home Screen»</td></tr>
<tr><td>2</td><td>موتور v1: <strong>Expo + WebView</strong> روی پورتال end-user پین‌شده — نه Studio، نه SDUI</td></tr>
<tr><td>3</td><td>اسکرین را در زیپ/باینری کپی نکن. WebView همان پورتال را از سرور می‌گیرد</td></tr>
<tr><td>4</td><td>کاستومایز استودیو روی <strong>شِل نیتیو</strong> است (برند، آیکون، splash، bundle id، <code dir="ltr" style="unicode-bidi: embed;">serverUrl</code>، مسیر پورتال، فلگ پلاگین) — نه کانواس اسکرین نیتیو</td></tr>
<tr><td>5</td><td>خروجی استودیو برای اپراتور: <strong>زیپ پروژهٔ Expo پیکربندی‌شده</strong> (بدون <code dir="ltr" style="unicode-bidi: embed;">node_modules</code> و بدون راز استور). بیلد و پابلیش با اپراتور است (<code dir="ltr" style="unicode-bidi: embed;">eas build</code> / <code dir="ltr" style="unicode-bidi: embed;">eas submit</code>)</td></tr>
<tr><td>6</td><td>تغییر اسکرین/منو/فرم = publish پورتال روی سرور. <strong>آپدیت استور لازم نیست</strong> مگر شِل نیتیو عوض شود (آیکون، نام، SDK، پل)</td></tr>
<tr><td>7</td><td>قابلیت نیتیو v1 در تمپلیت: <strong>دوربین + لوکیشن + پوش</strong> از طریق پل Expo (<code dir="ltr" style="unicode-bidi: embed;">postMessage</code> از صفحهٔ وب). Web Push داخل WebView کافی نیست</td></tr>
<tr><td>8</td><td>PWA موجود مال وب/استودیو می‌ماند؛ از دامنهٔ Mobile Apps خارج است. داخل WebView بنر نصب و Service Worker را خاموش کن (User-Agent مثلاً <code dir="ltr" style="unicode-bidi: embed;">AppEndOHost</code>)</td></tr>
<tr><td>9</td><td>یک تمپلیت کد (<code dir="ltr" style="unicode-bidi: embed;">mobile-host/</code>). چند اپ استودیو = چند زیپ پیکربندی از همان تمپلیت، نه فورک React Native به ازای مشتری</td></tr>
<tr><td>10</td><td>تأخیر پابلیش استور پذیرفته است. اولویت: اپراتور بدون نیروی موبایل دائمی خودش بیلد کند</td></tr>
</tbody></table>

---

## گردش تحویل

```
استودیو
  ├─ اسکرین / پورتال / شِل وب     ──publish──► سرور (همان تجربهٔ وب)
  └─ هویت اپ موبایل (برند، URL، فلگ‌ها) ──ZIP──► اپراتور
                                                  eas build → IPA/AAB → استور
گوشی: اپ Expo
         └── WebView → https://{serverUrl}{portalPath}
              └── پل نیتیو: camera · location · push
```

کاربر نهایی یک‌بار از استور نصب می‌کند. اسکرین جدید با باز کردن اپ از سرور می‌آید.

<table dir="rtl">
<thead><tr><th>چه عوض می‌شود</th><th>از کجا</th><th>زیپ / استور؟</th></tr></thead>
<tbody><tr><td>اسکرین، منو، فرم، متن، داده</td><td>پورتال / Data API</td><td><strong>خیر</strong></td></tr>
<tr><td>نام، آیکون، splash، bundle id، URL پورتال</td><td>استودیو → زیپ جدید</td><td><strong>بله</strong> (اپراتور بیلد می‌کند)</td></tr>
<tr><td>دوربین / لوکیشن / پوش (کد پل)، SDK Expo، باگ host</td><td>تمپلیت <code dir="ltr" style="unicode-bidi: embed;">mobile-host/</code></td><td><strong>بله</strong></td></tr>
</tbody></table>

---

## نگاشت به زیرساخت موجود

وب امروز سه محور دارد ([`experience-routing.md`](../../../docs/architecture/experience-routing.md)):

<table dir="rtl">
<thead><tr><th>محور وب</th><th>معادل موبایل v1</th></tr></thead>
<tbody><tr><td>Portal (end-user، نه <code dir="ltr" style="unicode-bidi: embed;">studio</code>)</td><td><strong>هدف WebView</strong> (<code dir="ltr" style="unicode-bidi: embed;">portalPath</code>)</td></tr>
<tr><td>Shell / صفحات / Client Components</td><td><strong>اسکرین روی سرور</strong> — همان‌ها</td></tr>
<tr><td>کاتالوگ استودیو Mobile Apps</td><td><strong>هویت باینری</strong> (برند + bundle id + URL)</td></tr>
<tr><td>PWA / <code dir="ltr" style="unicode-bidi: embed;">PwaManager</code></td><td><strong>خارج</strong> — داخل WebView غیرفعال</td></tr>
</tbody></table>

الگوی آماده:

- Portals CRUD — [`src/features/platform-portals/`](../../../src/features/platform-portals/)
- Client Components — اسکرین را اینجا بساز؛ برای موبایل پورتال را موبایل‌دوست نگه دار (Tier M)
- Auth مرورگر: کوکی HttpOnly `SameSite=Lax` — داخل WebView **همان origin** کار می‌کند؛ Bearer جدا برای v1 لازم نیست
- تصمیم AE-3.1: **بدون** جدول `base_applications`

**تله:** دیزاینر/JSON اسکرین نیتیو جدا نساز. دو استودیو می‌گیری که از هم جا می‌مانند.

**جهت درست:** یک پورتال وب؛ host فقط آن را نشان می‌دهد و سخت‌افزار را پل می‌کند.

---

## تمپلیت Expo (`mobile-host/`)

یک پروژه در ریشهٔ ریپو با `package.json` جدا (Metro را با Vite قاطی نکن).

ثابت در کد (اپراتور عوض نمی‌کند):

- WebView تمام‌صفحه، بدون نوار آدرس
- Back اندروید → تاریخچهٔ WebView
- User-Agent سفارشی (`AppEndOHost`)
- صفحهٔ آفلاین نیتیو ساده (کمک به ریویو اپل ۴.۲)
- پل: `expo-camera` · `expo-location` · `expo-notifications`

پر می‌شود از استودیو قبل از زیپ:

<table dir="rtl">
<thead><tr><th>فیلد</th><th>مثال</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">name</code> / نمایشی</td><td>Acme Shop</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">ios.bundleIdentifier</code> / <code dir="ltr" style="unicode-bidi: embed;">android.package</code></td><td><code dir="ltr" style="unicode-bidi: embed;">com.acme.shop</code></td></tr>
<tr><td>آیکون ۱۰۲۴ · splash</td><td>دارایی برند</td></tr>
<tr><td>رنگ نوار / تاکید</td><td>از اسلات brand</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">extra.serverUrl</code></td><td><code dir="ltr" style="unicode-bidi: embed;">https://acme.example</code></td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">extra.portalPath</code></td><td><code dir="ltr" style="unicode-bidi: embed;">/us/shop</code></td></tr>
<tr><td>فلگ <code dir="ltr" style="unicode-bidi: embed;">camera</code> / <code dir="ltr" style="unicode-bidi: embed;">location</code> / <code dir="ltr" style="unicode-bidi: embed;">push</code></td><td>روشن/خاموش</td></tr>
</tbody></table>

### اسلات کاستومایز استودیو (شِل، نه اسکرین)

<table dir="rtl">
<thead><tr><th>اسلات</th><th>داخل زیپ</th></tr></thead>
<tbody><tr><td>Brand</td><td>نام، لوگو/آیکون، splash، رنگ تاکید</td></tr>
<tr><td>Target</td><td><code dir="ltr" style="unicode-bidi: embed;">serverUrl</code> + <code dir="ltr" style="unicode-bidi: embed;">portalPath</code></td></tr>
<tr><td>Native</td><td>فلگ دوربین / لوکیشن / پوش</td></tr>
</tbody></table>

خانه / هدر / سایدمنو **وب** هستند (شِل پورتال)، نه اسلات باینری.

### محتویات زیپ / ممنوع

**باشد:** سورس تمپلیت + `app.json`/`app.config.ts` پرشده + آیکون/splash + README بیلد (`npm i`, `eas build`, `eas submit`).

**نباشد:** `node_modules` · گواهی Apple · کلید Play · توکن Expo · `google-services.json` پر. پوش در کد هست؛ روشن شدن واقعی بعد از اتصال حساب Expo/استورِ همان اپراتور است.

اپراتور: Node + حساب Expo + (برای iOS) Apple Developer. برنامه‌نویس React Native لازم نیست.

---

## استور (واقعیت قفل‌شده، نه تضمین)

باینری **اپ برندشده با پورتال پین** است نه مرورگر عمومی.

- **Play:** معمولاً نرم‌تر؛ مخاطب کودک / Families با WebView رد می‌شود — هدف v1 بزرگسال/کسب‌وکار.
- **App Store (۴.۲):** پوستهٔ خالی «فقط URL» ریسک رد بالا. minimun v1 برای کاهش ریسک: بدون کروم مرورگر، اسپلاش/آیکون اختصاصی، پوش + دوربین + لوکیشن، صفحهٔ آفلاین نیتیو، لینک بیرون به سافاری نداشته باشد. پوش به‌تنهایی از نظر اپل کافی نیست.
- تضمین پابلیش نیست. رد ۴.۲ معمولاً اصلاح و سابمیت دوباره است.

Host چنداپ که هر سایتی را باز کند برای استور مشتری نساز. داخلی/TestFlight جدا نگه دار اگر لازم شد.

---

## Hello World (تعریف موفقیت موج اول اجرا)

نام کاری: **`ref-hello-mobile`**.

**استودیو**

1. صفحهٔ **Mobile Apps**
2. اپ `hello`: برند حداقلی + `serverUrl` + `portalPath` به یک پورتال end-user موجود
3. فلگ‌های دوربین / لوکیشن / پوش (می‌توانند برای hello روشن باشند حتی اگر اسکرین وب هنوز پل را صدا نزند)
4. دانلود زیپ پیکربندی‌شده

**اپراتور / دستگاه**

5. `npm i` → `eas build` (یا `expo run:` روی دستگاه dev)
6. اپ پورتال را در WebView باز کند؛ لاگین وب همان origin بماند
7. تغییر یک صفحه در استودیو → باز کردن مجدد اپ بدون بیلد جدید همان را نشان دهد

Preview دسکتاپ شبیه گوشی ابزار سازنده است — خروجی محصول نیست.

---

## ترتیب ساخت (پیشنهادی)

```
1. App catalog در استودیو
2. قرارداد پیکربندی شِل (فیلدهای زیپ / extra)
3. ویزارد کاستومایز + دانلود ZIP
4. تمپلیت mobile-host (WebView + آفلاین + سه پل)
5. Hello World: زیپ → بیلد دستگاه → OTA اسکرین از پورتال
6. در AppEndO: خاموش کردن PWA/SW برای User-Agent host
```

تمپلیت Expo می‌تواند موازی با کاتالوگ شروع شود. renderer ویجت SDUI را در این ترتیب نگذار.

---

## Scope

### IN

<table dir="rtl">
<thead><tr><th>ID</th><th>کار</th></tr></thead>
<tbody><tr><td><strong>MAPP-0</strong></td><td>همین سند — تز، گردش از SDUI، Hello World</td></tr>
<tr><td><strong>MAPP-1</strong></td><td>قرارداد پیکربندی شِل (فیلدهای <code dir="ltr" style="unicode-bidi: embed;">app.config</code> / زیپ) + رابطه با portal URL</td></tr>
<tr><td><strong>MAPP-2</strong></td><td>کاتالوگ استودیو Mobile Apps</td></tr>
<tr><td><strong>MAPP-3</strong></td><td>ویزارد اسلات brand / target / native flags</td></tr>
<tr><td><strong>MAPP-4</strong></td><td>تولید ZIP از تمپلیت</td></tr>
<tr><td><strong>MAPP-5</strong></td><td>Preview دسکتاپ (اختیاری — chrome موبایل روی همان پورتال)</td></tr>
<tr><td><strong>MAPP-6</strong></td><td>Hello World: زیپ + WebView روی پورتال</td></tr>
<tr><td><strong>MAPP-H</strong></td><td><code dir="ltr" style="unicode-bidi: embed;">mobile-host/</code> · WebView · آفلاین · پل camera/location/push</td></tr>
</tbody></table>

### OUT (عمدی)

- PWA به‌عنوان خروجی Mobile Apps
- SDUI / catalog ویجت نیتیو در v1
- کپی اسکرین وب یا JSX داخل زیپ / پروژهٔ React Native
- کپی کامل palette Component Designer روی موبایل
- بیلد EAS روی سرور AppEndO در v1 (کلید استور دست اپراتور می‌ماند)
- جدول Prisma `base_applications`
- جایگزینی Portals وب یا ادغام اجباری با بک‌لاگ App Builder جدا
- چند موتور native (Capacitor موازی، RN Web برای کل استودیو)
- مخاطب کودک / Families روی Play

UI استودیو: primitives از Base Components (`/studio/base-components`). صفحهٔ کاتالوگ احتمالاً Tier M مطابق [`ui-core.md`](../../../docs/standards/ui-core.md) §Responsive.

---

## persistence پیشنهادی (باز — قفل با MAPP-1)

جهت، نه schema نهایی:

- فایل‌های registry شبیه portals — نه مدل کنترل‌پلن جدید
- هویت اپ: slug پایدار، نه draft-id دیزاینر
- هدف WebView: `serverUrl` + `portalPath` (فرهنگ از URL پورتال، مثلاً `/us/shop`)
- `ApplicationScopeRef` موجود را گسترش بده اگر scope لازم شد؛ جدول اپ نساز

جزئیات فیلدها → MAPP-1.

---

## فازهای اجرایی

<table dir="rtl">
<thead><tr><th>ID</th><th>وضعیت</th><th>توضیح</th></tr></thead>
<tbody><tr><td>MAPP-0 Design capture</td><td>⬜ موکول</td><td>این سند · موتور WebView قفل · اجرا در موج ۶ نیست</td></tr>
<tr><td>MAPP-1 Host config contract</td><td>⬜</td><td>فیلدهای زیپ + portal URL</td></tr>
<tr><td>MAPP-2 Studio catalog</td><td>⬜</td><td>list + create؛ Base Components</td></tr>
<tr><td>MAPP-3 Shell slots wizard</td><td>⬜</td><td>brand / target / native flags</td></tr>
<tr><td>MAPP-4 ZIP export</td><td>⬜</td><td>تمپلیت + دارایی · بدون اسرار</td></tr>
<tr><td>MAPP-5 Studio preview</td><td>⬜</td><td>اختیاری</td></tr>
<tr><td>MAPP-6 Hello World closeout</td><td>⬜</td><td>زیپ → دستگاه → اسکرین از سرور</td></tr>
<tr><td>MAPP-H Expo template</td><td>⬜</td><td><code dir="ltr" style="unicode-bidi: embed;">mobile-host/</code> · WebView · سه پل · آفلاین</td></tr>
</tbody></table>

---

## ادامه از اینجا

قفل این دور: Expo + WebView · زیپ برای اپراتور · اسکرین روی سرور · دوربین/لوکیشن/پوش در شِل · SDUI موتور v1 نیست · PWA خارج است.

باقی سؤال‌ها:

1. **رابطه با Portal:** ردیف Mobile App فقط URL پورتال را نگه می‌دارد، یا portal با `channel: mobile`؟
2. **جای استودیو:** Development کنار Portals؟ `pageKey` = `mobile-apps`
3. **Hello World روی دیسک:** registry یا پکیج `ref-hello-mobile`
4. **پل JS:** قرارداد `postMessage` پایدار برای اسکرین‌های وب (چه APIای از پورتال به host)
5. **پوش سمت سرور:** ذخیرهٔ توکن دستگاه + ارسال (Expo Push) — بعد از تمپلیت
6. **Host داخلی چنداپ:** فقط TestFlight یا اصلاً در v1 نباشد؟

---

## لاگ

<table dir="rtl">
<thead><tr><th>تاریخ</th><th>خلاصه</th></tr></thead>
<tbody><tr><td>۲۰۲۶-۰۸-۱۵</td><td><strong>موکول</strong> — از <code dir="ltr" style="unicode-bidi: embed;">todo/</code> به <code dir="ltr" style="unicode-bidi: embed;">next/</code> · موج ۶ رویش کار نمی‌شود</td></tr>
<tr><td>۲۰۲۶-۰۸-۱۵</td><td><strong>گردش موتور</strong> — SDUI از v1 خارج · Expo + WebView روی پورتال · زیپ تمپلیت برای بیلد اپراتور · پل camera/location/push · اسکرین داخل زیپ ممنوع</td></tr>
<tr><td>۲۰۲۶-۰۸-۱۴</td><td><strong>قفل هدف</strong> — ساخت در استودیو · خروجی IPA/APK native · OTA تجربه · PWA خارج</td></tr>
<tr><td>۲۰۲۶-۰۸-۱۴</td><td><strong>تحویل روی گوشی</strong> — یک host / N اپ · PWA استودیو آرتیفکت اشتباه</td></tr>
<tr><td>۲۰۲۶-۰۸-۱۴</td><td><strong>ایجاد</strong> — تز پلتفرم، نگاشت Portal/Shell، نقش SDUI (بعداً جایگزین شد)، تمپلیت drawer، Hello World</td></tr>
</tbody></table>


</div>
