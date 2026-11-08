# ADR — Navigation v2 (model A vs B)

**Status:** Accepted (p-37 RLE-4)  
**Default:** **Model B** — one navigation tree + region filters

## Model A — Multiple trees

Each shell region (`top`, `side`, `footer`) references a **separate** navigation file (`navigationRef` per region).

- Pros: independent menus per region
- Cons: more operator config · export complexity

## Model B — One tree + filter (default)

Single `navigationRef` per portal. Items are filtered per region by optional `nav.region` metadata (or all items in `side`, top-level only in `top`, flat in `footer`).

- Pros: one source of truth · simpler export
- Cons: less flexibility for radically different trees

## Shell slots

Designer `app-shell` preset exposes:

- `core.shell.nav.top`
- `core.shell.nav.side`
- `core.shell.nav.footer`
- `core.shell.route-outlet`

`DesignerPublishedShell` resolves each region via `NavRegionRenderer` + `NavTreeFilter`.

## Renderers

| id | UI |
|----|-----|
| `core:TreeNavTwoLevel` | Sidebar tree |
| `core:TopDrawerNav` | Mobile drawer |
| `core:TopBarNav` | Horizontal top bar |
| `core:FlatLinks` | Footer flat links |
