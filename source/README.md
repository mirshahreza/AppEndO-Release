# AppEndO (public OSS source)

Self-hosted enterprise application platform: studio, Data Studio, Workflow Engine, Server Functions, and installable ecosystem packages (CMS and Remote Hubs ship with [AppEndO-Release](https://github.com/mirshahreza/AppEndO-Release)).

This tree is the **scrubbed platform source** from an official release snapshot. See the **repository root `README.md`** on AppEndO-Release for pre-built `dist/`, bundled ZIPs, and `MANIFEST.json`.

## Installation

**Prerequisites:** Node.js 22, npm, control-plane database (SQL Server recommended).

```bash
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:3000/install](http://localhost:3000/install) for first-time setup, or follow `CLONE_PROFILE.md` when using the isolated `AppEndORelease` database line (`settings.recommended.json`).

```bash
npm run build
npm run start
```

Health: `GET /api/health` · `GET /api/ready`.

## Documentation

| Topic | Path |
| --- | --- |
| Architecture | `src/ARCHITECTURE.md` |
| Standards index | `docs/standards/INDEX.md` |
| Contributors | `../CONTRIBUTING.md` (release repo root) |
| License FAQ | `docs/LICENSE-FAQ.md` |
| Agents hub | `AGENTS.md` |

## License

Custom license — **Section A** in `LICENSE` controls. See `docs/LICENSE-FAQ.md`.