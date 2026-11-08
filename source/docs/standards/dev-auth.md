# Development auth preset

> **Shard:** `dev-auth`

During active development, auth stays on **simple username/password** — no login OTP, email-verify gate, or public registration.

- Preset: `M0_DEV_SIMPLE_AUTH_PRESET` in `src/server/config/m0DevAuthPreset.ts`.
- Enforced on non-production boot (`ensureDevSimpleAuthSettings`) and `npm run setup`.
- Do **not** enable `authOtpEnabled`, `authEmailVerifyRequired`, or `authRegistrationEnabled` in Settings/seeds/AI unless task is auth E2E testing (`M0_DEV_AUTH_PRESET` in test harness only).
- Production/staging operators enable OTP/verification in Settings when needed.

## Browser session persistence (locked — do not regress)

**Goal:** stay signed in across tab close, reboot, and access-token expiry (15 min) while refresh token remains valid (7 days).

| Layer | Rule |
|-------|------|
| **Storage** | `access_token` + `refresh_token` in **HttpOnly** `SameSite=Lax` cookies only — **never** `localStorage` / `sessionStorage` for JWTs. |
| **Boot** | `AuthProvider` → `restoreBrowserSession()` in `src/shared/api/authSession.ts`: `GET /api/auth/me` → if no user, **one** silent `POST /api/auth/refresh` → `GET /me` again. |
| **Runtime** | `apiFetch` refreshes on **401** for non-exempt `/api` routes (not on `/me` — boot restore owns that path). |
| **Server** | Refresh rotation + DB row in `base_auth_refresh_tokens`; failed refresh clears cookies (`clearCookies: true`). |

**Do not:**

- Call `/api/auth/me` directly from `checkSession` without `restoreBrowserSession`.
- Remove `/api/auth/me` from reactive refresh **or** add proactive refresh on every page load (both waste rotation or break boot).
- Reintroduce client-side access-token storage.
- Persist username/password in `localStorage` / `sessionStorage`. The login form must let the **browser password manager** save credentials.

**Regression lock:** `src/shared/api/__tests__/authSession.restore.test.ts` · ids `auth.dev.simple-login-preset`, `auth.session.browser-restore` · `.cursor/rules/feature-auth-session.mdc`.

## Browser password manager (login form)

Sign-in is a JSON SPA POST, so Chrome/Safari will not offer “save password” unless the form looks like a real login form:

- `<form method="post" action="/login">` (still `preventDefault` + `/api/auth/login`). Default `method="get"` blocks save.
- Username: `name="username"` `autocomplete="username"` `type="text"` `autoDir={false}`.
- Password: `name="password"` `autocomplete="current-password"` (keep `type="password"` at rest).
- Keep those fields in the DOM through submit (hide, do not unmount, during OTP).
- After successful sign-in, call `storeBrowserLoginCredentials` (`navigator.credentials.store` / `PasswordCredential`) without blocking navigation so Chromium can offer to save. Firefox/Safari use the form markup instead. Do not add an in-page “save password” checkbox.

**ID:** `auth.login.browser-password-manager`  
**Regression lock:** `src/pages/__tests__/Login.test.tsx` · `src/features/auth/__tests__/storeBrowserLoginCredentials.test.ts`
