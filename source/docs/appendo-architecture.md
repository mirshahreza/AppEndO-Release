# معماری AppEndO

این سند خلاصهٔ معماری محصول را از زاویهٔ پلتفرم، runtime و deployment توضیح می‌دهد. جزئیات ریزتر معماری کد در [src/ARCHITECTURE.md](../src/ARCHITECTURE.md) و زیرسندهای `docs/architecture/` نگه‌داری می‌شوند.

## هدف معماری

AppEndO یک پلتفرم self-hosted برای ساخت و اجرای اپلیکیشن‌های سازمانی است. تمرکز معماری روی این محور‌هاست:

- runtime محلی و self-hosted
- جداسازی backend کنترل‌پلین از داده‌ها و packageها
- پشتیبانی از portal، studio و تجربه‌های front-office
- بسته‌بندی و نصب‌پذیری قابلیت‌ها به‌صورت ZIP
- توسعه و استقرار چند-node بدون وابستگی به CDN یا سرویس خارجی runtime

## نمای کلی لایه‌ها

| لایه | نقش |
| --- | --- |
| Client app | React SPA برای studio و صفحات اصلی |
| Server | Express/Node.js برای API، auth، orchestration و package runtime |
| Control plane | PostgreSQL برای users, roles, settings, registry و metadata |
| Edge/runtime data | data sourceهای متصل، package storage و artifactهای نصب‌شده |
| Packages | ZIPهای قابل انتقال برای extensions و vertical apps |

## اصول کلیدی

1. **Local-first**: هر چیزی که اپ در runtime استفاده می‌کند باید لوکال نگه داشته شود.
2. **Package-first**: قابلیت‌ها به‌صورت بسته ساخته، نسخه‌بندی و نصب می‌شوند.
3. **Portal-aware routing**: فرهنگ، portal و page سه محور اصلی مسیریابی هستند.
4. **Core vs ecosystem**: هستهٔ پلتفرم با packageهای اکوسیستم و vertical appها قاطی نمی‌شود.

## آنچه از MVP مشخص است

- studio برای مدیریت کاربران، roles، settings، data sources، logs، cache، jobs و workflows وجود دارد.
- component designer و server functions به‌عنوان ابزار توسعهٔ داخل پلتفرم در core قرار دارند.
- packages hub برای install / build / export ZIP و port کردن قابلیت‌ها بین nodeها استفاده می‌شود.
- experience routing بر پایهٔ culture × portal × page است.
- multi-node deployment با نقش‌های service / platform / worker طراحی شده است.

## سندهای مرتبط

- [فیچرلیست MVP](appendo-features.md)
- [runtime artifacts](architecture/artifacts.md)
- [experience routing](architecture/experience-routing.md)
- [multi-node deployment](architecture/multi-node-deployment.md)
- [system extensions vs packages](architecture/system-extensions.md)