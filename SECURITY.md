# Security Policy

## Supported versions

Security fixes are published for the **current platform release** on [AppEndO-Release](https://github.com/mirshahreza/AppEndO-Release/releases) and the next patch release prepared from the private upstream monorepo.

| Version | Supported |
| --- | --- |
| Latest tagged release (`vX.Y.Z` on AppEndO-Release) | Yes |
| Older tagged releases | Best-effort; upgrade recommended |
| Unreleased `main` / private monorepo `main` | Maintainers only |

Package versions (CMS, Remote Hubs, etc.) ship with each platform release; report issues with the **platform tag** and package versions from `MANIFEST.json` when using a release artifact.

## Reporting a vulnerability

Report security issues **only** through GitHub Issues on the public release repository:

**https://github.com/mirshahreza/AppEndO-Release/issues**

Choose the **Security report** issue template (or open a new issue with the `security` label if templates are unavailable).

**Important:** Do **not** paste exploit steps, stolen tokens, passwords, session cookies, or other secrets in the public issue. Describe the **component**, **affected version**, and a **high-level summary** of the impact so maintainers can follow up privately in the issue thread.

Include when safe to share:

- Affected version (release tag or commit)
- Component (API route, package, auth, file manager, etc.)
- Steps to reproduce at a **non-sensitive** level
- Impact assessment

## Other reports (bugs, features, conduct)

All community contact uses the same issue tracker:

| Topic | How to report |
| --- | --- |
| Bugs | [Bug report](https://github.com/mirshahreza/AppEndO-Release/issues/new?template=bug_report.yml) |
| Features | [Feature request](https://github.com/mirshahreza/AppEndO-Release/issues/new?template=feature_request.yml) |
| Code of Conduct | [Conduct report](https://github.com/mirshahreza/AppEndO-Release/issues/new?template=conduct_report.yml) |

## What to expect

| Step | Target timeline |
| --- | --- |
| Acknowledgment of receipt | Within **5 business days** |
| Initial severity assessment | Within **10 business days** |
| Fix or mitigation plan | Depends on severity; critical issues prioritized |
| Coordinated disclosure | After a fix is available on AppEndO-Release (or documented mitigation) |

We may ask for clarification and will credit reporters in release notes when agreed.

## Operational reminders

- Rotate `APPENDO_CREDENTIAL_MASTER_KEY` and JWT secrets using project runbooks if a breach is suspected.
- Never commit `settings.json`, `.env`, cookie jars (`cookies.txt`, `*-cookies.txt`), or session dumps to git.