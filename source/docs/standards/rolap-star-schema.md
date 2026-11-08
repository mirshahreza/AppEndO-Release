# ROLAP Star-Schema Provider (internal-only)

> **Shard:** `rolap-star-schema` · **Extends:** [`data-api-pivot.md`](./data-api-pivot.md) (same `PivotSpec`/`PivotResult` contract, `source.kind: 'star-schema'`)
> **Plan:** [`plans/core/todo/dashboard-canvas/p-109-rolap-star-schema.md`](../../plans/core/todo/dashboard-canvas/p-109-rolap-star-schema.md)
> **Not to be confused with:** [`olap-bridge.md`](./olap-bridge.md) — that shard proxies to a real, external Microsoft SSAS server. This shard makes AppEndO itself compute multidimensional aggregation on top of relational tables it already connects to. No Microsoft cube, no bridge, no Windows dependency, no XMLA.

Locked 2026-09-10. Implemented 2026-09-11. Internal-consumption only: this provider powers AppEndO's own dashboard/report widgets (`p-108`, and later Report Builder). It does **not** expose an XMLA/MDX-compatible endpoint for external tools (Excel, Power BI Desktop, Tableau) to connect to — that would be a much larger, separate, currently out-of-scope undertaking (effectively building an XMLA server, the same protocol surface `olap-bridge.md` found no safe/mature Node library for, this time as a server instead of a client).

## Intent

A star schema is one **fact** Edge model (measures) joined to one or more **dimension** Edge models (hierarchy levels) via associations that already exist in Data Studio. Most of what a "cube definition" needs is already implicit in the Edge Model association graph — this shard only adds a thin annotation layer (which associations are dimension joins, which columns are measures, what the level order is within a dimension) plus a compiler that turns a `PivotSpec` into one multi-join, `GROUP BY` SQL query over `EdgeDbRouter`.

```
Edge model graph (already exists)
  fact model --belongsTo--> dimension model A
  fact model --belongsTo--> dimension model B

+ thin annotation (this shard)
  fact model: which columns are measures (+ aggregation)
  each fact→dimension association: which dimension columns form the hierarchy, in level order

→ PivotSpec (field = "dimension.level" or a measure name)
→ compiler: resolve fields against the cube annotation → SQL join + GROUP BY → EdgeDbRouter
→ PivotResult — identical shape to the flat-sql provider; charts/tables don't know the difference
```

Drill-down is not a special endpoint. Expanding a hierarchy level is just requesting one more `rows`/`columns` field from the same dimension, narrowed by a filter on the parent member — ordinary `PivotSpec` usage.

## MUST

- Restrict v1 to a clean **star** shape: one fact model, N dimension models, each reached from the fact by exactly one direct `belongsTo` association already registered in Data Studio. No snowflake (multi-hop dimension chains) in v1 — call this out explicitly as a v2 decision if it comes up, not silently supported.
- Store the cube annotation as an **extension of existing studio-meta**, not a new business table: measures on the fact model's `columnMeta` (`cubeMeasure`), hierarchies/attributes on the qualifying association's `associationMeta` (`cubeDimension`) — see the full shape below (extended 2026-09-10, benchmarked against SSAS Tabular / Cube.dev / dbt Semantic Layer / Kimball theory).
- Reuse the **generic** studio-meta fields that already exist for display — never add cube-specific duplicates of these, they are not cube concepts:
  - A measure's display name/grouping/ordering comes from its own column's `columnMeta.displayLabel`/`group`/`sortOrder` **on the fact model**.
  - A hierarchy level's or attribute's display name/grouping/ordering comes from that same column's `columnMeta.displayLabel`/`group`/`sortOrder` **on the dimension model** (the association's target) — not from the association's own `associationMeta`.
  - The association's own `associationMeta.displayLabel` names the *dimension as a whole* (e.g. "Customer", "Ship Date") in a field-list group heading — a different, coarser thing than any one level/attribute's own label.
- Support **multiple named hierarchies per dimension** (`cubeDimension.hierarchies: Array<{ name, levels }>`) — a real dimension routinely needs more than one drill path (e.g. a Date dimension with both a calendar and a fiscal hierarchy; SSAS Tabular and Cube.dev both model this as N hierarchies per dimension, not one).
- Support **flat (non-hierarchical) attributes** on a dimension (`cubeDimension.attributes: string[]`) — columns that must be filterable/groupable but do not belong to any drill hierarchy (e.g. a customer's loyalty tier). Modeling every useful dimension column as a hierarchy level (the v1-locked shape before 2026-09-10) was the single biggest real gap found on review: most dimension columns in practice are attributes, not hierarchy levels.
- Classify every stored-column measure's **additivity** as `cubeMeasure.additivity: 'additive' | 'semi-additive'` only (Kimball's taxonomy, minus the third case — see next bullet for why) and require `aggregation: 'lastNonEmpty'` + a declared `semiAdditiveOverAssociation` (which dimension association is the time axis) whenever `additivity: 'semi-additive'` — reject the combination otherwise. Without this, a semi-additive fact (account balance, inventory snapshot) silently produces a meaningless sum when rolled up over time, exactly the failure mode SSAS's `LastNonEmpty`/`LastChild` semi-additive aggregations exist to prevent.
- Treat **non-additive** as exclusively a **derived-measure** property, never a stored-column `cubeMeasure` option (fixed 2026-09-10 — the first draft wrongly let `additivity: 'non-additive'` sit alongside a plain `aggregation` on a real column, which is meaningless: there is no safe aggregation function for a genuinely non-additive raw column, sum/avg both lie). A ratio/rate is non-additive *by construction* the moment it is expressed as an `extensions.cubeDerivedMeasures` entry over two other measures — it needs no separate additivity flag of its own.
- Allow one bounded class of **derived measure** in v1 — a **fact-level** list (`{ name, operation: 'ratio' | 'difference' | 'percentDiff', numerator, denominator }`, both operands naming two other stored-column measures on the same fact, never another derived measure — no chaining in v1), computed as post-aggregation cell arithmetic, never evaluated inside the SQL string. **All three operations are two-operand — `denominator` is always required, never optional** (fixed 2026-09-10: an earlier draft marked it "required for ratio/percentDiff" only, but `difference = numerator − denominator` needs both operands exactly as much as the other two; there is no legitimate single-operand case among these three ops):
  - `ratio = numerator / denominator`
  - `difference = numerator − denominator`
  - `percentDiff = (numerator − denominator) / denominator` (a fraction; the presentation layer applies `%` formatting — formatting is already out of this shard's scope, per the "reuse generic fields" bullet above)
  - **MUST** return `null` for a cell (never `NaN`/`Infinity`, never throw the request) when `denominator` is `0` for that cell — a single empty group must not fail an entire widget's data.
  - **MUST** reject a derived measure whose `name` collides with any stored-column measure name or any dimension field name already declared on the same fact/domain — one flat field namespace per fact, not two independent ones that happen to share the wire format.
  - This is deliberately narrower than Cube.dev's arbitrary `sql:` measures or DAX measures, but covers the actual recurring ask (ratios, deltas) without adding an expression parser or a new injection surface.
- Store the derived-measure list on the **fact model's own studio-meta**, not on any one column's `columnMeta` entry — a ratio has no physical backing column, so pinning it to one of its operand columns would be an arbitrary, fragile choice (breaks if that column is ever renamed/removed). The existing `EdgeModelStudioMeta.extensions` bag (already documented as "extensible bag for future modeler definitions") is the intended home: `extensions.cubeDerivedMeasures: Array<{ name, operation, numerator, denominator }>`. A fact needs **at least two** stored-column measures already declared before its first derived measure is meaningful (both operands must resolve to real, distinct stored measures) — this is a consequence of the two-operand rule above, not a separate constraint to track.
- Let a dimension association flag `isTimeDimension: true` — this is what a semi-additive measure's `semiAdditiveOverAssociation` must reference, and is the metadata seam later time-intelligence work (rolling periods, YoY) would build on without another schema change.
- Reject, at annotation-validation time (not silently at query time), these malformed states: (a) a column declared in both a dimension's `hierarchies[].levels` and its `attributes` at once — ambiguous dual role; (b) a `cubeDimension` on an association whose owning model has zero `cubeMeasure` columns — a dimension-only "fact" is a half-configured cube, not a valid one; (c) a `cubeDimension` that declares neither a `hierarchies` entry nor an `attributes` entry — an empty annotation is not a dimension; (d) a derived measure whose `numerator`/`denominator` names a measure that does not exist as a stored-column `cubeMeasure` on the same fact, or that names itself, or a `cubeDerivedMeasures` list on a fact with fewer than two stored-column measures declared.
- Keep `PivotSpec.field` resolution identical in shape to the flat-sql provider: `field` is an opaque name (`"<dimensionAssociationAs>.<hierarchyColumn|attribute>"` for a dimension field, or a measure name) that this provider's compiler resolves — never let the client send a table/column name directly, matching `data-api-pivot.md`'s "keep field names independent of SQL" rule.
- Compile to a **single query** via Sequelize's own association-aware query builder — `FactModel.findAll({ include: [{ model: DimensionModel, as, attributes: [...requestedHierarchyLevels, ...requestedAttributes] }], attributes: [[...requestedHierarchyLevels, ...requestedAttributes, sequelize.fn(aggregation, sequelize.col(measureColumn)), alias]], group: [...requestedHierarchyLevels, ...requestedAttributes] })` (attributes are projected/grouped exactly like hierarchy levels — the distinction is about drill semantics, not query shape) — not hand-rolled SQL strings and not a new query-builder dependency. Edge models already carry the real Sequelize `belongsTo` associations this needs (per `data-model.md`'s association-wiring rules); this shard reuses them, it does not reimplement joins. Derived measures (`extensions.cubeDerivedMeasures`) are the one exception — computed in JS on the already-returned aggregated cells, not inside this query.
- Never materialize fact rows in Node and aggregate in JavaScript. (Derived-measure arithmetic operates on already-aggregated cells, not raw rows — this MUST is unaffected.)
- Apply Record Policy on the fact table before aggregation, same as the flat-sql provider.
- Return the same `PivotResult` shape (`rowAxis`/`colAxis`/`measures`/`cells`) as every other provider — chart/table widgets must not need a code branch for "am I looking at star-schema data."
- Treat this as `source.kind: 'star-schema'` on the same published Pivot API operation — not a new HTTP surface, not a new wizard flow beyond "which Edge model is the fact, which associations are dimensions" during setup.
- Cap result size (`LIMIT`/pagination on the grouped result) and enforce a query timeout, matching PIVOT-2's cell/cardinality cap on the flat-sql provider — a runaway multi-join aggregation must fail the same bounded way a slow flat query already does.

## NEVER

- Build or expose an XMLA/SOAP server endpoint, or any MDX-parsing surface, for this shard — that is explicitly out of scope (confirmed with the operator 2026-09-10: internal consumption only). Revisit only as a distinct, separately-scoped decision if external-tool connectivity is ever actually requested.
- Support snowflake (dimension-of-a-dimension) joins in v1.
- Invent a new "Cube" business table/domain — the fact/dimension/measure/hierarchy annotation lives entirely inside the existing EdgeModel/studio-meta storage boundary from `data-model.md` / `data-api-pivot.md`.
- Let a client-supplied `field` resolve to any column outside what the cube annotation explicitly declares as a measure, hierarchy level, or attribute.
- Require a new mandatory npm dependency at all — see MUST below: Sequelize (already the ORM behind every Edge model) already builds multi-join `GROUP BY` aggregation queries natively.
- Add a free-form measure expression/formula language (a DAX- or Cube.dev-`sql:`-style arbitrary expression). A derived measure is a closed set of two-operand arithmetic ops on already-declared *stored-column* measures — no chaining a derived measure from another derived measure in v1, and anything requiring more expressive power is a v2 decision, not silently grown into this one.
- Let a derived measure's cell arithmetic raise, throw, or emit `NaN`/`Infinity` on a zero/missing denominator — it must resolve to `null` for that cell only.
- Model Slowly Changing Dimension (SCD Type 1/2/3/...) behavior anywhere in this annotation. SCD is about how the **dimension table itself** is populated/versioned upstream (an ETL/table-design concern), not about which columns a pivot groups by — genuinely out of this shard's layer, not an oversight.
- Add a separate `visible`/`hidden` flag on measures or dimension fields. Which fields an end user may actually see is already the domain whitelist's job (`personalizable-dashboard.domain-is-explicit-whitelist` in `personalizable-dashboard-canvas.md`) — a second, cube-level visibility flag would be a duplicate source of truth for the same decision.

## Cube annotation shape (studio-meta extension)

```ts
// on the fact EdgeModel's columnMeta[column] — always backed by a real stored column
cubeMeasure?: {
  aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'countDistinct' | 'lastNonEmpty'
  additivity: 'additive' | 'semi-additive'   // non-additive is expressed only via a derived measure, see below
  /** Required, and must reference an association whose cubeDimension.isTimeDimension is true, when additivity is 'semi-additive'. */
  semiAdditiveOverAssociation?: string
  // displayLabel / group / sortOrder: reuse the existing generic columnMeta fields — not repeated here.
}

// on the fact EdgeModel's own EdgeModelStudioMeta.extensions — NOT backed by any one column
extensions.cubeDerivedMeasures?: Array<{
  name: string                                        // this measure's field name in PivotSpec; must not collide with any measure/dimension-field name on this fact
  operation: 'ratio' | 'difference' | 'percentDiff'
  numerator: string                                    // another *stored-column* measure's name on this fact
  denominator: string                                  // always required — all three ops are two-operand; also a stored-column measure, distinct from numerator
}>

// on a fact→dimension belongsTo association's associationMeta[as]
cubeDimension?: {
  /** One or more named drill paths over this dimension's columns (e.g. "Calendar", "Fiscal"). */
  hierarchies?: Array<{ name: string; levels: string[] }>   // level order = array order, level 0 is the coarsest
  /** Flat, non-hierarchical columns: filterable/groupable but not part of any drill path. Must not overlap any hierarchy's levels. */
  attributes?: string[]
  /** Marks this dimension as the time axis a semi-additive measure may reference. */
  isTimeDimension?: boolean
  // displayLabel: reuses the existing generic associationMeta field — not repeated here.
}
```

A model with at least one `cubeMeasure` column is a fact. `extensions.cubeDerivedMeasures` alone does **not** independently qualify a model as a fact — a derived measure's operands must resolve to real stored-column measures, so a non-empty `cubeDerivedMeasures` list is only ever valid on a model that already has ≥2 `cubeMeasure` columns (a consequence of the two-operand rule, not a separate flag to check). An association carrying `cubeDimension` marks that target model as a dimension for this cube — but is only valid when its owning model is itself already a fact (see validation NEVER above). No separate "is this a cube" flag needed — presence of these annotations is the declaration.

**Role-playing and conformed dimensions need no extra field.** Because annotation lives on the *association* (`associationMeta[as]`), not on the target model, two associations from one fact to the same physical dimension model (e.g. `orderDate`/`shipDate`, both → the `Date` model) each carry their own independent `cubeDimension` — that is a role-playing dimension, for free. Likewise, two different fact models each associating to the same dimension model automatically share it as a conformed dimension — no cross-fact registration step exists or is needed.

## `PivotSpec.field` resolution for this provider

| Field pattern | Resolves to |
|---|---|
| `<dimensionAs>.<hierarchyColumn>` | One level of one of that dimension's declared `hierarchies` |
| `<dimensionAs>.<attributeColumn>` | One of that dimension's declared flat `attributes` |
| `<measureColumn>` | A fact column with a `cubeMeasure` annotation; `PivotSpec.measures[].aggregation` must match the declared `aggregation` (or be omitted to use it as the default) |
| `<derivedMeasureName>` | An entry in the fact's `extensions.cubeDerivedMeasures` — computed after the underlying query returns, from its `numerator`/`denominator` measures' cells; never itself carries an `aggregation` in the request |

Anything else → reject at the API boundary, same failure shape as an unknown field on the flat-sql provider.

## Later (not this shard's v1)

- Snowflake dimensions (dimension joined through another dimension).
- A free-form measure expression/formula language beyond the closed derived-measure op set (ratio/difference/percentDiff) — v1 does not add a DAX- or `sql:`-style expression evaluator.
- Time-intelligence conveniences (rolling N periods, YoY/QoQ shortcuts) beyond the raw `isTimeDimension` flag this v1 already captures as a metadata seam.
- Any XMLA/MDX server surface for external BI tools — a distinct future decision, not assumed here.
- A visual "cube designer" UI beyond the dedicated Analytical Model section in the existing Data Studio modeler panels (see UI section below) — still no separate screen/wizard.

## UI — Analytical Model section (existing modeler panels, not a new screen)

Reviewed 2026-09-10: a "couple of checkboxes" on the existing column/association dialogs is not enough surface for the shape above — it needs its own clearly delimited sub-section within those existing dialogs (not a new dialog, not a new route):

- **Column property panel** (`EdgeModelModelerColumnDialog.tsx`) gains a collapsible **"Analytical Model"** sub-section, shown only when the parent Edge model is being used as a fact:
  - Toggle: *use this column as a measure*.
  - `aggregation` select (`sum`/`count`/`countDistinct`/`avg`/`min`/`max`/`lastNonEmpty`).
  - `additivity` radio, **only two options** (`additive`/`semi-additive` — no third "non-additive" option here, see below for why); selecting `semi-additive` reveals a required *"time dimension"* select, populated only from associations on this fact already flagged `isTimeDimension`, and forces `aggregation` to `lastNonEmpty`.
- **Association property panel** gains the same collapsible **"Analytical Model"** sub-section, shown only when the association target is being used as a dimension:
  - Toggle: *use this association as a dimension*.
  - A repeatable *hierarchy* builder — name + ordered list of target-model columns (add/remove/reorder levels), supporting more than one hierarchy per association.
  - A separate multi-select for *attributes* — flat, non-hierarchical target-model columns; picking a column already used in a hierarchy for this same association is blocked inline (the overlap NEVER rule above), not caught only on save.
  - Toggle: *this dimension is the time axis* (`isTimeDimension`).
- **Model-level general settings** (`EdgeModelModelerGeneralEditDialog.tsx` — the same existing dialog that already edits this model's studio tags) gains a **"Derived Measures"** sub-section, shown only when the model has at least one column already marked as a measure: a small repeatable list, each row = name + operation select (`ratio`/`difference`/`percentDiff`) + two pickers restricted to this fact's already-declared stored-column measures — never a free-text formula box. This lives at the model level, not the column level, because a derived measure (e.g. "profit margin") has no column of its own to attach to.
- All three sub-sections read from and reuse the dialogs' already-existing generic label/group/sort-order fields for display — they do not add second copies of those fields under the new sub-section.

## Tokens / files (when implemented)

- Compiler: `src/server/domain/data-api/rolapStarSchemaCompiler.ts` (pure: cube annotation + `PivotSpec` → SQL → `PivotResult`; derived-measure arithmetic as a small pure post-processing step over the returned cells, resolving a zero/missing denominator to `null`).
- Provider dispatch: alongside `PIVOT-1`'s flat-sql executor in `src/server/services/data-api/`.
- Annotation storage: existing `runtime/edge-model-studio-meta` — `columnMeta[].cubeMeasure` and `associationMeta[].cubeDimension` as today, plus the fact model's own `extensions.cubeDerivedMeasures` for derived measures — no new store, no schema migration beyond widening the already-schemaless `extensions` bag.
- Modeler UI: existing Data Studio column/association property panels gain a dedicated "Analytical Model" sub-section each, and the existing model-level general-settings dialog gains a "Derived Measures" sub-section (see above) — no new screen.

## IDs

`rolap-star-schema.internal-only`, `rolap-star-schema.no-xmla-server`, `rolap-star-schema.annotation-not-new-table`, `rolap-star-schema.single-sql-query`, `rolap-star-schema.opaque-field-names`, `rolap-star-schema.star-only-v1`, `rolap-star-schema.multi-hierarchy-per-dimension`, `rolap-star-schema.flat-attributes`, `rolap-star-schema.additivity-classified`, `rolap-star-schema.non-additive-is-derived-only`, `rolap-star-schema.bounded-derived-measure`, `rolap-star-schema.derived-measure-fact-level-not-column`, `rolap-star-schema.derived-measure-null-on-zero-denominator`, `rolap-star-schema.no-hierarchy-attribute-overlap`, `rolap-star-schema.dimension-requires-fact`, `rolap-star-schema.dimension-not-empty`, `rolap-star-schema.derived-measure-two-operands-always`, `rolap-star-schema.derived-measure-name-no-collision`, `rolap-star-schema.derived-measures-need-two-stored-measures`, `rolap-star-schema.dimension-field-label-from-target-model`, `rolap-star-schema.role-playing-free`, `rolap-star-schema.no-scd-here`, `rolap-star-schema.no-duplicate-visibility-flag`, `rolap-star-schema.dedicated-ui-subsection`
