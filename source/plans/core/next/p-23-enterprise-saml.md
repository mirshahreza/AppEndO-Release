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

<p><strong>خلاصه برای operatore:</strong> این سند جزو <strong>plans</strong> است (p-23-enterprise-saml). ستون وضعیت در <a href="./p-00-next-index.md">index مربوطه</a> مرجع «شروع شده / design / تمام» است.</p>
<p><strong>راهنمای خواندن:</strong> بخش‌های انگلیسی برای agent/dev هستند؛ جداول وضعیت و یادداشت‌های فارسی را اول بخوانید.</p>


# p-23 — Enterprise SAML

> **فاز:** P4b · **ریلیز بعدی** (`plans-next`)  
> **اولویت:** ۵ در next-wave — گسترش زیرساخت p-21 · همان دامنه identity  
> **وضعیت:** ⬜ — **موکول از ریلیز فعلی** · کنترل: [p-00-next-index.md](p-00-next-index.md)  
> **شماره آرشیو:** p-22 · p-next-22  
> **وابستگی:** Identity OAuth ✅ · [`identity-engine.md`](../../../docs/architecture/identity-engine.md)

---

## هدف

پشتیبانی SAML 2.0 برای enterprise SSO — همان **System Extension** تایپ `identity-provider` با `providerKind: saml` (نه Package).

مرجع معماری: [`docs/architecture/identity-engine.md`](../../../docs/architecture/identity-engine.md) · [`docs/architecture/system-extensions.md`](../../../docs/architecture/system-extensions.md)

```text
Core Identity Engine (SAML branch)
        ↓
identity-provider extensions: Okta · Azure AD · Google Workspace · custom SAML
```

---

## پیش‌نیازها

- p-21: Identity Engine · `ProviderRegistry` · `base_user_identities` · `IdentityLinkService` · `AccountProvisioner`
- P4a OAuth بدون regression

---

## محدوده

### Scope IN

- SAML به عنوان `type: identity-provider` · `providerKind: saml`
- Builtin extensions (in-tree, signed, trusted):
  - `saml-okta` · `saml-azure-ad` · `saml-google-workspace` · `saml-custom` (یا `kind: saml` + operator label)
- Operator config در `auth.identityProviders[]` (`kind: saml`)
- فیلدها: metadata XML یا entryPoint · certificate · issuer
- Core: AuthnRequest redirect · assertion validation orchestration
- Extension adapter: attribute mapping · IdP quirks
- `POST /api/auth/saml/:id/acs` (Assertion Consumer Service)
- SP metadata endpoint
- Settings CRUD + Test (limited)
- autoProvision + attribute mapping (email · name) — **Core** `AccountProvisioner`

### Scope OUT

- SCIM provisioning
- multiple IdP per tenant (v1: one SAML provider entry)
- SAML via Packages hub / marketplace ZIP

---

## Provider config (operator — backward compatible)

```ts
{
  kind: 'saml';
  id: string;           // maps to extension id e.g. saml-okta
  label: string;
  enabled: boolean;
  entryPoint: string;
  issuer: string;
  cert: string;
  metadataUrl?: string;
  autoProvision: boolean;
  defaultRoleId?: string;
}
```

---

## Runtime

Core owns session issuance; extension supplies SAML adapter (`SamlIdentityProviderAdapter` in `systemExtensions/types.ts`).

```
GET  /api/auth/saml/:id/login     → Core redirect to IdP (adapter builds AuthnRequest URL)
POST /api/auth/saml/:id/acs       → Core validates · adapter maps attributes → IdentityLinkService → SessionIssuer
GET  /api/auth/saml/:id/metadata  → SP metadata XML
```

Capability مجاز برای SAML extension: `auth.read` · `auth.callback` · `claims.map` · `profile.map`  
ممنوع: `db.write` · `filesystem.full` · `runtime.override`

---

## فایل‌های کلیدی

<table dir="rtl">
<thead><tr><th>مسیر</th><th>نقش</th></tr></thead>
<tbody><tr><td><code dir="ltr" style="unicode-bidi: embed;">src/core/identity/</code></td><td>SAML branch در OAuthFlowEngine یا <code dir="ltr" style="unicode-bidi: embed;">SamlFlowEngine</code></td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">src/core/system-extensions/identity-providers/saml-*</code></td><td>Okta · Azure AD · custom adapters</td></tr>
<tr><td><code dir="ltr" style="unicode-bidi: embed;">src/shared/api/contracts/systemExtensions/types.ts</code></td><td><code dir="ltr" style="unicode-bidi: embed;">SamlIdentityProviderAdapter</code></td></tr>
</tbody></table>

---

## معیار خروج

- [ ] SAML login end-to-end با IdP تست
- [ ] SAML providers registered as `identity-provider` System Extensions (not marketplace plugins)
- [ ] autoProvision + identity link via Core engine
- [ ] M0 + OAuth E2E بدون regression
- [ ] secrets/cert redacted در API
- [ ] Extensions cannot issue sessions or write DB directly

---

## تخمین

۲–۳ هفته

---

*سند پیاده‌سازی — Enterprise SAML · P4b · p-23*


</div>
