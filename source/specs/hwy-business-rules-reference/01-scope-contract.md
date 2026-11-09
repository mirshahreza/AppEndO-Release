<div dir="rtl" lang="fa" class="hwy-parity-doc">
<style>
  .hwy-parity-doc { text-align: right; unicode-bidi: plaintext; }
  .hwy-parity-doc h1, .hwy-parity-doc h2, .hwy-parity-doc h3, .hwy-parity-doc h4, .hwy-parity-doc p, .hwy-parity-doc li { text-align: right; }
  .hwy-parity-doc table { direction: rtl; text-align: right; width: 100%; border-collapse: collapse; margin: 0.75rem 0; }
  .hwy-parity-doc th, .hwy-parity-doc td { border: 1px solid #c4c4c4; padding: 0.35rem 0.5rem; vertical-align: top; text-align: right; }
  .hwy-parity-doc th { background: #f6f6f6; font-weight: 600; }
  .hwy-parity-doc blockquote { text-align: right; border-right: 3px solid #ccc; border-left: none; padding-right: 1rem; margin-right: 0; }
  .hwy-parity-doc ul, .hwy-parity-doc ol { padding-right: 1.25rem; padding-left: 0; }
</style>

<p><strong>خلاصه برای operatore:</strong> صفحهٔ Studio «مرجع قوانین الهوية» باید همیشه با <strong>رفتار واقعی محصول</strong> یکی باشد. اگر متن مرجع با آنچه در سیستم می‌بینید فرق دارد، قبل از تغییر کد به agent بگویید تصمیم بگیرد.</p>
<p><strong>راهنمای خواندن:</strong> قرارداد sync برای dev؛ شکاف feature در <a href="../../plans/packages/todo/hawiety-package/hwy-legacy-vs-appendo-feature-parity.md">parity</a>.</p>

# Hawiety — Identity business rules reference (مرجع قوانين الهوية)

> **Route:** `/…/hawiety/business-rules/<section-slug>` · **pageKey:** `hwy-business-rules-reference`  
> **Status:** Shipped (Studio reference UI + DB-backed Markdown)  
> **Updated:** 2026-11-04

---

## Purpose

Permanent **Arabic** reference for Hawiety membership logic (not backup/restore docs). Content lives in control-plane table `base_hwy_business_rule_docs`; nav structure is defined in code catalog + optional DB titles.

---

## Sync contract (MUST)

This reference **must stay aligned** with what the product actually does:

<table dir="rtl">
<thead><tr><th>Layer</th><th>Source of truth for *behavior*</th><th>Reference role</th></tr></thead>
<tbody><tr><td>Business rules</td><td><code dir="ltr" style="unicode-bidi: embed;">src/server/domain/hwy/*</code>, <code dir="ltr" style="unicode-bidi: embed;">dbo.hwy_*</code> procs, domain modules under <code dir="ltr" style="unicode-bidi: embed;">src/domain/hwy/*</code></td><td>Document the <strong>effective</strong> rules operators and devs rely on</td></tr>
<tr><td>Section list / nav groups</td><td><code dir="ltr" style="unicode-bidi: embed;">src/domain/hwy/hwyBusinessRulesReferenceCatalog.ts</code></td><td>Slugs and grouping; seed and UI nav derive from here</td></tr>
<tr><td>Prose (titles, intros, bodies)</td><td>DB rows (+ <code dir="ltr" style="unicode-bidi: embed;">npm run hwy:business-rules:seed</code> from <code dir="ltr" style="unicode-bidi: embed;">scripts/hwy-phase3/culture/hwyBusinessRulesReferenceTranslations.ts</code>)</td><td>Editable in Studio by ADMIN/DEVELOPER; seed refreshes Arabic from script</td></tr>
</tbody></table>

When you **change** Hawiety behavior (validation, workflow step, field mask, list definition, etc.):

1. Implement the code/DB change.
2. **Update the matching business-rules section** (Markdown in DB via seed or edit), or add a catalog section + seed row if the surface is new.
3. Do **not** leave the reference stating rules that no longer match runtime.

---

## Contradiction / drift (operator gate)

If during implementation you discover **تناقض** between:

- legacy parity notes, this reference, the catalog, or
- what the code/SP actually enforces,

then:

1. **Stop** and **explain the conflict clearly to the operator** (what each side says, what code does today, recommended options).
2. **Do not** silently pick a side, add shims, or “fix” the doc without operator decision.
3. After the operator decides, apply **one** contract (code + reference + catalog/seed together).

---

## Key paths

<table dir="rtl">
<thead><tr><th>Area</th><th>Path</th></tr></thead>
<tbody><tr><td>UI</td><td><code dir="ltr" style="unicode-bidi: embed;">src/features/hwy-business-rules-reference/</code></td></tr>
<tr><td>Catalog (sections, groups, rule ids)</td><td><code dir="ltr" style="unicode-bidi: embed;">src/domain/hwy/hwyBusinessRulesReferenceCatalog.ts</code></td></tr>
<tr><td>API</td><td><code dir="ltr" style="unicode-bidi: embed;">src/server/routes/hwyBusinessRuleDocs.routes.ts</code> · <code dir="ltr" style="unicode-bidi: embed;">GET/PUT /api/hwy/business-rules/docs</code></td></tr>
<tr><td>Portal install</td><td><code dir="ltr" style="unicode-bidi: embed;">npm run hwy:business-rules:portal</code></td></tr>
<tr><td>Arabic seed</td><td><code dir="ltr" style="unicode-bidi: embed;">npm run hwy:business-rules:seed</code></td></tr>
<tr><td>IQ culture overlay</td><td><code dir="ltr" style="unicode-bidi: embed;">src/core/system-extensions/culture-packs/overlays/hawiety.iq.json</code> (nav + section keys)</td></tr>
</tbody></table>

---

## Agent reminder

Load this file when touching **Hawiety domain behavior** or **business-rules reference** content. Treat doc drift as a **blocking product issue**, not optional polish.

Cross-shard domain invariants (electoral geo — process vs direct assignment, one level): [`docs/standards/package-hawiety-domain-invariants.md`](../../docs/standards/package-hawiety-domain-invariants.md).


</div>
