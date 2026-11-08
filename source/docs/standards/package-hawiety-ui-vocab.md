# Hawiety Studio UI vocabulary (geo + nakhebin)

> **Shard:** `package-hawiety-ui-vocab`  
> **Audience:** operators, translators, AI agents building Hawiety UI copy.

## Operator-facing terms (locked)

Legacy Hawiety / old docs often say **اقتراع** or **Eghtera** and **تموين** or **Tamvin**. In AppEndO Studio UI (all cultures), use:

| Legacy / avoid in UI | Studio UI (Arabic iq) | Studio UI (English us) | Geo level (`legacy_kind`) |
|----------------------|------------------------|-------------------------|---------------------------|
| اقتراع، Eghtera، Eghteraat | **المنطقة** / **المناطق** | **Region** / **Regions** | `region` |
| تموين، Tamvin، Tamvinat | **المكتب** / **المكاتب** | **Maktab** | `maktab` |

Province, circle, ghavateh naming is unchanged (محافظة، دائرة، قاطعة).

## Electoral breadcrumb order (locked)

Member / geo `title_path` display and path-matching code use one Studio chain (left → right):

**province (محافظة)** → **ghavateh (قاطعة, optional)** → **circle (دائرة)** → **maktab (مكتب)** → **region (منطقة)**.

Member-directory grid column «المركز الانتخابي» (**three rows**, locked):

| Row | Content |
|-----|---------|
| 1 | province `\|` ghavateh (when present) |
| 2 | circle `\|` maktab |
| 3 | region |

Code index: `splitHwyElectoralBreadcrumbParts`, `splitHwyElectoralBreadcrumbGridColumnLines` in `src/shared/lib/hwyElectoralBreadcrumbStandard.ts`; UI `HwyElectoralDivisionPathLinks` (`layout="twoLine"`).

## Code vs UI

- **Do not rename** legacy SQL identifiers, routes, or procedure names (`H_Eghtera_*`, `nakhebin-eghtera-regions`, `link_eghtera`, `Tamvinat_List`) unless a dedicated migration task says so.
- **Do rename** culture strings, dialog titles, column headers, nav labels, placeholders, and English TS `t(..., 'fallback')` text to match the table above.
- Business-rules shards may cite legacy SP names in backticks; prose for operators still uses **region** / **maktab**.

## Agent rule

When the operator uses old words (اقتراع، تموين، eghtera، tamwin) in a **UI/copy** request, implement with **منطقة / region** and **مكتب / maktab** and update affected culture keys.

## Where this is indexed

- [`docs/standards/INDEX.md`](INDEX.md) · [`AGENTS.md`](../../AGENTS.md) topic map · `projectStandards.ts` id `package.hawiety.ui-vocab`.
- Culture sources of truth: `hawiety.{iq,us,ir}.json` overlays; keep `settings.json` and `workspace/platform-registry/navigation/hawiety.json` aligned when changing nav labels.
