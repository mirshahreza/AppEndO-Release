# Hawiety locale & AppEndO-Hawiety repo language policy

> **Shard:** `package-hawiety-locale-policy`  
> **Audience:** AI agents, translators, release-cut.

## Rule (locked)

| Surface | Language | Script notes |
|---------|----------|----------------|
| **End-user Hawiety UI** (public portal, member flows, `hawiety.iq` overlay, portal About, shell `windowTitle` for hawiety) | **Arabic** (Iraq product copy) | Use Arabic letters (e.g. **هويتي**), not Persian spellings (**هویتی**). |
| **Hawiety Studio UI** when culture is `iq` | **Arabic** | Same as public portal vocabulary. |
| **Hawiety Studio UI** when culture is `us` | **English** | |
| **Repo-facing / not rendered in the app** | **English only** | README in `AppEndO-Hawiety`, `MANIFEST.json` notes, `scripts/release-cut/templates/AppEndO-Hawiety-README.md`, pack recipe descriptions, TS comments under Hawiety export paths, operator runbooks **in that repo**. |
| **Persian (Farsi)** | **Forbidden** in Hawiety product defaults, iq seeds, AppEndO-Hawiety templates, and Hawiety-branded portal shell fields. | Platform `ir` culture packs may stay Persian for non-Hawiety studio; do **not** add new Persian under `hawiety.*` keys or hawiety shell seeds. |

## AppEndO-Hawiety repository

Private deploy snapshot (`release:export-appendo-hawiety` → `AppEndO-Hawiety`):

- **Must not** introduce Persian prose in Hawiety-owned artifacts (see table).
- Full `source/` snapshot may still contain platform `ir` overlays; new Hawiety work must not expand Persian there.

## Agent checklist

1. Portal / package default brand: English catalog title in Settings; live member chrome uses **culture `iq`** strings.
2. Never use Persian **ی** in the product name chrome — use Arabic **ي** (**هويتي**).
3. Docs committed **for operators inside AppEndO-Hawiety** → English.
4. On release push, spot-check generated `README.md` in staging for Persian; fail fix before push if Hawiety templates regressed.

## Cross-links

- UI words: [`package-hawiety-ui-vocab.md`](./package-hawiety-ui-vocab.md)  
- Release repos: [`release-cut.md`](./release-cut.md)
