# Greenfield — no backward compatibility

> **Shard:** `greenfield`

AppEndO is initial implementation. Ship one canonical contract per feature.

## Forbidden
- Runtime migration on startup/read/write.
- Dual-format parsers (`normalizeLegacy*`, `readLegacy*`, `merge*FromLegacy`).
- Deprecated config fallbacks and legacy API route aliases.
- Auto-migrate on-disk artifacts on read.
- `@deprecated` shims to avoid updating call sites.
- Parallel legacy UI modes.
- Migration scripts wired into `npm run setup`, boot, or scheduled jobs.

## Instead
- Breaking changes OK: update contract, DDL, routes, call sites in one change.
- Seed from defaults (`settings.example.json`, `initDB()` DDL).
- Delete retired symbols in the same PR.
- Validate strictly at boundaries; reject unknown payloads.

## Narrow exceptions
- Third-party terms (e.g. `openai-compatible`) and test fixture names.
- Manual `scripts/` tools labeled one-time/out-of-band only.
- Scoped approved tasks may add migration tooling explicitly.

## Platform extensions
- **Identity providers** ship as in-tree System Extensions (`src/core/system-extensions/identity-providers/`) — not Package ZIPs.
- **Other System Extensions** (`culture-pack`, `storage-adapter`, …) may use signed ZIP packs without app rebuild (future).
- **Package** ZIPs sandboxed; cannot register IdP login adapters.
- Core owns auth flow/session; extension supplies adapter; config in `auth.identityProviders[]`.

**IDs:** `platform.greenfield.no-backward-compat`, `platform.zip-extension-growth`, `platform.identity-provider.zip-not-plugin`.
