# Changelog

Platform releases published on [AppEndO-Release](https://github.com/mirshahreza/AppEndO-Release/releases). Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.0.18] - 2026-11-23

### Security

- The public export leaves out build output folders (`obj/`, `bin/`), scratch and debug files, and unfinished designer drafts.
- Documentation in the public tree uses placeholders instead of sample credentials.
- The export fails if a machine-local Windows or home-directory path is still present in the snapshot.
- Source maps are no longer shipped in the published `dist/` folder, which makes the download smaller.

### Fixed

- The path check no longer flags harmless lookalike strings inside minified JavaScript bundles.

## [0.0.17] - 2026-11-23

### Security

- The public export omits machine-local runtime directories (package event logs, workspace audit and overnight output, agent tool artifacts) and ships an empty package-storage template.
- Operator settings snapshots are left out of the public tree. Settings templates that do ship keep placeholder secrets only.
- The export fails if a personal email, a private vertical name, a non-placeholder settings secret, or a file under an excluded runtime path is still present.

### Changed

- Commits and annotated tags created in the public repository use a configurable GitHub noreply identity.
- License text states that the tree is source-available under a custom license and is not OSI-approved.
- `LICENSE` is also copied to the repository root so the host can detect it.
- `.env.example` no longer comments a machine-local credentials path.
- The Docker section describes a local evaluation compose file and stays honest that a clean-volume health check is not a signed-off release gate.

## [0.0.16] - 2026-11-22

### Added

- Studio screenshots on the public landing page.
- Local evaluation compose file binds published ports to loopback.

### Changed

- Public export rewrites or rejects known personal contact details before publish.

## [0.0.14] - 2026-11-22

### Added

- Public landing page, product screenshots, and a local PostgreSQL evaluation compose file.
- Community issue templates and governance docs on the public repository.

### Fixed

- Production boot path for the published server build.

## [0.0.12] - 2026-11-22

### Added

- GitHub Issues–only community contact; `SECURITY.md`, `CONTRIBUTING.md`, and Code of Conduct with no mailing-list placeholders.
- Security and conduct issue templates; unsolicited blank issues disabled.

### Changed

- Public release gate scans the full artifact tree for cookie jars, `.env`, and session token material.
- Public source snapshots exclude cookie files at any path depth.

## [0.0.11] - 2026-11-21

### Added

- Portal route loading polish (logo + orbital ring) and related studio standards updates.
- Meetings and courses/activities studio polish.

### Changed

- Release-cut clone dev port documentation for the public snapshot profile.

## [0.0.10] - 2026-11-15

### Added

- Release-cut server deploy examples and incremental deploy tooling for operators.

### Fixed

- Exclude volatile clone work directories from release source snapshots.

## [0.0.9] - 2026-11-12

### Fixed

- CMS pack SQL login preference during release cut on Windows clone environments.

## [0.0.8] - 2026-11-12

### Fixed

- CMS pack SQL for release cut on Windows clone login.

## [0.0.7] - 2026-11-12

### Added

- Release-cut P9 clone database structure sync.

### Changed

- Clone edge model datasource identifiers for the public snapshot clone line.

## [0.0.6] - 2026-11-11

### Added

- Release-cut clone profiles, headless provision, and `APPENDO_SETTINGS_PATH` support for clone dev/ETL.
- Message audit portal routes, record event logging, and voting package documentation.

## [0.0.5] - 2026-11-09

### Changed

- Sidebar logo alignment; remote-hubs package artifact refresh.

## [0.0.4] - 2026-11-09

### Added

- Operator run skill for local dev/testing menus.
- ETL and schema enhancements for electoral geo, courses, and meetings areas.
- Updated AppEndO logo branding assets.

## [0.0.3] - 2026-11-08

### Fixed

- Public export assemble version manifest wiring.
- Platform build snapshot excludes release-cut staging; cut artifacts stored outside `dist/`.

## [0.0.2] - 2026-11-08

### Added

- Public release tree assembly (`source/`, `dist/`, CMS and Remote Hubs zips) and public README generation.

### Fixed

- Release-cut Windows npm spawn resilience and optional test pillars.

## [0.0.1] - 2026-11-08

### Added

- Local release-cut orchestrator and first public release pipeline.

[0.0.17]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.16...v0.0.17
[0.0.16]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.14...v0.0.16
[0.0.14]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.12...v0.0.14
[0.0.12]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.10...v0.0.12
[0.0.10]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.9...v0.0.10
[0.0.9]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.5...v0.0.9
[0.0.5]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/mirshahreza/AppEndO-Release/releases/tag/v0.0.1