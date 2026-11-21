# Contributing to AppEndO

Thank you for your interest in AppEndO. This document explains how to report issues, propose changes, and set up a development environment.

## Where contributions happen

Day-to-day development happens in a **private upstream monorepo**. The **public distribution** for community feedback and contributions is:

**[github.com/mirshahreza/AppEndO-Release](https://github.com/mirshahreza/AppEndO-Release)**

Please open **issues** and **pull requests** against **AppEndO-Release**, not against any private repository. Maintainers sync accepted changes back into the upstream monorepo as part of the release pipeline.

## Contact and reports

**All reports go through GitHub Issues** — there is no project mailing list.

| Kind | Link |
| --- | --- |
| Bug | [Bug report](https://github.com/mirshahreza/AppEndO-Release/issues/new?template=bug_report.yml) |
| Feature | [Feature request](https://github.com/mirshahreza/AppEndO-Release/issues/new?template=feature_request.yml) |
| Security | [Security report](https://github.com/mirshahreza/AppEndO-Release/issues/new?template=security_report.yml) — no secrets in the issue body |
| Code of Conduct | [Conduct report](https://github.com/mirshahreza/AppEndO-Release/issues/new?template=conduct_report.yml) |

Search [existing issues](https://github.com/mirshahreza/AppEndO-Release/issues) before opening a duplicate.

## Reporting bugs

1. Search existing issues for duplicates.
2. Open a **Bug report** using the issue template (version, environment, steps to reproduce, expected vs actual).
3. Include platform version (`package.json` / release tag), Node.js version, control-plane database provider, and redacted logs. **Do not** attach `settings.json`, `.env`, or cookie/session dump files.

## Requesting features

Use the **Feature request** template. Describe the problem, who it helps, and any constraints (self-hosted, license Section A, package model). Feature work in the public snapshot should align with the broader platform direction described in `source/README.md` and `source/AGENTS.md` when you work from a release checkout.

## Development setup

From a **release checkout** (recommended for contributors):

```bash
cd source
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:3000/install](http://localhost:3000/install) for first-time setup. See `source/README.md` for SQL Server vs PostgreSQL paths, production build (`npm run build` / `npm start`), and secrets guidance.

From this **private monorepo** (maintainers), the same flow applies at the repository root:

```bash
cp .env.example .env
npm install
npm run dev
```

**Prerequisites:** [Node.js 22](https://nodejs.org/), npm, and a control-plane database (SQL Server recommended; PostgreSQL, MySQL, and SQLite supported via the install wizard).

## Coding standards

Production source under `src/` and `public/` is **English-only**. Follow the architecture and UI standards documented in the tree:

| Topic | Document (in release: under `source/`) |
| --- | --- |
| Hub for agents & contributors | `AGENTS.md` |
| Standards index | `docs/standards/INDEX.md` |
| Architecture | `src/ARCHITECTURE.md` |
| UI & components | `docs/standards/ui-core.md`, Base Components catalog |
| Data API | `docs/standards/data-studio.md` |
| Packages | `docs/standards/package-ui.md` |

Use **Base Components** from `/studio/base-components` for UI. Do not introduce parallel base widgets or raw HTML form controls where a catalog control exists.

Run before submitting a PR:

```bash
npm run lint
npm run test:critical
```

## Pull request process

1. Fork **AppEndO-Release** (or branch from `main` if you have write access).
2. Make a focused change with a clear description of **why** (not only what).
3. Fill out the PR template (scope, test plan, license acknowledgment).
4. Ensure CI-style checks pass locally where applicable (`npm run lint`, targeted tests).
5. Maintainers review on GitHub; merged work may be cherry-picked into the private monorepo and appear in a future tagged release.

## License

By contributing, you agree that your contributions are licensed under the same terms as AppEndO (`LICENSE`, Section A primary terms). Read [`docs/LICENSE-FAQ.md`](docs/LICENSE-FAQ.md) for plain-language allowed uses.