# Identity Providers — Dev & Staging Runbook

Operator guide for configuring OAuth/OIDC identity providers in AppEndO. Architecture: [`identity-engine.md`](../architecture/identity-engine.md).

---

## Prerequisites

```bash
npm run setup          # dev DB + settings
npm run dev            # Vite UI (typically http://localhost:5173)
```

The API must serve OAuth callbacks on the same host registered in your IdP. Example redirect URIs:

```text
http://localhost:3000/api/auth/oauth/google/callback
http://localhost:3000/api/auth/oauth/github/callback
http://localhost:3000/api/auth/oauth/microsoft/callback
http://localhost:3000/api/auth/oauth/oidc/callback
```

The `providerId` segment in the URL is the **`id`** field in Settings (not `kind`).

---

## Google OAuth (dev)

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create OAuth client: **Web application**
3. Authorized redirect URIs: match `redirectUri` exactly (see above)
4. Settings → **Identity Providers** → Google → Config:
   - `id`: `google` (or your slug)
   - `clientId` / `clientSecret`
   - `enabled`: true · `autoProvision`: true (dev)
   - `defaultRoleId`: `role_user`
5. **Test connection** → Save → Login → **Sign in with Google**

---

## GitHub OAuth (dev)

1. GitHub → Settings → Developer settings → OAuth Apps → New
2. Authorization callback URL = `redirectUri`
3. Settings → GitHub → same credential fields
4. Users need a **verified primary email** (`user:email` scope is included in the adapter)

---

## Microsoft Entra ID / Azure AD (OIDC)

| Field | Value |
|-------|-------|
| `kind` | `microsoft-oauth` |
| `issuerUrl` | `https://login.microsoftonline.com/common/v2.0` (or `organizations` / `{tenant-id}`) |
| Redirect URI | `/api/auth/oauth/{id}/callback` |

1. [Azure Portal](https://portal.azure.com/) → Microsoft Entra ID → App registrations → New
2. Platform: **Web** → Redirect URI = full callback URL
3. Create a client secret under Certificates & secrets
4. Settings → **Microsoft** → fill `clientId`, `clientSecret`, `issuerUrl`, `redirectUri`
5. Test connection → enable → login

**Tenant notes:**

| `issuerUrl` suffix | Use case |
|--------------------|----------|
| `/common/v2.0` | Multi-tenant + personal Microsoft accounts |
| `/organizations/v2.0` | Work/school only |
| `/{tenant-id}/v2.0` | Single tenant |

---

## OIDC Generic (Keycloak · Auth0 · Okta · Authentik · …)

| Field | Value |
|-------|-------|
| `kind` | `oidc-generic` |
| `issuerUrl` | IdP issuer (discovery at `{issuerUrl}/.well-known/openid-configuration`) |

**Example issuer URLs (dev):**

| IdP | `issuerUrl` |
|-----|-------------|
| Keycloak (realm `appendo`) | `http://localhost:8080/realms/appendo` |
| Auth0 | `https://{tenant}.eu.auth0.com/` |
| Okta (default auth server) | `https://{org}.okta.com/oauth2/default` |

1. Register an OIDC client in your IdP with the AppEndO callback URL
2. Settings → **OIDC (Generic)** → `issuerUrl` + credentials
3. Test connection → enable → login

---

## Staging / production rollout

1. **HTTPS required** for callback URLs
2. Store `clientSecret` only in settings file or secret store — API responses redact secrets
3. Rollout: `enabled: false` → configure → **Test connection** → set `enabled: true`
4. Audit events: `OAUTH_LOGIN_SUCCESS`, `OAUTH_LINK_DENIED` in session audit
5. Rotate secrets in IdP console, then update Settings (old secret invalidated immediately)

---

## Example config (redacted)

```json
{
  "auth": {
    "identityProviders": [
      {
        "id": "google",
        "kind": "google-oauth",
        "label": "Google",
        "enabled": true,
        "autoProvision": true,
        "defaultRoleId": "role_user",
        "clientId": "YOUR_CLIENT_ID",
        "clientSecret": "YOUR_CLIENT_SECRET",
        "redirectUri": "https://app.example.com/api/auth/oauth/google/callback"
      },
      {
        "id": "microsoft",
        "kind": "microsoft-oauth",
        "label": "Microsoft",
        "enabled": true,
        "autoProvision": false,
        "defaultRoleId": "role_user",
        "clientId": "YOUR_CLIENT_ID",
        "clientSecret": "YOUR_CLIENT_SECRET",
        "redirectUri": "https://app.example.com/api/auth/oauth/microsoft/callback",
        "issuerUrl": "https://login.microsoftonline.com/organizations/v2.0"
      },
      {
        "id": "keycloak",
        "kind": "oidc-generic",
        "label": "Keycloak",
        "enabled": true,
        "autoProvision": true,
        "defaultRoleId": "role_user",
        "clientId": "appendo",
        "clientSecret": "YOUR_CLIENT_SECRET",
        "redirectUri": "https://app.example.com/api/auth/oauth/keycloak/callback",
        "issuerUrl": "https://idp.example.com/realms/appendo"
      }
    ]
  }
}
```

See also `settings.example.json` → `auth.identityProviders`.

---

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `oauth_denied` | User cancelled or IdP policy blocked | Retry · check consent screen / conditional access |
| `oauth_state` | Stale tab · expired state · multi-instance without sticky sessions | Single tab · check state TTL |
| `oauth_provider` | Wrong secret · redirect mismatch | **Test connection** · match callback URL exactly in IdP console |
| `oauth_no_account` | `autoProvision` off | Enable auto-provision or link identity in DB |
| `oauth_link_denied` | `email_verified=false` | Verify email at IdP |
| Test connection fails | Network · discovery down | Firewall/proxy · server logs |
| Redirect URI test error | Path does not match provider `id` | Must end with `/api/auth/oauth/{id}/callback` |

UI messages: `OAUTH_ERROR_MESSAGES` in `src/features/settings/components/identityProviders/constants.ts`.

---

## Manual E2E checklist

> **ثبت و تیک:** جدول زیر — سناریو × provider (Google · GitHub · Microsoft · OIDC).

| # | Scenario | Google | GitHub | Microsoft | OIDC |
|---|----------|--------|--------|-----------|------|
| 1 | Test Connection after save | ☐ | ☐ | ☐ | ☐ |
| 2 | Login → IdP → callback → session | ☐ | ☐ | ☐ | ☐ |
| 3 | `autoProvision: true` — new user | ☐ | ☐ | ☐ | ☐ |
| 4 | `autoProvision: false` — `oauth_no_account` | ☐ | ☐ | ☐ | ☐ |
| 5 | Verified email merges to existing user | ☐ | ☐ | ☐ | ☐ |
| 6 | Cancel at IdP → `oauth_denied` | ☐ | ☐ | ☐ | ☐ |
| 7 | Expired state → `oauth_state` | ☐ | ☐ | ☐ | ☐ |
| 8 | Disable provider → button removed from Login | ☐ | ☐ | ☐ | ☐ |

*(ردیف‌های 9–14 و فرم محیط اجرا در همین runbook.)*

---

## Separation from Git OAuth

| Flow | Type | Notes |
|------|------|-------|
| App login | `identity-provider` | This guide |
| GitHub repo connection | `integration` | Separate client + redirect — never share credentials |

---

*p-55 Identity Providers hardening · IDP runbook*
