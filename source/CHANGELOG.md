# Changelog

Platform releases published on [AppEndO-Release](https://github.com/mirshahreza/AppEndO-Release/releases). Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.0.12] - 2026-11-22

### Added

- GitHub Issues–only community contact; `SECURITY.md`, `CONTRIBUTING.md`, and Code of Conduct with no mailing-list placeholders.
- Security and conduct issue templates; unsolicited blank issues disabled.

### Changed

- Public release gate scans the full artifact tree for cookie jars, `.env`, and session token material.
- OSS source snapshots exclude cookie files at any path depth.

## [0.0.11] - 2026-11-21

### Added

- Portal route loading polish (logo + orbital ring) and related studio standards updates.
- Meetings and courses/activities studio polish.

### Changed

- Release-cut clone dev port documentation for the OSS profile.

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

- Clone edge model datasource identifiers for the OSS clone line.

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

- Local release-cut orchestrator and first public OSS release pipeline.

[0.0.12]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.10...v0.0.12
[0.0.10]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.9...v0.0.10
[0.0.9]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.5...v0.0.9
[0.0.5]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/mirshahreza/AppEndO-Release/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/mirshahreza/AppEndO-Release/releases/tag/v0.0.1