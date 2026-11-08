# Visualization Data Model — Component Designer (CD-O01)

**Status:** Approved  
**Phase:** O — Data visualization, trees, timeline, sheet  
**Depends:** CD-A01 (`01-spec.md`)

---

## Purpose

Defines the canonical JSON contract for chart series, hierarchical tree nodes, timeline events, kanban boards, and spreadsheet cells **before** any chart or viz widget code is written. All Phase O widgets (`viz.*` palette ids) read and write data through these shapes.

---

## Chart series

Charts accept data as a **JSON array of row objects**. Each row has a category label (`label`) and one or more numeric series keys.

```json
[
  { "label": "Jan", "revenue": 4200, "cost": 2800 },
  { "label": "Feb", "revenue": 5100, "cost": 3100 },
  { "label": "Mar", "revenue": 4800, "cost": 2950 }
]
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `label` | `string` | yes | X-axis category or pie slice name |
| `<seriesKey>` | `number` | per series | Numeric value; key name becomes series id |
| `color` | `string` | no | Per-row override (pie / single-series) |

### Chart widget props (inspector)

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` | `string` | `''` | Chart heading |
| `data` | `string` (JSON) | mock fixture | Row array above |
| `seriesKeys` | `string` | `'revenue'` | Comma-separated numeric column keys |
| `xAxisKey` | `string` | `'label'` | Category field |
| `showLegend` | `boolean` | `true` | Legend visibility |
| `showGrid` | `boolean` | `true` | Cartesian grid |
| `height` | `number` | `280` | Chart height in px |

### Bar / column (CD-O02, CD-O05)

| Prop | Type | Values |
| --- | --- | --- |
| `orientation` | `string` | `vertical` (column) · `horizontal` (bar) |
| `grouped` | `boolean` | Grouped bars when multiple `seriesKeys` |

### Line / area (CD-O04)

| Prop | Type | Values |
| --- | --- | --- |
| `chartVariant` | `string` | `line` · `area` |
| `stacked` | `boolean` | Stacked area (future O06) |

### Pie / donut / gauge (CD-O07)

| Prop | Type | Values |
| --- | --- | --- |
| `chartVariant` | `string` | `pie` · `donut` · `gauge` |
| `valueKey` | `string` | Numeric field (default first series key) |

### Sparkline (CD-O11)

Same row array; renders inline mini chart. Props: `data`, `seriesKeys`, `height` (default `48`), `chartVariant` (`line` · `bar`).

---

## Tree nodes

Hierarchical data uses recursive `{ id, label, children? }` nodes.

```json
[
  {
    "id": "org-root",
    "label": "Head Office",
    "children": [
      { "id": "sales", "label": "Sales", "children": [
        { "id": "sales-tehran", "label": "Tehran" }
      ]},
      { "id": "engineering", "label": "Engineering" }
    ]
  }
]
```

| Field | Type | Required |
| --- | --- | --- |
| `id` | `string` | yes |
| `label` | `string` | yes |
| `children` | `DesignerTreeNode[]` | no |

**Do NOT** use `platform-nav` palette items as data trees — navigation menus are routing chrome, not master data.

---

## Timeline events

```json
[
  {
    "id": "evt-1",
    "title": "Project kickoff",
    "start": "2026-01-15",
    "end": "2026-01-15",
    "description": "Stakeholder alignment"
  },
  {
    "id": "evt-2",
    "title": "Design phase",
    "start": "2026-02-01",
    "end": "2026-03-15"
  }
]
```

| Field | Type | Required |
| --- | --- | --- |
| `title` | `string` | yes |
| `start` | `string` (ISO date) | yes |
| `end` | `string` (ISO date) | no |
| `id` | `string` | no |
| `description` | `string` | no |

Gantt (CD-O16) uses the same event shape; `end` is required for bar rendering.

---

## Kanban board

```json
{
  "columns": [
    {
      "id": "todo",
      "title": "To Do",
      "cards": [
        { "id": "c1", "title": "Draft spec", "description": "O01 data model" }
      ]
    },
    {
      "id": "done",
      "title": "Done",
      "cards": []
    }
  ]
}
```

---

## Editable sheet (CD-O29)

Separate from `heroui.data-grid` (read-only list binding). Sheet uses a 2-D cell matrix:

```json
{
  "columns": ["A", "B", "C"],
  "rows": [
    ["Product", "Qty", "Price"],
    ["Coffee", "120", "14.99"]
  ]
}
```

---

## Chart library choice (CD-O02)

| Library | Version | Min gzip (approx.) | License | Rationale |
| --- | --- | --- | --- | --- |
| **recharts** | 2.x | ~95 KB | MIT | React-native, composable, matches HeroUI/Tailwind stack |

Bundle impact is documented here; optional peer chunk splitting is CD-O38 (out of MVP scope).

---

## Mock fixture sets (CD-O36)

| Fixture id | Contents |
| --- | --- |
| `viz-sales-q1` | Monthly revenue chart rows |
| `viz-org-tree` | Organization tree |
| `viz-project-timeline` | Project milestone events |

Preview resolves fixtures via `designerStore.fixtureSet` or `?fixtureSet=` query param.

---

## Palette ids (Phase O MVP)

| Task | Palette id |
| --- | --- |
| O02/O05 | `viz.chart-bar` |
| O04 | `viz.chart-line` |
| O07 | `viz.chart-pie` |
| O11 | `viz.chart-sparkline` |
| O19 | `viz.tree-view` |
| O21 | `viz.tree-select` |
| O22 | `viz.cascader` |
| O28 | `viz.tree-combobox` |
| O14 | `viz.timeline` |
| O16 | `viz.gantt` |
| O29 | `viz.sheet` |
| O33 | `viz.kanban` |

O13 is a **shared chart inspector** (title, axes, series mapping) — not a separate palette item.
