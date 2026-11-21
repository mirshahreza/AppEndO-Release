# AppEndO license — plain-language FAQ

This FAQ **does not replace** the legal text in [`LICENSE`](../LICENSE). If anything here disagrees with **Section A** of the license, **Section A wins**.

## What is AppEndO’s license?

AppEndO uses a **custom license**: Apache License 2.0 text (Section B) **plus** **Section A** additional terms. It is **not** standard Apache 2.0 software.

## What can I do?

| Activity | Allowed? | Notes |
| --- | :---: | --- |
| **Run AppEndO for your organization** | Yes | Self-host on your infrastructure; configure for your users. |
| **Use official releases from AppEndO-Release** | Yes | Download tagged releases; install CMS / Remote Hubs bundles as documented. |
| **Operate public-facing portals for your end users** | Yes | See LICENSE **A.4** (official Work). |
| **Modify the source for your own deployment** | Yes | Under Section A and B, subject to redistribution rules below. |
| **Contribute back via AppEndO-Release** | Yes | Issues and PRs on the public repo. |
| **Keep a fork on a private network only** | Yes | VPN, intranet, or air-gapped — not reachable from the public Internet. |
| **Install ecosystem packages (ZIP)** | Yes | Extensions and domain packages without maintaining a platform source fork. |

## What can I not do?

| Activity | Allowed? | Why |
| --- | :---: | --- |
| **Host a platform source fork on the public Internet** | **No** | Section A forbids public reachability of a separate platform source fork. |
| **Offer multi-tenant “platform-as-a-service” from your fork’s codebase** | **No** | Public hosting of a forked **platform codebase** is prohibited. |
| **Strip or replace Section A** | **No** | Section A is legally controlling. |
| **Redistribute private commercial packages not bundled in this release** | **No** | Public snapshots include only documented bundled ZIPs. |

## Where to read the legal terms

- Full license: [`LICENSE`](../LICENSE)
- Contributing: [`CONTRIBUTING.md`](../CONTRIBUTING.md) (release repo root)
- Security: [`SECURITY.md`](../SECURITY.md) (release repo root)