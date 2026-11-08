# Experience Routing

AppEndO routes operator and end-user traffic through three axes:

| Axis | Meaning | URL example |
|------|---------|-------------|
| **Culture** | Locale, calendar, direction, translations | `/ir/studio/users` → culture `ir` |
| **Portal / Shell** | Layout, nav renderer, outlet | `/ir/studio/users` → portal `studio` (shell `admin`) |
| **Page** | Page module inside the portal | `/ir/studio/users` → page `users` |

> **Naming:** **Portal** is the routing axis (URL segment `studio` is the built-in studio portal). **Design packs** (`/api/themes`, `src/features/themes/`) are visual token ZIPs — unrelated to portal routing.

## Canonical URL shape

```text
/{culture?}/{portal}/{pagePath...}
```

Examples:

- `/users` → redirects to `/us/studio/users` (default culture `us`)
- `/us/studio/users` → culture `us`, portal `studio`, page `users`
- `/us/admin/users` → legacy redirect to `/us/studio/users` (p-34 bookmarks)
- `/studio/users` → bare redirect to `/us/studio/users` (designer `/studio/client-components` exempt)

Culture is resolved from the URL prefix (not a platform mount). The built-in studio portal segment is `studio`. Studio mount bindings remain the registry source for page modules; culture mounts were removed in ER-1.

## Experience manifest

Operators edit a single manifest in **App Routing** (Cultures · Portals · Navigation · Pages). The manifest compiles to registry files — there is no dual-format runtime parser.

```ts
type ExperienceManifest = {
  id: string;
  cultureId: string;
  portals: Array<{
    segment: string;
    name: string;
    shellKey: string;
    entryMode?: 'shell' | 'redirect';
    navRenderer?: string;
    navigationRef?: string;
    designPackId?: string;
    enabled: boolean;
    pages: Array<{
      path: string;
      pageKey: string;
      loaderRef?: string;
      auth?: { roles?: string[] };
      nav?: PlatformRouteBindingNav;
    }>;
  }>;
};
```

**Compile** (`PUT /api/platform/experience/manifest`) writes:

- `platform-registry/navigation/{navigationRef}.json`
- Shell `navRenderer` / `navigationRef` on the portal shell
- Studio mount route bindings (`source: experience-manifest`)
- Optional page modules when `loaderRef` is set

**Decompile** (`GET /api/platform/experience/manifest`) reads the registry back into manifest form for the UI.

Implementation: `src/server/services/platform/compileExperienceManifest.ts`.

## Navigation

Navigation JSON lives under `platform-registry/navigation/`. Shells reference a manifest via `navigationRef`. Admin shell uses `core:TreeNavTwoLevel` by default (`buildAdminShellNav.ts` falls back to binding-derived nav when no file exists).

## Packaging (vertical-app v1.2)

Vertical-app ZIP exports include:

- `navigation/navigation.json` — grouped nav manifest
- `experience/experience.json` — full experience manifest block
- `package.json` `$schemaVersion: "1.2"` with optional top-level `experience`

Import extracts runtime entries; operators compile into the live registry via Studio (Portals, Navigations) or `scripts/migrate-experience-manifest.ts`.

## Key files

| Role | Path |
|------|------|
| Top router | `src/app/platform/PlatformAppRoutes.tsx` |
| Experience host | `src/app/platform/ExperienceHost.tsx` |
| Portal resolver | `src/app/platform/PortalUrlResolver.ts` |
| Portal shell host | `src/app/platform/PortalHost.tsx` |
| Legacy admin redirect | `src/app/platform/LegacyAdminUrlResolver.ts` |
| Compile service | `src/server/services/platform/compileExperienceManifest.ts` |
| Manifest contract | `src/shared/api/contracts/platform/experienceManifest.ts` |
| Portals CRUD UI | `src/features/platform-portals/` |
| Navigations CRUD UI | `src/features/platform-navigations/` |
| Migration tool | `scripts/migrate-experience-manifest.ts` |
