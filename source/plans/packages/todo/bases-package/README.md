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

<p><strong>خلاصه برای operatore:</strong> فهرست اسناد پوشهٔ <strong>bases-package</strong> — از README به پلن اصلی و promptهای فاز لینک می‌شود.</p>


# Bases package — execution docs

> **Master plan:** [p-packages-bases.md](./p-packages-bases.md) (#117)  
> **Copy-paste prompts:** [bases-phase-execution-prompts.md](./bases-phase-execution-prompts.md)

## Phase documents (build in order)

<table dir="rtl">
<thead><tr><th>Order</th><th>Document</th><th>npm (when implemented)</th></tr></thead>
<tbody><tr><td>1</td><td><a href="./p-bases-phase-1-database-and-meta.md">p-bases-phase-1-database-and-meta.md</a></td><td><code dir="ltr" style="unicode-bidi: embed;">npm run bases:phase1</code> · rollback <code dir="ltr" style="unicode-bidi: embed;">bases:phase1:rollback</code></td></tr>
<tr><td>2</td><td><a href="./p-bases-phase-2-server-api.md">p-bases-phase-2-server-api.md</a></td><td><code dir="ltr" style="unicode-bidi: embed;">npm run bases:phase2</code> · rollback <code dir="ltr" style="unicode-bidi: embed;">bases:phase2:rollback</code></td></tr>
<tr><td>3a</td><td><a href="./p-bases-phase-3a-nav-and-bases.md">p-bases-phase-3a-nav-and-bases.md</a></td><td>part of <code dir="ltr" style="unicode-bidi: embed;">bases:phase3</code> / sub-phase rollback</td></tr>
<tr><td>3b</td><td><a href="./p-bases-phase-3b-grid-runtime.md">p-bases-phase-3b-grid-runtime.md</a></td><td>golden path: grid inline edit</td></tr>
<tr><td>3c</td><td><a href="./p-bases-phase-3c-kanban-gallery.md">p-bases-phase-3c-kanban-gallery.md</a></td><td>Kanban + Gallery</td></tr>
<tr><td>3d</td><td><a href="./p-bases-phase-3d-calendar-favorites.md">p-bases-phase-3d-calendar-favorites.md</a></td><td>Calendar + favorites pin</td></tr>
</tbody></table>

## Entry commands (folder)

```
@plans/packages/todo/bases-package برو جلو
@plans/packages/todo/bases-package فاز ۱ بساز
@plans/packages/todo/bases-package فاز ۲ بساز
@plans/packages/todo/bases-package زیر‌فاز 3a بساز
```

Rollback semantics: see master plan §«فازهای پیاده‌سازی».


</div>
