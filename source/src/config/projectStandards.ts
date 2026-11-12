/**
 * Machine index of product constraints.
 * Canonical prose: docs/standards/<shard>.md (see AGENTS.md + docs/standards/INDEX.md).
 * Keep `value` as a searchable one-liner MUST — do not restate shard recipes here.
 * Resolve shard with `shardForStandardId(id)`.
 */
export type ProjectStandard = {
  id: string;
  title: string;
  value: string;
  appliesTo: string[];
};

export type ProjectStandardsResource = {
  version: string;
  updatedAt: string;
  standards: ProjectStandard[];
};

export const PROJECT_STANDARDS: ProjectStandardsResource = {
  version: '1.70.82',
  updatedAt: '2026-11-04',
  standards: [
    {
      id: 'agent.prompt-scope',
      title: 'Prompt Scope Only',
      value:
        'work strictly on what the current operator prompt explicitly requests; do not edit refactor fix test or extend anything outside that scope including drive-by cleanup unrelated lint fixes opportunistic improvements or implied follow-on work; minimum necessary reads and edits to fulfill the prompt are in scope; if the prompt is ambiguous or the goal requires out-of-scope code stop and ask — do not assume or proceed alone; canonical prose AGENTS.md §Always-on Prompt scope only',
      appliesTo: ['all agent tasks', 'IDE assistant', 'AppEndO Agent', 'session prompt'],
    },
    {
      id: 'agent.page-edit-lock',
      title: 'Page Edit Lock (All Locked)',
      value:
        'default policy all-locked in src/config/operatorPageEditLocks.ts — every page in docs/ai/page-edit-locks.json is edit-locked until the current operator prompt explicitly names that pageKey route or label; do not edit files under a page searchRoots without that explicit naming; investigation reads allowed when they directly support the scoped task; shared cross-cutting paths still follow agent.prompt-scope; refresh manifest via npm run codegen:ai-index; tools get_operator_page_edit_locks and Cursor rule .cursor/rules/operator-page-edit-lock.mdc; canonical prose docs/standards/agents-hub.md',
      appliesTo: ['all agent tasks', 'IDE assistant', 'AppEndO Agent', 'session prompt', 'page-scoped UI and API'],
    },
    {
      id: 'ui.base-components.first',
      title: 'Base Components First',
      value:
        'whenever building UI, use the shared primitives demonstrated on the Base Components page (/studio/base-components, pageKey base-components, catalog src/features/base-components/); do not invent custom base controls, raw HTML form inputs/checkboxes/textareas, or ad-hoc HeroUI markup when a catalogued section exists; match the living sample for that section (component, props, sizes, intents, chrome); Base Components is the visual source of truth — remaining projectStandards entries and topic shards are implementation detail for those primitives',
      appliesTo: [
        'all new UI work',
        'forms',
        'dialogs',
        'toolbars',
        'grids',
        'buttons',
        'Base Components',
      ],
    },
    {
      id: 'ui.heroui.use-v3',
      title: 'HeroUI v3 Via Base Components',
      value:
        'HeroUI v3 is used only through the shared wrappers and compositions shown on Base Components — never as a reason to bypass the catalog or invent parallel base controls',
      appliesTo: ['all new UI work', 'Base Components'],
    },
    {
      id: 'ui.heroui.no-custom-base-if-equivalent',
      title: 'No Custom Base Controls When Catalog Equivalent Exists',
      value:
        'do not create custom base UI elements when Base Components already catalogs an equivalent section or shared wrapper',
      appliesTo: ['input', 'select', 'checkbox', 'textarea', 'button', 'modal', 'Base Components'],
    },
    {
      id: 'ui.heroui.checkbox.use-uicheckbox',
      title: 'HeroUI Checkbox Standard',
      value:
        'boolean toggles follow Base Components → Choice: use UiCheckbox (HeroUI Checkbox wrapper from shared/ui or components/ui/HeroFieldControls); never native HTML input type=checkbox',
      appliesTo: ['checkbox', 'boolean toggles', 'multi-select lists', 'filter toolbars', 'form fields', 'Base Components'],
    },
    {
      id: 'ui.heroui.radio.use-uiradiogroup',
      title: 'HeroUI Radio Standard',
      value:
        'boxed multi-option checkbox/radio lists follow Base Components → Choice: UiCheckboxChoiceList / UiRadioChoiceList (src/shared/ui/FormChoiceFields.tsx); single rows use UiCheckboxChoice; low-level UiRadioGroup with layout=contents only when a custom host is required; option label typography via resolveUiChoiceOptionLabelClass / resolveUiRadioLabelClass; stacked choice rows use UI_CHOICE_STACK_GAP_CLASS (gap-1); exclusive title+description options use option cards (ui.form.choice.option-cards) not radio dots; do not hand-roll HeroUI Radio rows or per-page row className tuning',
      appliesTo: ['radio', 'radio groups', 'form fields', 'settings forms', 'wizards', 'Base Components'],
    },
    {
      id: 'ui.component.default-size',
      title: 'Default Form Control Size',
      value:
        'match Base Components → Form fields group: sm is the default for form field controls (UiInput, UiSelect, UiTextarea, UiAutocomplete, UiCombobox, UiCheckbox, SemVerInput, UrlSegmentSlugInput, DesignerMaskInputField, DesignerDatePickerField); omit size or pass size="sm"; prefer sm and md for routine forms, settings, modals, and toolbars — xs and lg are also supported (see src/shared/ui/heroFieldSize.ts) when a surface needs tighter or larger controls; size is not hard-limited to sm/md; use UiCombobox (HeroUI ComboBox) for typeable filterable pickers — not button-style UiAutocomplete; UiCombobox menuTrigger is focus (default, open list on focus), input (suggestions only after typing), or manual',
      appliesTo: ['UiInput', 'UiSelect', 'UiTextarea', 'UiAutocomplete', 'UiCombobox', 'UiCheckbox', 'form fields', 'settings forms', 'create/edit modals', 'Base Components'],
    },
    {
      id: 'ui.where-builder',
      title: 'Where Builder for Nested Predicates',
      value:
        'nested AND/OR field/operator/value predicates use UiWhereBuilder from Base Components → where-builder; combinator is a segmented AND/OR on the group header (not on every child row, not a tree grid); field and operator are UiSelectMenu dropdowns; value widgets follow field type; closed options render a select (UiCombobox when allowCustomValue); optional contextItems adds a trailing dropdown on text value slots only that writes a server-context expression; a condition or nested group may switch once to a manual expression with no switch-back (delete only); allowReorder shows a grip handle to drag a node among siblings or into another group; list pages that use List Filter mount this builder inside ListFilterDialog with WHERE_BUILDER_LIST_FILTER_CHROME',
      appliesTo: ['filters', 'query criteria', 'record scope', 'predicate editors', 'Base Components'],
    },
    {
      id: 'ui.heroui.style-override',
      title: 'HeroUI Style Override Policy',
      value:
        'avoid overriding HeroUI standard visual styles beyond what Base Components living samples already demonstrate; use layout-level classes when needed',
      appliesTo: ['all HeroUI-based components', 'Base Components'],
    },
    {
      id: 'ui.visual.semantic-color-restraint',
      title: 'Semantic Color — Subtle and Small-Area',
      value:
        'use gentle, concept-matched color to aid scanning — not decoration; prefer color on text, icons, badges, pills, and other small objects; keep large surfaces white/neutral slate (page shell #F8FAFC, cards #FFFFFF, sidebar/header un-tinted, modal body, grid host); never paint chrome from the operator accent; status badges use fixed emerald #10B981 / amber #F59E0B / red #EF4444 and must not follow Cranberry or Gray; reuse existing semantic maps (buttonSemantics.ts, ICON_ACTION_*_CLASS, APP_SURFACE_BOX_TONE_CLASS, grid action colors) — no ad-hoc palette entries; one or two accent hues per view is enough',
      appliesTo: ['all pages', 'forms', 'panels', 'labels', 'badges', 'icons', 'status text'],
    },
    {
      id: 'ui.visual.accent-scope',
      title: 'Accent Color — 10% Rule, Neutral Chrome',
      value:
        'operator accent applies only to primary/create buttons, active sidebar item indicator plus active text/icon, focused input borders, progress bars, and the brand mark; sidebar, header, and page body stay Tailwind slate (#FFFFFF cards, #F8FAFC page, #111827 dark) when generated from the accent picker and must not receive tinted primary fills from that generator; Theme Designer tokens are per logged-in user (theme_presets) with a public catalog default; login screen stays the fixed default accent; dashboard page fill uses bg-surface-shell; secondary icons use a #F1F5F9 well with accent on the glyph only; body text is #334155 or #0F172A (WCAG AA on Light/Soft/Core/Rich/Deep); status Ready/Active/Connected/Errors stay emerald/amber/red regardless of Cranberry or Gray; generated by accentColorUtils.ts + colorTokens.ts — see docs/standards/ui-design-system.md §1',
      appliesTo: ['theme generation', 'admin shell', 'sidebar', 'header', 'AccentColorPicker', 'dashboard', 'status badges', 'AppButton', 'Theme Designer'],
    },
    {
      id: 'ui.appearance.user-scope',
      title: 'Appearance (Theme Designer) scope',
      value:
        'Appearance workspace (pageKey appearance) is the hub for accent_theme, theme_presets, and shell_experience user overrides; admin portal defaults live in platform blob appearancePortalDefaults per mount and apply until the user overrides; theme_presets catalog default + Reset swatch; shell Reset returns to portal defaults; login screen stays fixed default accent — see docs/standards/ui-design-system.md §1',
      appliesTo: ['Appearance', 'Theme Designer', 'accent theme', 'shell experience', 'login', 'user attributes'],
    },
    {
      id: 'ui.visual.color-it',
      title: 'Operator Cue — Color It',
      value:
        'when an operator says “color it” (including the Persian cue transliterated as rangish kon), add concept-matched accents only on small-area backgrounds, borders, fonts/labels, and icons — never large body fills; choose hue from content meaning first (identity indigo/violet, technical cyan, relation emerald/lime, caution/PK amber, danger rose, success emerald), then reuse FormSection / APP_SURFACE_BOX_TONE_CLASS / buttonSemantics maps; do not color every element — restraint beats rainbow; see docs/standards/ui-core.md §Color it',
      appliesTo: ['dialogs', 'forms', 'panels', 'property editors', 'summary sidebars', 'section labels', 'badges', 'icons'],
    },
    {
      id: 'ui.copy.english-only',
      title: 'English-Only Production Source Copy',
      value:
        'production artifacts (Vite client bundle, dist/server.cjs, and public/) must not contain Arabic-script characters in TS/TSX/JSON except allowlisted paths: culture translation masters and packs, multilingual DB seed columns in src/core/db/database.ts, and src/shared/lib/rtlScriptPreviewSamples.ts for RTL/bidi fixtures; operator culture translation values in the database may be any language; built-in culture packs stay English until operators localize; markdown under docs/ and plans/ is exempt and excluded from Electron builds; enforce with npm run hygiene:english-copy in CI; dashboard plan snippets shown in UI must be English — strip non-Latin script at parse time; see docs/standards/ui-core.md §English-only (production)',
      appliesTo: ['all UI copy', 'culture bundles', 'agent labels', 'toasts', 'forms', 'modals', 'seed data', 'production build', 'hygiene'],
    },
    {
      id: 'ui.content.labels-via-cultures',
      title: 'Tenant Content Labels via Cultures Translations',
      value:
        'operator-authored entity labels (settings attributes and similar) use a canonical English label on the record plus a seeded culture-translations key settings.attributes.label.{key}; other languages are edited in Settings → Cultures → Translations only — do not add fixed label_en/label_fa/label_ar columns; resolve with t(key) falling back to label then key',
      appliesTo: ['settings attributes', 'cultures translations', 'content i18n'],
    },
    {
      id: 'ui.visual.icon-label-gap',
      title: 'Icon Beside Title or Label Must Have a Gap',
      value:
        'when a Lucide icon sits beside a title or label, wrap them in inline-flex items-center with a gap — gap-1.5 compact (AppButton, option-card titles, chips, ICON_LABEL_ROW_CLASS) or gap-2 page/section headers (PAGE_HEADER_ICON_TITLE_CLUSTER_CLASS); never adjacent siblings with no gap; constrain the SVG (h-3.5/h-4 + overflow-hidden, PAGE_HEADER_ICON_SLOT_CLASS on page headers) so the glyph cannot overflow into the letters; nav rails keep gap-3 (WORKSPACE_SECTION_NAV_LINK_BASE_CLASS); see docs/standards/ui-design-system.md §6 Icons and ui-toolbar.md §Page header',
      appliesTo: ['page headers', 'PageHeaderToolbar', 'section titles', 'labeled buttons', 'option cards', 'dialog titles', 'floating panels'],
    },
    {
      id: 'ui.visual.typography-hierarchy',
      title: 'Typography Hierarchy for First-Glance Scanning',
      value:
        'vary size, weight, and case so users spot the topic at first glance; productive studio chrome uses typographyRoles.ts: page title text-sm/14px bold, section/card title text-xs/12px semibold, identifiers font-mono text-xs font-normal, field labels text-sm font-normal (TYPE_FIELD_LABEL_CLASS / FORM_FIELD_LABEL_CLASS), field values font-semibold (TYPE_FIELD_VALUE_CLASS / HERO_UI_FIELD_VALUE_CLASS on inputs, selects, textareas, readonly boxes), caption text-[11px] font-normal — never font-semibold on captions or labels and never font-medium; reuse TYPE_* plus DIALOG_PRIMARY_HEADER_TITLE_CLASS and APP_SURFACE_BOX_TITLE_CLASS; catalog inventory (Data Studio tables, Server Functions) uses DevelopmentCatalogCardHeader titleTone=identifier; see docs/standards/ui-design-system.md §2',
      appliesTo: ['all pages', 'forms', 'dialogs', 'panels', 'headings', 'labels', 'helper text'],
    },
    {
      id: 'ui.form.ui-color.unified-control',
      title: 'UI Color Unified Field Control',
      value: 'for ui_color fields, render a unified control with color picker and hex input inside one integrated field container',
      appliesTo: ['ui_color fields', 'form color controls'],
    },
    {
      id: 'ui.form.label-over-input.container',
      title: 'Label Over Input Container Structure',
      value: 'for label-over-input fields, keep label and control in a single vertical container',
      appliesTo: ['form field stacks', 'label-over-input layouts'],
    },
    {
      id: 'ui.form.label-over-input.spacing',
      title: 'Label Over Input Spacing',
      value: 'label start padding must be ps-[4px], and label-to-control spacing must be exactly 2px via gap-[2px], mt-[2px], or mb-[2px]',
      appliesTo: ['form labels', 'form field spacing'],
    },
    {
      id: 'ui.form.field.side-align',
      title: 'Side Form Fields Share A Horizontal Midline',
      value: 'FormField layout=side (dense inspectors, dialog title bands) places the label in FORM_FIELD_SIDE_LABEL_COLUMN_CLASS beside the control; the row is flex items-center so label and value share one horizontal midline — do not items-start that row; stack layout stays label-over-input; see docs/standards/ui-core.md §Forms',
      appliesTo: ['FormField', 'layout=side', 'inspectors', 'dialog title bands'],
    },
    {
      id: 'ui.form.tab-order.fields-only',
      title: 'Form Tab Order Visits Value Controls Only',
      value:
        'Tab/Shift+Tab in product forms moves through value controls in document order: text inputs, textareas, select/combobox triggers, radio groups (one stop per group; arrows move options), UiOptionCardGroup (one stop; arrows/Home/End), checkboxes, switches, and file-upload hosts. Accessory chrome grouped with a field uses tabIndex=-1 (FormAccessorySlot, AppButton tabStop=skip, or formAccessoryTabProps): FieldHintTooltip, Settings labelInfo, AI sparkle, history icons on the label, password visibility, start/end adornment buttons, clear/copy/generate/browse/binding toggles in the same control row, chip dismiss, where-builder add/remove/drag. Relation-picker search stays (it is the field); its clear control skips. Click still works. Do not assign positive tabindex. Footer Save/Cancel/Next stay after the last field. See docs/standards/ui-core.md §Form tab order',
      appliesTo: ['FormField', 'UiInput', 'UiSelect', 'UiRadioGroup', 'UiOptionCardGroup', 'AppButton', 'forms', 'tab order', 'keyboard'],
    },
    {
      id: 'ui.form.field.hint.heroui-tooltip',
      title: 'Field Hints Use HeroUI Tooltip Only',
      value:
        'operator field/label hints must use FieldHintTooltip (HeroUI Tooltip + info icon) via FormField hint prop or Settings labelInfo / SettingsNavScopeHint; never ordinary under-field helper paragraphs (e.g. text-[10px] text-slate-400), native title= attribute hints, or ad-hoc hint chrome; placeholders are for input examples only; dense grid ActionTooltip native title remains the sole performance exception; FormField/FormSection hint also feeds the page guide; see docs/standards/ui-core.md §Page guide',
      appliesTo: ['FormField', 'FieldHintTooltip', 'SettingsNavScopeHint', 'labelInfo', 'forms', 'hints', 'tooltips', 'page guide'],
    },
    {
      id: 'ui.page-guide.hints',
      title: 'Page Guide Title And Hint On Explainable Controls',
      value:
        'the studio tour guide opens with a centered chooser (UiOptionCardGroup) asking what to explain: this page (workspace body, topic, toolbars, fields), other pages and navigation (sidebar, app switcher, nav items), or your capabilities (studio tools and account controls available to this user); after a choice it walks only [data-page-guide] stops in that topic that have both title and hint; skip Home nav and studio logo chrome; FormField hint, FormSection hint or description, FieldHintTooltip, Settings labelInfo, and PageHeaderToolbar description are auto-stops on the page topic; AppButton intent=create, AppSplitButton intent=create, ToolbarSearchInput, ToolbarRefreshButton, ToolbarFilterRadioGroup, ToolbarFilterSelect, ToolbarFilterCheckbox, ToolbarFilterMatchLogicBadge, GridPagingFooter, and AppSearchBox are local page stops; generators and designer auto-CRUD must emit a plain-language hint on every generated field; a Route Tour guide header control next to feedback opens the tour (hidden on phone); Previous from the first stop of a topic returns to the chooser; the tour does not switch to AppEndO chat; click the companion to cycle body shapes; drag it and release to hop it back under the bubble; the active hotspot stays visible and the bubble/companion do not cover it; bubble play/previous/next/done/close are ghost icon-only ICON_ACTION buttons with no visible labels; play shows a cyan circular countdown for the 8-second autoplay interval; hotspot dots swallow pointer events so the control underneath does not activate; do not invent filler hints on every existing field or unlabeled nav item; see docs/standards/ui-core.md §Page guide',
      appliesTo: ['page guide', 'FormField', 'FormSection', 'PageHeaderToolbar', 'Component Designer', 'auto CRUD', 'generated UI'],
    },
    {
      id: 'ui.form.field.invalid-border',
      title: 'Invalid Field Border',
      value:         'when UiInput, UiSelect, UiTextarea, UiAutocomplete, UiCombobox, SemVerInput, or UrlSegmentSlugInput is invalid (isInvalid), show a subtle rose border via HEROUI_FIELD_INVALID_BORDER_CLASS (!border !border-rose-300) from surfaceClasses.ts; default border is HEROUI_FIELD_BORDER_CLASS (!border-[#e2e8f0] plus focus-within/data-focus primary-500); composite fields use resolveHeroUiFieldBorderClass(isInvalid); FormField invalid or error props auto-pass isInvalid and errorMessage to the child control; validation hints default to feedbackPlacement overlay (tooltip above the control via FieldFeedbackShell, flipping below when the viewport or a clipping ancestor has no room) — pass feedbackPlacement below for under-control text-xs text-rose-600 — no heavy red fills or ad-hoc per-page invalid borders',
      appliesTo: ['UiInput', 'UiSelect', 'UiTextarea', 'UiAutocomplete', 'UiCombobox', 'SemVerInput', 'UrlSegmentSlugInput', 'form validation'],
    },
    {
      id: 'ui.form.field.required-invalid-on-mount',
      title: 'Required Field Invalid On Mount',
      value: 'required fields show invalid border from initial render until the value passes validation — do not defer isInvalid until blur or submit; FormField required prop adds rose asterisk; pass invalid for empty required state and error only for meaningful messages (not the word Required); FormField showError=false hides helper text while keeping border; reference Sandbox text-fields and docs/standards/ui-core.md §Form field layout',
      appliesTo: ['FormField', 'UiInput', 'UiSelect', 'UiTextarea', 'wizards', 'create/edit forms'],
    },
    {
      id: 'ui.form.field.use-ui-input',
      title: 'Use Shared UiInput And UiTextarea',
      value:
        'product text entry must use UiInput, UiTextarea, or UiPasswordInput from src/shared/ui (Sandbox text-fields reference) — never raw HTML input type=text|search|password|number|email|tel|url or textarea for operator/admin forms; exceptions: type=file|hidden|color, and component-designer runtime/export parity widgets that intentionally emit native HTML',
      appliesTo: ['UiInput', 'UiTextarea', 'UiPasswordInput', 'form fields', 'create/edit modals', 'toolbars', 'wizards'],
    },
    {
      id: 'ui.form.select.heroui-menu',
      title: 'Closed-Set Pickers Use UiSelect Menu',
      value:
        'fixed option lists on product forms use UiSelect with HeroUI trigger and listbox menu (Base Components selection-fields living sample) — not native HTML select and not UiSelect preferNativeSelect; use placeholder for empty state; when inside clipped wizards/cards/dialogs pass clipSafePopover (or nested on bordered nested surfaces) plus popoverPlacement/shouldFlip so the portaled menu stays visible; typeable filterable enums use UiCombobox; enforce with npm run hygiene:prefer-native-select — see docs/standards/ui-core.md §Closed-set pickers',
      appliesTo: ['UiSelect', 'UiCombobox', 'form fields', 'wizards', 'public portals', 'Base Components'],
    },
    {
      id: 'ui.form.field.auto-dir',
      title: 'Auto Text Direction From First Character',
      value:
        'UiInput and UiTextarea default autoDir=true, and the Markdown editor defaults dir=auto: set dir from the first meaningful character via getContentTextDirection (RTL scripts → rtl, Latin → ltr); explicit dir=ltr|rtl always wins; autoDir is skipped for password/number/email/tel/url and similar machine-oriented types; pass autoDir=false on character-restricted identifier fields (slugs, object names, cron, workflow keys, hex, JSON/code, mono technical ids) where only Latin/allowed chars apply — auto-dir is not useful there; for display text (messages, notes, feedback) use DirectionalText / getDirectionalTextProps; reference Sandbox text-fields State → Auto direction, Sandbox markdown-editor Preview direction → auto, and docs/standards/ui-core.md §Form field layout',
      appliesTo: ['UiInput', 'UiTextarea', 'DirectionalText', 'Markdown editor', 'DesignerMarkdownEditorField', 'form fields', 'RTL', 'text direction'],
    },
    {
      id: 'ui.form.field.validation-overlay',
      title: 'Field Validation Uses Overlay Balloon And Invalid Border',
      value:
        'whenever a field is validated, set isInvalid (or FormField invalid) for the rose invalid border and pass error/errorMessage so FieldFeedbackShell shows the overlay balloon (feedbackPlacement overlay is the default; balloon prefers above and flips below when space is tight); do not use under-field text-rose paragraphs for field-level validation; feedbackPlacement below only when explicitly required; reference docs/standards/ui-core.md §Invalid field state',
      appliesTo: ['FormField', 'UiInput', 'UiTextarea', 'UiSelect', 'field validation', 'errorMessage'],
    },
    {
      id: 'ui.form.field.pair-grid',
      title: 'Form Field Pair Grid',
      value:
        'pair related short fields (name + select, semver + slug, side-by-side choice boxes) with resolveFormFieldPairGridClass from src/shared/ui/formChoiceLayout.ts — grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-x-4 sm:items-stretch when both columns visible; single column when only one field; full-width textarea/notes below the grid not inside it; reference Sandbox text-fields Identity and Choice Behavior sections',
      appliesTo: ['FormField', 'FormSection', 'create/edit forms', 'wizards', 'settings forms'],
    },
    {
      id: 'ui.form.choice.boxed-list',
      title: 'Boxed Checkbox/Radio Choice Lists',
      value:
        'multi-option checkbox or radio lists inside FormSection use UiCheckboxChoiceList / UiRadioChoiceList (src/shared/ui/FormChoiceFields.tsx) with resolveChoiceBoxShellClass chrome — no field label above the box; pair side-by-side with resolveFormFieldPairGridClass(true); exclusive title+description options use option cards (ui.form.choice.option-cards) instead; reference Sandbox Choice Behavior section',
      appliesTo: ['checkbox', 'radio', 'UiCheckbox', 'UiRadioGroup', 'form fields', 'FormSection'],
    },
    {
      id: 'ui.form.choice.option-cards',
      title: 'Exclusive Option Cards (No Radio Dots)',
      value:
        'when each exclusive option has a title plus description (mode/policy/encryption pickers, not a short label list), render UiOptionCardGroup (src/shared/ui/UiOptionCardGroup.tsx): one bordered button/box per option (two options → columns=2, three → columns=3, long stacks → columns=1, short name chips that hug their label → columns=auto) with no visible radio — not UiRadioChoiceList, not HeroUI Radio, do not revive a radio-card wrapper; host role=radiogroup, each button role=radio aria-checked; one tab stop per group (checked or first enabled) with arrows/Home/End between cards; selected state is accent border+light fill; optional per-option tone (AppSurfaceBoxTone) tints border/icon/title at rest and the selected wash — group accentClassName is the fallback; descriptions wrap (whitespace-pre-line); optional Lucide icon sits in the title row (inline-flex items-center gap-1.5, h-3.5 w-3.5 compact / h-4 w-4 default) never a separate chip; field label stays above the grid; living sample Base Components → Choice; product wrapper SmtpEncryptionField; see docs/standards/ui-core.md §Exclusive option cards and §Form tab order',
      appliesTo: ['option cards', 'UiOptionCardGroup', 'encryption', 'mode pickers', 'policy pickers', 'SmtpEncryptionField', 'settings forms', 'wizards', 'form fields', 'Base Components'],
    },
    {
      id: 'ui.form.ai-assist.label-extra-alignment',
      title: 'EUA AiAssist Label Row Alignment',
      value:
        'when AiAssistFormField (context-suggest labelExtra) sits beside a plain FormField in a two-column pair grid, pass labelExtra with AI_FIELD_LABEL_EXTRA_PLACEHOLDER_CLASS (inline-block h-3 w-3 shrink-0) on the plain field to reserve the sparkle icon slot; wrap sections using AiFieldAssistSectionProvider; section-level structured extract via AiStructuredExtractLauncher in the form header toolbar row; reference Sandbox AI assist',
      appliesTo: ['AiAssistFormField', 'FormField', 'eua', 'form fields', 'create/edit forms'],
    },
    {
      id: 'ui.form.ai-chat-panel',
      title: 'Standard AI Chat Panel',
      value:
        'all in-app AI chats (SQL Console, Image Editor, SSH Hub, File Hub, Server Functions editor, Live Designer, Workflow Designer, AppEndO header agent) mount UiContextChatPanel from Base Components → AI Chat Panel; hosts decide docking (beside a console vs inside a host window) — placement is not a catalog option; hosts send context and apply actions through onSend or onSubmitPrompt plus slots (headerSlot, bodySlot, prompt toolbars); pass codeDiffBaseline so ChatCodeBlock shows a changed-line-only diff for full replacements and collapses after 5 displayed lines (AppButton intent=utility expand/collapse); agency is host-settable via agencyModes/agencyMode (ask = chat only, read-only = auto-run read commands, agentic = run every action) with agencyPickerVariant buttons or dropdown; omit agencyModes when the host owns a different mode control; session history + New chat are the default for managed side panels (onSend) — restore latest chat on open, persist in browser storage scoped by sessionHistoryKey or panelKey; host-owned AppEndO fill chats keep history in the host window; Image Editor opts out with sessionHistory={false}; do not rebuild message-list/prompt/model/send chrome per surface; living sample /studio/base-components/ai-chat-panel; see docs/standards/ui-core.md §AI chat panel',
      appliesTo: ['UiContextChatPanel', 'ChatCodeBlock', 'SqlConsoleAiPanel', 'ImageEditorAiPanel', 'SshHubAiPanel', 'FileHubAiPanel', 'ServerFunctionAiPanel', 'ClientComponentAiPanel', 'WorkflowDesignerAiPanel', 'AppEndooPanel', 'AI chat', 'Base Components', 'Server Functions'],
    },
    {
      id: 'ui.form.section.write',
      title: 'How To Write Form Sections',
      value:
        'author create/edit and wizard groups with FormSection only — gold sample Portals → Edit portal (PortalsPageView + PortalBrandFields); pass a short sentence-case English title (Portal, Identity, Redirect, Layout) — FormSection CSS-uppercases and draws the ink bar; never hand-roll h2/h3 headers, pre-uppercased titles, or under-heading helper paragraphs; first section omits divided, every later section sets divided; stack groups with flex flex-col gap-1; dense create/edit uses hint (info icon) not description; pair short fields with resolveFormFieldPairGridClass(true) and put full-width textarea below; set ink and rotate accent / complement / contrast so neighbors differ (accent = record identity, complement = related brand/chrome, contrast = policy/routing); nested FormField labels inherit ink; Enabled / System Protected stay on the dialog top band, not a FormSection; Settings uses SettingsFormGroup instead; see docs/standards/ui-core.md §Form sections',
      appliesTo: ['FormSection', 'FormField', 'create/edit forms', 'wizards', 'modal forms', 'PortalsPageView', 'PortalBrandFields'],
    },
    {
      id: 'ui.form.section.intra-stack',
      title: 'Form Section Intra-Body Stack',
      value:
        'inside create/edit and wizard form bodies, stack FormSection groups with flex flex-col gap-1; first section plain, subsequent sections use divided prop (FORM_SECTION_DIVIDED_CLASS); dense create/edit prefers FormSection hint over FORM_SECTION_DESC_CLASS description paragraphs; see ui.form.section.write and docs/standards/ui-core.md §Form sections',
      appliesTo: ['FormSection', 'create/edit forms', 'wizards', 'modal forms'],
    },
    {
      id: 'ui.dialog.anatomy',
      title: 'Dialog Shell Anatomy',
      value: 'prefer Dialog for visual shell terminology; composable primitives in src/shared/ui/dialog/ (AppDialogShell, DialogPrimaryHeader, DialogBand, DialogBody, DialogFooter) with DIALOG_* tokens in surfaceClasses.ts; layout order: backdrop, shell, PrimaryHeader (fixed h-10), zero or more Bands, Body (white inner host, optional gradient outer), zero or more Footers with ActionFooter last; backdrop profiles admin (CREATE_EDIT_MODAL_BACKDROP_CLASS) and designer (DIALOG_BACKDROP_DESIGNER_CLASS native ::backdrop); admin/create-edit/confirm/wizard div overlays may set backdropTint (faint/light/medium), backdropBlur (soft/default), and backdropTransparency (opaque/soft/clear) — omit all three to keep named profile class strings; transparency is scrim-only so the dialog surface does not fade; no dim/blur/transparency on popover, tooltip, or floating panel; reference docs/standards/ui-dialog.md and /studio/base-components/dialog',
      appliesTo: ['dialogs', 'modals', 'dialog shells', 'create modals', 'edit modals'],
    },
    {
      id: 'ui.dialog.primary-header',
      title: 'Dialog Primary Header',
      value: 'PrimaryHeader uses DIALOG_PRIMARY_HEADER_CLASS (h-10 fixed); title plus optional headerExtra icon-only controls (AppButton size=icon-sm) before Close; Close is optional via showCloseButton (hide it when the operator must decide in the footer) and is always rightmost via AppButton closeIcon when shown; no labeled buttons in primary header',
      appliesTo: ['dialog headers', 'modal headers', 'DialogPrimaryHeader'],
    },
    {
      id: 'ui.dialog.band-tones',
      title: 'Dialog Band Tones',
      value: 'secondary header bands use DialogBand with DIALOG_BAND_CLASS tones: muted (bg-surface-panel-muted), elevated (bg-surface-elevated), shell (bg-surface-shell); variable height; borders border-border-subtle or border-border-divider',
      appliesTo: ['dialog bands', 'dialog subtitles', 'secondary headers'],
    },
    {
      id: 'ui.dialog.footers',
      title: 'Dialog Footers',
      value: 'multiple footers allowed; footer surface uses DIALOG_FOOTER_SURFACE_BG_CLASS (bg-slate-100/90) via surface chrome footer tokens or DIALOG_ACTION_FOOTER_CLASS / DIALOG_AUXILIARY_FOOTER_CLASS / CREATE_EDIT_MODAL_FOOTER_CLASS / STEP_WIZARD_FOOTER_CLASS / GRID_PAGING_FOOTER_CLASS; ActionFooter (DIALOG_ACTION_FOOTER_CLASS) must be last with primary actions (AppButton size=sm, justify-end); AuxiliaryFooter (DIALOG_AUXILIARY_FOOTER_CLASS) for metadata or wizard navigation (justify-between allowed)',
      appliesTo: ['dialog footers', 'modal footers', 'DialogFooter'],
    },
    {
      id: 'ui.form.create-edit.container',
      title: 'Create/Edit Form Container',
      value: 'every create/edit form must have one main container with pure white background (bg-white) and exact 15px padding on all sides (p-[15px]); header must be subtly separated (e.g. bg-slate-50/80) and footer must use DIALOG_FOOTER_SURFACE_BG_CLASS (bg-slate-100/90); header/footer aligned to container edges; body must use one dedicated main container with p-[15px] and a subtle non-dotted texture',
      appliesTo: ['create forms', 'edit forms', 'modal form shells'],
    },
    {
      id: 'ui.form.create-edit.shell-structure',
      title: 'Create/Edit Modal Shell Structure',
      value: 'reuse CreateEditModalShell (src/shared/ui/CreateEditModalShell.tsx) or shared constants CREATE_EDIT_MODAL_BACKDROP_CLASS, CREATE_EDIT_MODAL_SHELL_CLASS, CREATE_EDIT_MODAL_SHELL_MAXIMIZED_CLASS, CREATE_EDIT_MODAL_HEADER_CLASS, CREATE_EDIT_MODAL_BODY_CLASS, CREATE_EDIT_MODAL_BODY_INNER_CLASS, CREATE_EDIT_MODAL_FOOTER_CLASS, CREATE_EDIT_MODAL_SIZE_CLASS, MODAL_SHELL_MAXIMIZED_CLASS from src/shared/ui/surfaceClasses.ts; each opener must pass size (auto, sm–5xl, maximized, or full; default auto); maximized = largest size with 16px inset (CREATE_EDIT_MODAL_BACKDROP_CLASS + size maximized); full = edge-to-edge (CREATE_EDIT_MODAL_BACKDROP_FULL_CLASS); do not use size=full when intent is maximized-with-margin; shell uses rounded-xl border unless full; body slot is edge-aligned via -mx-[15px] and CreateEditModalShell wraps children in CREATE_EDIT_MODAL_BODY_INNER_CLASS (bg-white p-[15px]) flush to body edges; body gradient only (no dotted/noisy pattern)',
      appliesTo: ['create modals', 'edit modals', 'modal shells'],
    },
    {
      id: 'ui.form.create-edit.content-editor-dialog',
      title: 'Markdown HTML Code Editor Dialogs Open Maximized',
      value: 'MarkdownEditDialog, HtmlEditDialog, and any Markdown/HTML/code (Monaco) edit modal default to CreateEditModalShell size=maximized with CONTENT_EDITOR_DIALOG_SHELL_CLASS (flex min-h-0 flex-col overflow-hidden); do not cap those shells with h-[85vh] — it overrides maximized height; a smaller size is allowed only when the opener passes it explicitly (then CONTENT_EDITOR_DIALOG_SIZED_SHELL_CLASS); reference MarkdownEditDialog.tsx, HtmlEditDialog.tsx, docs/standards/ui-dialog.md',
      appliesTo: ['MarkdownEditDialog', 'HtmlEditDialog', 'markdown editor', 'HTML editor', 'code editor', 'content editor dialogs'],
    },
    {
      id: 'ui.form.record-editor.workspace',
      title: 'Record Editor Workspace And Create Identity',
      value: 'complex deep-linked record editors: full-height white flex-1 main with flat semantic FormSection groups and a separate action bar; the read-only inspector is ui.inspector-rail.* (Idea Foundry IdeaFoundryViewRail) — not FormSection/MetaField; when type/locale/format selects the editor or workflow, collect those values in a create dialog, persist first, then navigate to {list}/edit/{id}; identity title lives in the content header; expose an Edit identity dialog only for mutable values, and lock editor-discriminating format/kind after create; see docs/standards/ui-inspector-rail.md and docs/standards/deep-linking.md',
      appliesTo: ['record editors', 'deep-linked edit pages', 'create identity dialogs', 'summary rails', 'generated package forms'],
    },
    {
      id: 'ui.inspector-rail.chrome',
      title: 'Nested-Editor Inspector Rail Chrome',
      value: 'read-only nested-editor inspectors use INSPECTOR_RAIL_ASIDE_CLASS: default width --app-inspector-rail-width 370px (w-80 + 50px; persist 280–560 via useInspectorRailSplit), shrink-0, border-s --app-inspector-rail-border, wash --app-inspector-rail-bg (3.5% --app-accent-rgb into --app-accent-soft — sidebar-paper whisper, not a saturated slab; never 18%+ accent; never mix two slate tokens); inner INSPECTOR_RAIL_INNER_CLASS; cards INSPECTOR_RAIL_CARD_CLASS; gold sample src/features/idea-foundry/components/IdeaFoundryViewRail.tsx; RecordForm Edit/View shares wash + ghost splitter but stays flush unboxed flags; not FormSection, not MetaField, not the Data Studio modeler inspector; see docs/standards/ui-inspector-rail.md',
      appliesTo: ['inspector rail', 'side panel', 'nested editor', 'idea-foundry', 'package deep editors'],
    },
    {
      id: 'ui.inspector-rail.splitter',
      title: 'Inspector Rail Ghost Splitter',
      value: 'inspector rails resize with useInspectorRailSplit + WorkspaceVerticalSplitHandle appearance ghost: 8px transparent hit target, cursor-col-resize, no painted rail/grip/chevron, not collapsible, persist WORKSPACE_SPLIT_PANEL_KEYS per surface; RecordForm Edit/View uses the same ghost handle (default on) with dialog rail width; do not use default or quiet appearance on inspector or RecordForm rails (those paint chrome); see docs/standards/ui-inspector-rail.md',
      appliesTo: ['inspector rail', 'side panel', 'nested editor', 'Idea Foundry', 'Package Details', 'WorkspaceVerticalSplitHandle'],
    },
    {
      id: 'ui.inspector-rail.kv-grid',
      title: 'Inspector Rail Label/Value Grid',
      value: 'inspector KV rows use INSPECTOR_RAIL_KV_CLASS (grid-cols-3 items-start); label INSPECTOR_RAIL_LABEL_CLASS and value INSPECTOR_RAIL_VALUE_CLASS are min-h-8 items-center so they share a horizontal midline; never justify-between, pt-0.5 on the label, or far-right values; display strings use DirectionalText; see docs/standards/ui-inspector-rail.md',
      appliesTo: ['inspector rail', 'side panel', 'MetaField', 'label value'],
    },
    {
      id: 'ui.inspector-rail.titles',
      title: 'Inspector Rail Section Titles',
      value: 'inspector card titles are optional sentence-case English with CSS uppercase (text-[11px] font-semibold uppercase tracking-wider text-slate-400) plus FieldHintTooltip; omit Identity and Audit trail headings; do not duplicate the content-header item title in the rail; audit is an untitled Created/Edited card; see docs/standards/ui-inspector-rail.md',
      appliesTo: ['inspector rail', 'side panel', 'section titles'],
    },
    {
      id: 'ui.inspector-rail.values',
      title: 'Inspector Rail Values And Empty State',
      value: 'inspector glyphs render NavigationIcon never lucide:Name text; compact badges bg-slate-100 text-slate-700; people/model chips flex h-8 w-full in the value column; empty is English None selected not an em dash; people vs models separated by col-span-3 border-t border-slate-100; audit value is username • Mon D, YYYY en-US UTC muted caption; RecordEventHistoryIcon sits beside Created when history.enabled and opens RecordEventHistoryDialog record timeline spine; see docs/standards/ui-inspector-rail.md',
      appliesTo: ['inspector rail', 'side panel', 'chips', 'audit', 'None selected'],
    },
    {
      id: 'ui.form.create-edit.body-gradient-tokens',
      title: 'Create/Edit Modal Body Gradient Tokens',
      value: 'gradient stops are centralized in src/index.css as --color-surface-modal-gradient-top, --color-surface-modal-gradient-mid, and --color-surface-modal-gradient-bottom; top tint must stay light/subtle and bottom tint must remain slightly above zero (never pure white)',
      appliesTo: ['create modals', 'edit modals', 'modal body texture'],
    },
    {
      id: 'ui.form.create-edit.enabled-gated-configuration',
      title: 'Enabled-Gated Configuration Modal',
      value: 'create/edit modals for operator configuration entities with an enabled flag (identity providers, platform mounts, and similar) must follow IdentityProviderFormModal: Enabled first in edge-aligned top band (-mx-[15px] -mt-[15px], border-b border-slate-200 bg-slate-50/80 px-[15px] py-3) with semibold label and helper text; secondary boolean toggles in a second band below (dimmed and disabled while enabled is off); remaining fields in fieldset disabled={!form.enabled} with disabled:opacity-60; new create forms default enabled false; validation errors in rose banner at body top; reference IdentityProviderFormModal.tsx and MountFormModal in PlatformFormModals.tsx',
      appliesTo: ['identity provider modals', 'platform mount modals', 'enabled-gated configuration modals'],
    },
    {
      id: 'ui.form.access-control.modal',
      title: 'Access Control Modal',
      value: 'all operator-facing access editors (server functions, platform portals, MCP servers, and future resources) must use AccessControlModal (src/shared/ui/AccessControlModal.tsx) with FunctionAccessControl (src/shared/api/contracts/server-functions/accessControl.ts); do not build parallel access UIs; shell is CreateEditModalShell size=maximized with UiOptionCardGroup mode cards in header subtitle and four allow/deny columns in body; entity pickers via AccessEntityPickerDialog; PlatformRouteBindingAuth is FunctionAccessControl; parsePlatformRouteBindingAuth accepts FunctionAccessControl or null; every AccessControlModal opener uses AccessControlActionIcon (KeyRound) from src/shared/ui/accessControlAction.tsx and GRID_ACTION_ACCESS_CLASS (text-cyan-600 hover:bg-cyan-50) in grid actions — never Shield/Lock; reference ServerFunctionsPageView.tsx, PortalAccessModal.tsx, McpServersSection.tsx',
      appliesTo: ['access modals', 'server function access', 'application access', 'mcp server access', 'route binding access'],
    },
    {
      id: 'ui.form.dialog.backdrop.blur-no-white-overlay',
      title: 'Dialog Backdrop Blur Without White Overlay',
      value: 'all in-app dialogs and confirmation modals on /client-components (save, duplicate, delete, edit, unsaved-changes, preview, new layout, style/class editors) must render through DesignerDialog using native HTML dialog.showModal() so blur is applied on ::backdrop in the browser top layer; dialog element must use class designer-dialog-native (DESIGNER_DIALOG_BACKDROP_CLASS); canonical CSS in src/index.css: background-color rgba(15, 23, 42, 0.12) and backdrop-filter blur(4px) only — light blur, no saturate(), do not increase blur radius; do not use div-based overlays (e.g. bg-slate-900/40 backdrop-blur-sm) or opaque white/gray/slate scrims as substitutes; reuse DesignerDialog for new dialogs, do not create parallel modal shells',
      appliesTo: ['all dialogs', 'confirmation modals', 'component designer dialogs', 'duplicate dialogs', 'delete dialogs', 'save dialogs', 'preview dialogs', 'edit dialogs'],
    },
    {
      id: 'ui.dialog.backdrop.tint-blur',
      title: 'Overlay Backdrop Dim And Blur',
      value: 'div-based overlay scrims (Dialog admin kind, CreateEditModalShell, ConfirmDialogShell, StepWizardShell) may set backdropTint faint/light/medium (slate-900 12/25/40%), backdropBlur soft/default (2px/4px), and backdropTransparency opaque/soft/clear (opacity 100/70/40 on a dedicated scrim layer) via resolveDialogBackdropLayoutClass + resolveDialogBackdropScrimClass; omit all three props to keep named profile class strings (admin CREATE_EDIT_MODAL_BACKDROP_CLASS, wizard STEP_WIZARD_BACKDROP_CLASS); never none or 8px+ frost; designer native ::backdrop stays 12% + 4px in src/index.css; popover, tooltip, and floating panel have no page scrim',
      appliesTo: ['dialogs', 'create/edit modals', 'confirm dialogs', 'step wizards', 'overlay backdrops'],
    },
    {
      id: 'ui.form.dialog.body.edge-aligned-white',
      title: 'DesignerDialog Body Edge-Aligned White Surface',
      value: 'DesignerDialog default body (bg-surface-workspace p-[15px] inside px-[15px] shell) must not be used as-is because it creates side gutters with color mismatch; every DesignerDialog body must pass bodyClassName !bg-white !p-0 -mx-[15px] (plus flex-1 min-h-0 overflow-hidden only for full-height dialogs) and wrap content in an inner bg-white p-[15px] host so body aligns with header/footer; reference NewLayoutDialog.tsx and DesignerDraftDialog.tsx; do not expose bg-surface-workspace in body side gutters',
      appliesTo: ['DesignerDialog', 'component designer dialogs', 'new layout dialog', 'duplicate dialogs', 'save dialogs', 'edit dialogs', 'delete dialogs', 'preview dialogs'],
    },
    {
      id: 'ui.wizard.shell-structure',
      title: 'Step Wizard Modal Shell Structure',
      value: 'multi-step create/setup flows must use StepWizardShell (src/shared/ui/StepWizardShell.tsx) with STEP_WIZARD_BACKDROP_CLASS (12% slate + blur 4px, aligned to DesignerDialog ::backdrop — not CREATE_EDIT_MODAL_BACKDROP_CLASS admin 40%), CREATE_EDIT_MODAL_SHELL_CLASS (single outer border — do not also apply DIALOG_SHELL_CHROME_BORDER_CLASS), CREATE_EDIT_MODAL_SIZE_CLASS, and STEP_WIZARD_* constants from src/shared/ui/surfaceClasses.ts; default size is 5xl with STEP_WIZARD_SHELL_HEIGHT_CLASS (h-[85vh] max-h-[92vh]) so step changes do not resize the dialog; size maximized/full use CREATE_EDIT_MODAL_SIZE_CLASS height instead of the 85vh cap; layout order is title header, equal-width step indicators, active-step description band, white step body, footer navigation; reference PackageBuilderModal.tsx',
      appliesTo: ['step wizards', 'multi-step modals', 'setup wizards', 'create wizards'],
    },
    {
      id: 'ui.wizard.step-indicators',
      title: 'Step Wizard Step Indicator Band',
      value: 'step indicator band uses STEP_WIZARD_STEPS_HEADER_CLASS with one equal-width grid cell per step; each cell shows optional Lucide icon plus truncated title (text-[11px] font-semibold); stepTabColor default theme uses --app-accent-* washes on selected and unselected cells, with titles and step icons in darkened theme ink (--app-nav-group-header-text / STEP_WIZARD_HEADER_TITLE_INK_CLASS) rather than bright --app-accent-700; wizard dialog title uses the same ink (STEP_WIZARD_HEADER_TITLE_TEXT_CLASS); gray keeps slate/nav cells (active bg-primary-subtle text-primary-700); custom passes { selected, unselected } hexes with darkened ink (accent-700 mixed 64% toward black); completed steps use bg-emerald-50 text-emerald-700 (icon text-emerald-600) only when that recipe is applied; upcoming gray steps use text-text-nav (icon text-text-nav-icon); description band (header 3) uses STEP_WIZARD_DESCRIPTION_CLASS — darker slate veil (STEP_WIZARD_DESCRIPTION_SURFACE_CLASS), not chrome.headerBand and no tram/pattern; active step icon tile and description copy',
      appliesTo: ['step wizards', 'wizard step headers', 'wizard step descriptions'],
    },
    {
      id: 'ui.wizard.footer-navigation',
      title: 'Step Wizard Footer Navigation',
      value: 'footer uses STEP_WIZARD_FOOTER_CLASS with Previous (AppButton intent=cancel, disabled on first step, ChevronLeft), center Step X / Y counter, and Next (AppButton intent=secondary, disabled on last step or when canMoveNext is false, ChevronRight); final-step primary submit action (Create, Save, Apply) renders through footerExtra with intent=primary to the left of the counter; do not replace Next with submit on non-final steps',
      appliesTo: ['step wizards', 'wizard footers', 'wizard navigation'],
    },
    {
      id: 'ui.wizard.validation-and-state',
      title: 'Step Wizard Validation and State',
      value: 'block step advancement with onNext returning false after per-step validation; show validation errors at top of step body in rose banner (rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700); reset wizard state (step index, fields, errors) when modal opens; wire onBackdropClick to close handler; tree/grid-heavy steps may pass bodyInnerClassName !overflow-hidden flex flex-col min-h-0 for nested scroll inside fixed shell height',
      appliesTo: ['step wizards', 'wizard validation', 'wizard state reset'],
    },
    {
      id: 'ui.form.settings.label-info-placement',
      title: 'Settings Label Info Icon Placement',
      value: 'Settings label/title info tooltips use shared FieldHintTooltip via SettingsNavScopeHint: icon must sit immediately after the label text in an inline-flex row with gap-0.5 — use SettingsLabelInfoRow or labelInfo/titleInfo on SettingsField, SettingsToggleField, and SettingsFormGroup; never use flex-1 on the label to push the icon to the far edge; reserve a fixed 16×16 icon slot (reserveInfoSlot, default true) when sibling fields mix with/without labelInfo; default labelBand on SettingsField wraps label rows in SETTINGS_FIELD_LABEL_BAND_CLASS (min-h-8) for grid alignment — pass labelBand={false} on full-width fields stacked below grids; reference SettingsFormPrimitives.tsx and ui-core.md §Field & label hints',
      appliesTo: ['settings forms', 'SettingsField', 'SettingsToggleField', 'SettingsFormGroup', 'SettingsLabelInfoRow', 'SettingsNavScopeHint'],
    },
    {
      id: 'ui.form.settings.section-spacing',
      title: 'Settings Section and Field Spacing',
      value: 'Settings config forms: inter-section spacing via SettingsFormGroup divided (FORM_SECTION_DIVIDED_CLASS / pt-3); stack fields inside one section with SETTINGS_FORM_GROUP_BODY_STACK_CLASS (space-y-2); multi-column rows use SETTINGS_FORM_GRID_GAP_CLASS (gap-2); label-to-control stays gap-[2px]; never apply space-y-* or gap-* stack utilities directly on fieldset — use SettingsDisabledFieldset which wraps children in an inner div; full-width fields below grids (Description, Message textarea, etc.) use SettingsField labelBand={false}; reference PwaSettingsSection.tsx and docs/standards/ui-core.md',
      appliesTo: ['settings forms', 'SettingsFormGroup', 'SettingsField', 'SettingsDisabledFieldset', 'PwaSettingsSection', 'config forms'],
    },
    {
      id: 'ui.form.settings.feature-toggle.no-collapse',
      title: 'Settings Feature Toggles Stay Visible',
      value: 'Settings and config forms: boolean feature toggles (SettingsToggleField / UiCheckbox) must not hide dependent fields when off — keep sections visible and disable child controls via fieldset disabled={!enabled} with disabled:opacity-60 (or per-control disabled); nested toggles disable when the parent feature is off; do not conditionally unmount field groups on toggle; reference PwaSettingsSection.tsx and IdentityProviderFormModal.tsx',
      appliesTo: ['settings forms', 'SettingsToggleField', 'config forms', 'feature toggles', 'SettingsFormGroup'],
    },
    {
      id: 'ui.form.flat-sections-no-boxes',
      title: 'Flat Form Sections (No Panel Boxes)',
      value: 'wizard, create/edit modal, and Settings config field grouping must use flat FormSection + FormField (src/shared/ui/FormSection.tsx) or SettingsFormGroup (src/features/settings/components/form/SettingsFormPrimitives.tsx): accent bar, uppercase section title tinted by tone, optional description and headerExtra, divided prop for top spacing (FORM_SECTION_DIVIDED_CLASS / pt-3) on every group after the first — no horizontal border lines between sections; intra-section field stack uses SETTINGS_FORM_GROUP_BODY_STACK_CLASS (space-y-2); Settings typography and subtle semantic color via getSettingsTypography(sectionId) in settingsSectionTypography.ts (page title, field labels, toggles, checkbox cards, grid lines) — content tints are darker than the Settings nav of the same hue (nav icons stay *-600; content uses *-900–*-950; do not darken submenu/selection); do not wrap form subsections in rounded-md border bg-white/slate panel boxes or per-row tinted cards — **exception:** boxed multi-choice checkbox/radio lists (UI_CHOICE_BOX_SHELL_CLASS in formChoiceLayout.ts), exclusive option-card boxes (SmtpEncryptionField) inside FormSection bodies, and read-only nested-editor inspector cards (docs/standards/ui-inspector-rail.md); AppSurfaceBox is for workspace/tool panels, not arbitrary wizard or settings form sections; bordered shells remain allowed for data hosts (grids, selection tables, AppTableGrid); reference UserCreateWizardModal.tsx, AuthSettingsFields.tsx, PackageBuilderModal.tsx, Sandbox form-fields, docs/standards/ui-core.md §Form field layout, docs/standards/ui-dialog.md',
      appliesTo: ['step wizards', 'create forms', 'edit forms', 'modal forms', 'FormSection', 'settings forms', 'SettingsFormGroup'],
    },
    {
      id: 'ui.dialog.flex-growing-body',
      title: 'Create/Edit Modal Flex-Growing Body Host',
      value: 'when a create/edit modal body must stretch a checklist/grid/list to the footer, wire the full flex chain: shellClassName flex min-h-[min(<px>,72vh)] flex-col overflow-hidden (or size=maximized); bodyClassName flex min-h-0 flex-1 flex-col overflow-hidden !min-h-0; fixed bands shrink-0; growing section via FormSection className flex min-h-0 flex-1 flex-col; scroll only inside bordered data host (flex min-h-0 flex-1 overflow-hidden rounded-lg border + inner overflow-y-auto); do not use AppSurfaceBox fill inside CreateEditModalShell without this chain; do not duplicate section titles (AppSurfaceBox title + inner editor header); checkbox lists use flex flex-wrap gap-2 not fixed grid-cols-3; reference ConfigureDataApiDialog.tsx, docs/standards/ui-dialog.md',
      appliesTo: ['CreateEditModalShell', 'configure dialogs', 'modal checklist hosts', 'FormSection', 'AppSurfaceBox fill'],
    },
    {
      id: 'ui.shell.loading-alive-surface',
      title: 'Portal Shell Loading — Alive Surface (No Blank White)',
      value:
        'every portal shell (studio and future shells) must show an alive loading surface while boot, shell chunks, auth/config, or page modules load — never a blank white viewport; use AppRouteLoading (src/components/AppRouteLoading.tsx): variant fullscreen (default) for platform boot, PortalHost shell Suspense, and auth/config gates — must match #app-boot-splash look (logo + bar + dots on --gradient-shell-atmosphere / --app-accent-* from the active accent theme; never a hardcoded teal palette; no alternate spinner/atmosphere style); first paint hydrates cached theme CSS vars from localStorage (appendo-accent-css-v3) in index.html; variant embedded for lazy pages inside an already-mounted shell (LazyRoute, shell Outlet Suspense) so chrome stays visible with the same compact bar + dots activity; after load, formatted reveal via ShellFormattedReveal + useFormattedRevealReady — keep opaque loading cover until DOM childList is quiet AND nested [data-testid=app-route-loading] is gone, then one cover/content crossfade; fullscreen cover is position:fixed; ShellChromeEnter for first surface — dismiss #app-boot-splash only on onRevealed (after cover exit), never mid-crossfade; put AtmosphereBackdrop inside ShellChromeEnter content not as an outside sibling; ShellRouteEnter for in-shell navigation (disabled during first surface); in-shell menu/link clicks must raise that embedded cover from the click (useShellNavigate / beginShellNavigationPending) so the previous page is not left on screen with no feedback while React keeps it until the next route/chunk is ready; same-path and CMS Settings soft-nav stay uncovered; non-shell auth/public dismiss when UI painted without AppRouteLoading; respect prefers-reduced-motion; see docs/standards/ui-core.md §Portal / shell loading',
      appliesTo: ['portal shells', 'studio shell', 'AppShell', 'AdminLayout', 'DesignerShell', 'route Suspense', 'boot splash', 'lazy pages'],
    },
    {
      id: 'ui.admin-shell.surface-continuity',
      title: 'Admin Shell Surface Continuity',
      value: 'admin shell backdrop, sidebar, and top header must share one light background tone so the layout reads as a single continuous surface',
      appliesTo: ['admin layout shell', 'sidebar surface', 'top header surface'],
    },
    {
      id: 'ui.admin-shell.no-chrome-texture',
      title: 'Admin Shell Chrome Texture Defaults Off',
      value:
        'shell header and sidebar default to no line-pattern texture — do not put header-line-pattern or menu-line-pattern on ADMIN_SHELL_HEADER_CLASS / ADMIN_SHELL_SIDEBAR_CLASS; Theme Designer tokens --app-menu-texture-opacity and --app-header-texture-opacity (0% default) paint optional texture layers; --app-sidebar-fill-opacity and --app-header-fill-opacity (0% default) control chrome frost; geometric AtmosphereBackdrop behind chrome is on by default — Theme Designer token --app-atmosphere-geometry can turn it off; see docs/standards/ui-core.md §Admin shell',
      appliesTo: ['admin layout shell', 'AppShell header', 'AppShell sidebar', 'ADMIN_SHELL_HEADER_CLASS', 'ADMIN_SHELL_SIDEBAR_CLASS'],
    },
    {
      id: 'ui.admin-shell.separator-hidden-by-default',
      title: 'Admin Shell Separator Visibility',
      value: 'separator borders between sidebar/header/logo rails should be visually hidden by matching border color to shell background unless explicit design requires visible separation',
      appliesTo: ['admin layout separators', 'sidebar/header/logo borders'],
    },
    {
      id: 'ui.admin-shell.main-host-edge-anchoring',
      title: 'Admin Main Content Edge Anchoring',
      value: 'main content host must be flush to right and bottom edges with no outer margin on those sides; top and left inset spacing are allowed',
      appliesTo: ['admin main content host', 'layout content wrapper'],
    },
    {
      id: 'ui.admin-shell.header-vertical-center',
      title: 'Admin Shell Header Vertical Center',
      value:
        'compact shell header (<lg) is a 52px content band with items-center; each control (hamburger, logo, title, AppEndoo, avatar) sits on the vertical midline so object-center to header-top equals object-center to header-bottom; safe-area-inset-top is extra padding above that band, never a replacement for matching vertical padding; do not use py-1.5 plus max-lg:pt-[env(safe-area-inset-top)] which zeros the top inset and leaves extra space below; inner row is h-full items-center; desktop lg:h-[59px] unchanged; see docs/standards/ui-core.md §Admin shell',
      appliesTo: ['admin layout shell', 'AppShell header', 'compact chrome', 'ADMIN_SHELL_HEADER_CLASS'],
    },
    {
      id: 'ui.admin-shell.header-title-row',
      title: 'Admin Shell Header Title Row',
      value:
        'below sm (640px) the shell header grows a second band for the page title, centered; row 1 keeps hamburger, mark, AppEndoo, and avatar; hide the inline title on that first row; sm through desktop stay a single header row; see docs/standards/ui-core.md §Admin shell',
      appliesTo: ['admin layout shell', 'AppShell header', 'ADMIN_SHELL_HEADER_TITLE_ROW_CLASS', 'ShellHeaderCompactTitleRow'],
    },
    {
      id: 'ui.admin-shell.header-hints',
      title: 'Admin Shell Header Hover Hints',
      value:
        'shell header utility controls (feedback, tour guide, header nav, account trigger) use HeaderHintTooltip / buildSideHintContent: dark compact chrome, bold hue title, optional description; never native title= on those controls; ADMIN_SHELL_HEADER_VERTICAL_SEPARATOR_CLASS (border-s-2 border-slate-300/90, h-5) between notification bell and expand page width and before account in ShellHeaderAccountEndCluster (not before bell); fullscreen and account control in ShellHeaderAccountEndCluster (account last at inline end) on AdminShellHeader / AppShellHeader (studio + published shells); accent color stays in Appearance — see docs/standards/ui-core.md §Admin shell',
      appliesTo: ['AdminShellHeader', 'AppShellHeader', 'ShellHeaderAccountEndCluster', 'HeaderHintTooltip', 'ShellChromeUtilityNav', 'page guide', 'feedback', 'StudioToolsMenu'],
    },
    {
      id: 'platform.access-assistant.context',
      title: 'Access Assistant (page context)',
      value:
        'ADMIN/DEVELOPER Studio tools (Access Assistant + Edit component): ShellHeaderPageActions lg+ only — not in compact header utility cluster; same StudioToolsMenu (variant window) on FloatingPanelShell and CreateEditModalShell primary headers via WindowChromeStudioToolsMenu + StudioPageToolsProvider; page-scoped Allowed toggles via workspace/access-assistant manifests (core baseline users/roles; other core on-demand) or designer derive; StepWizardShell wizard — Subject picker rows + Access step md:2-col surfaces, shared accessAssistantWizardChrome tokens (no UiCheckboxChoice beside metadata); save merges manifest ids only; excluded on Development/Extensions nav; not Record Policy; see docs/standards/access-assistant.md',
      appliesTo: ['StudioToolsMenu', 'WindowChromeStudioToolsMenu', 'FloatingPanelShell', 'CreateEditModalShell', 'AccessAssistantWizard', 'access-assistant'],
    },
    {
      id: 'ui.admin-shell.collapsed-section-label',
      title: 'Collapsed Sidebar Section Labels',
      value:
        'collapsed sidebar section (nav group) and item labels show the last 6 graphemes when collapsedLabel is empty; optional navigation manifest collapsedLabel overrides the rail text (still max 6 visible graphemes); flyout heading and aria-label keep the full name; the selected box on the collapsed rail is 14px narrower (calc(100% - 14px), centered) so it clears the left and right edges, with no start accent bar and a slightly stronger accent wash than the expanded row; see docs/standards/ui-core.md §Admin shell',
      appliesTo: ['admin layout shell', 'AppShell sidebar', 'TreeNavTwoLevel', 'nav group headers'],
    },
    {
      id: 'ui.admin-shell.profile-drawer-peek',
      title: 'Admin Shell Profile Drawer Peek',
      value:
        'profile drawer is an end-edge overlay like the hamburger nav — never w-full on phone; width is min(400px, calc(100vw - collapsed-rail 81px)) so a strip of the page stays visible and tappable to dismiss; desktop stays 400px; see docs/standards/ui-core.md §Admin shell',
      appliesTo: ['ProfileDrawer', 'admin layout shell', 'AppShell header', 'compact chrome'],
    },
    {
      id: 'ui.admin-shell.no-text-select',
      title: 'Studio Surfaces Are Not Selectable',
      value:
        'the entire studio surface (shell, pages, dialogs, overlays) must not allow text selection; PlatformMountProvider sets data-studio-no-select on html for mount id studio; CSS user-select none covers portaled overlays; restore user-select text only on input, textarea, select, contenteditable, and monaco editors so fields stay editable; public portals stay selectable; see docs/standards/ui-core.md §Admin shell',
      appliesTo: ['studio', 'AdminLayout', 'DesignerShell', 'PlatformMountProvider', 'data-studio-no-select'],
    },
    {
      id: 'ui.admin-shell.geometry-lock',
      title: 'Admin Shell Geometry Lock (Operator Approval)',
      value:
        'admin-shell layout metrics are locked for agents: sidebar widths default 250px expanded (portal-configurable via Appearance portal defaults) / 81px collapsed, logo band 91px/74px, nav host pt-3 pb-2 px-[16px], sidebar-top shortcuts inside nav host, header 59px/52px bands, collapse toggle and [data-sidebar-collapsed] logo CSS in index.css, AppEndLogo sidebar sizes, shell layout-width chrome; single sidebar geometry source adminShellSidebarMetrics.ts with ShellSidebarAside/ShellSidebarColumn; AdminLayout and DesignerPublishedShell (ADMIN_SHELL_LAYOUT_TEMPLATE + ensureShellAdminRootChrome/ensureShellSideNavFillHeight/ensureShellSidebarCollapsedChrome) must stay visually symmetric in LTR/RTL — only nav, culture, portal menu, and approved layout-width options may differ; do not change surfaceClasses ADMIN_SHELL_*, adminShellLayoutTemplate, AppShellSidebar, AdminShellSidebar, DesignerPublishedShellChrome logo slots, or related CSS unless the operator explicitly requested a shell fix and confirmed the edit in session; see docs/standards/ui-core.md §Admin shell geometry lock',
      appliesTo: [
        'AdminLayout',
        'AdminShellSidebar',
        'AppShellSidebar',
        'DesignerPublishedShell',
        'ADMIN_SHELL_LAYOUT_TEMPLATE',
        'surfaceClasses',
        'ShellChromeUtilityNav',
        'AppEndLogo',
        'shell layout width',
        'index.css admin-shell-sidebar',
      ],
    },
    {
      id: 'ui.client-component.viewport-host',
      title: 'Client Component Viewport Host',
      value:
        'every client component inherits UiClientComponent and shows at every size by default (minViewport always + belowMin continue); set tablet/desktop and hide/placeholder only for a named exception; do not invent a parallel viewport gate; designer inspector Min Viewport / Below Minimum apply to every node; see docs/standards/ui-core.md §Admin shell and Base Components → Client component',
      appliesTo: ['UiClientComponent', 'client components', 'Designer inspector', 'DesktopOnlyGate'],
    },
    {
      id: 'ui.button.labeled-icon-required',
      title: 'Labeled Button Icon Required',
      value:
        'no labeled/text AppButton may ship without a leading Lucide icon (h-3.5 w-3.5) before the visible label — modal footer Cancel/Save/Create/Publish rows, form action rows, toolbar labeled actions, and wizard footer actions are invalid when text-only; pick an icon that matches action semantics (X cancel, Plus create, UploadCloud publish/republish, Trash2 delete, Check save/confirm, etc.); exceptions: icon-only buttons (size icon-sm or icon-md with no visible label) and AppButton closeIcon',
      appliesTo: ['labeled action buttons', 'modal footer buttons', 'form action buttons', 'toolbar labeled buttons', 'wizard footer buttons'],
    },
    {
      id: 'ui.button.semantic-intents',
      title: 'Labeled Button Semantic Color Intents',
      value:
        'all labeled/text buttons must use AppButton or buttonSemantics intents: primary/create=solid indigo; cancel=slate outline; destructive=solid rose; destructive-soft=rose outline; confirm=emerald outline; secondary=indigo outline; utility=cyan outline; warning=amber outline; toggle-on=cyan soft; toggle-off=indigo soft (pressed tools only); include/exclude wrap chips use AppSelectionToggle (confirm+Check / cancel+X), never toggle-on/off; modal close icons use AppButton closeIcon',
      appliesTo: ['toolbar buttons', 'modal footer buttons', 'form action buttons', 'labeled action buttons'],
    },
    {
      id: 'ui.icon-action.ghost-only',
      title: 'Ghost Icon Action Buttons',
      value: 'for non-grid icon action buttons (floating row actions, inline input actions, compact tool controls), use ghost icon-only buttons with no border or filled background at rest; reuse ICON_ACTION_*_CLASS from src/shared/ui/surfaceClasses.ts',
      appliesTo: ['floating row actions', 'inline input actions', 'compact tool controls', 'rename input actions'],
    },
    {
      id: 'ui.icon-action.semantic-colors',
      title: 'Icon Action Semantic Colors',
      value: 'confirm/save-positive uses emerald; cancel/close uses slate; inline delete/remove is icon-only Trash2 with ICON_ACTION_BUTTON_BASE_CLASS + ICON_ACTION_DELETE_CLASS (slate at rest, rose on hover) — not destructive-soft; edit and duplicate use slate at rest and indigo on hover; view/preview/test uses slate at rest and cyan on hover; labeled toolbar/modal delete keeps destructive-soft or destructive intent per ui-dialog.md; inline rename confirm/cancel must be icon-only with confirm/cancel semantics',
      appliesTo: ['icon action buttons', 'floating actions', 'inline rename actions', 'compact destructive controls', 'list row remove buttons', 'CrudSetColumnList'],
    },
    {
      id: 'ui.button.icon-only.square',
      title: 'Icon-Only Button Square Shape',
      value: 'icon-only buttons (no visible text label) must be square with equal width and height; use AppButton size icon-sm (h-7 w-7) in compact toolbars or icon-md (h-8 w-8) in page/sidebar tool rows; do not use horizontal padding or unequal dimensions that make icon controls rectangular',
      appliesTo: ['icon-only buttons', 'sidebar tool controls', 'compact toolbar icon buttons'],
    },
    {
      id: 'ui.button.new-plus-icon.secondary',
      title: 'New/Create Icon-Only Plus Button Color',
      value: 'List/toolbar create actions use ToolbarCreateControl (src/shared/ui/ToolbarCreateControl.tsx): one icon-only Plus (AppButton size icon-md intent secondary) or, when 2+ create targets exist, one Plus AppSplitButton dropdown (menu items keep labels); modal/wizard labeled Create keeps intent create (solid indigo); reference UserFilterToolbar.tsx and CrudSet.tsx',
      appliesTo: ['new/create icon-only plus buttons', 'toolbar create actions', 'CrudSet create chrome', 'sidebar new actions', 'palette new actions'],
    },
    {
      id: 'ui.button.split-button.standard',
      title: 'Split Button Standard',
      value: 'all split/dropdown toolbar buttons must use AppSplitButton (src/shared/ui/AppSplitButton.tsx); reference Live Designer toolbar / AppSplitButton samples; modes: dropdown-only (unified trigger) or primary+menu (default action + chevron); sizes: compact h-7 for Component Designer toolbars, sm h-8 for page toolbars; use semantic intent (utility, create, etc.); menu panel/items via SPLIT_BUTTON_MENU_PANEL_CLASS and SplitButtonMenuItem; compound controls with secondary non-menu action use SPLIT_BUTTON_COMPOUND_CONTAINER_CLASS with internal border-l divider',
      appliesTo: ['split buttons', 'dropdown toolbar buttons', 'primary+menu create buttons', 'compound toolbar controls'],
    },
    {
      id: 'ui.button.selection-toggle',
      title: 'Include/Exclude Selection Toggle',
      value:
        'include/exclude wrap chips (export columns, output fields, join fields, chip values) must use AppSelectionToggle: selected = mild emerald confirm + Check; unselected = slate cancel + X; wrap with APP_SELECTION_TOGGLE_WRAP_CLASS; aria-pressed follows selected; never toggle-on/toggle-off, primary/secondary, or text-only AppButton for this role; exclusive picks stay UiSegmentedControl; joined peer actions stay AppButtonGroup; living sample Base Components CRUD Set export columns; see docs/standards/ui-toolbar.md §Selection toggles',
      appliesTo: ['export column chips', 'output field chips', 'join field chips', 'chip values', 'AppSelectionToggle', 'CRUD Set export'],
    },
    {
      id: 'ui.button.group.joined',
      title: 'Joined Button Group',
      value:
        'related peer actions that share one chrome (align, export format, zoom) must use AppButtonGroup (src/shared/ui/AppButtonGroup.tsx) wrapping AppButton children — role=group with required ariaLabel, orientation horizontal (default) or vertical, size sm, leading Lucide h-3.5 icons, usually one shared intent (secondary); do not fake a group with a flex gap-2 row of loose AppButtons; exclusive mode picks stay UiSegmentedControl; toolbar overflow stays ToolbarActionGroup; primary+menu stays AppSplitButton; living sample Base Components → Buttons → button group; see docs/standards/ui-toolbar.md §Button groups',
      appliesTo: ['button groups', 'AppButtonGroup', 'joined action clusters', 'alignment toolbars', 'Base Components'],
    },
    {
      id: 'ui.toolbar.control-size',
      title: 'Toolbar Control Size',
      value: 'sm with fixed height h-8',
      appliesTo: ['toolbar buttons', 'toolbar inputs', 'toolbar selects', 'split-button parts'],
    },
    {
      id: 'ui.toolbar.layout',
      title: 'Toolbar Layout Direction',
      value: 'action buttons align to the left by default; no page title inside toolbar',
      appliesTo: ['all page toolbars'],
    },
    {
      id: 'ui.grid.toolbar.layout',
      title: 'Grid Toolbar Layout',
      value: 'for all table/grid toolbars, filter/search controls align left and action buttons align right',
      appliesTo: ['all table/grid toolbars'],
    },
    {
      id: 'ui.grid.toolbar.action-separator',
      title: 'Grid Toolbar Action Separation',
      value: 'in grid toolbars, place a vertical separator between neighboring action buttons when they are from different categories',
      appliesTo: ['all table/grid toolbars', 'mixed-category action groups'],
    },
    {
      id: 'ui.toolbar.field-implementation',
      title: 'Toolbar Field Implementation',
      value:
        'UiInput and UiSelect in toolbars use the default sm size (omit size or size="sm"); avoid py-* classes that change control height',
      appliesTo: ['toolbar UiInput', 'toolbar UiSelect', 'toolbar field containers'],
    },
    {
      id: 'ui.toolbar.container-surface',
      title: 'Toolbar Container Surface',
      value: 'page toolbar containers use bg-white, px-3 sm:px-5, select-none, and border-b border-slate-200 only; do not add shadow-sm or other elevation on toolbar containers; default PAGE_TOOLBAR_SINGLE_ROW_CLASS (lg:h-14) for all list/grid toolbars — use PAGE_TOOLBAR_MULTI_ROW_CLASS only when desktop genuinely needs 2+ stacked rows; stacks filters then actions on phone; use PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS and PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS on direct children (filters cluster w-full only below lg — at lg+ index.css grid minmax(0,1fr) auto on page-toolbar (and page-toolbar-inner-row) keeps actions in column 2; cramped filters scroll inside page-toolbar-filters-cluster; never z-index actions over filters); each PAGE_TOOLBAR_INNER_ROW_CLASS row is also lg:h-14; reuse classes from surfaceClasses.ts',
      appliesTo: ['all page toolbars', 'grid toolbars', 'settings toolbars'],
    },
    {
      id: 'ui.toolbar.vertical-centering',
      title: 'Page Toolbar Vertical Centering',
      value: 'list/grid toolbar controls must be vertically centered exactly like UserFilterToolbar.tsx: PAGE_TOOLBAR_SINGLE_ROW_CLASS provides lg:h-14 and direct PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS / PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS children use items-center; controls stay h-8; never add asymmetric pt/pb, margin, transform, feature-specific HeroUI wrapper offsets, or global CSS overrides to compensate',
      appliesTo: ['page toolbars', 'grid toolbars', 'generated CRUD toolbars', 'Component Designer grid toolbars'],
    },
    {
      id: 'ui.toolbar.page-header-title-meta',
      title: 'Page Header Title and Inline Metadata Alignment',
      value:
        'workspace page headers with title + inline description use PageHeaderToolbar (src/shared/ui/PageHeaderToolbar.tsx) and PAGE_HEADER_* tokens from surfaceClasses.ts; icon and title wrap in PAGE_HEADER_ICON_TITLE_CLUSTER_CLASS (inline-flex items-center gap-2) with PAGE_HEADER_ICON_SLOT_CLASS — never loose icon/heading siblings; row uses PAGE_HEADER_TITLE_ROW_CLASS (stack on phone, sm:flex-row sm:items-center); title uses PAGE_HEADER_TITLE_CLASS (leading-none); metadata uses PAGE_HEADER_META_CLASS + PAGE_HEADER_META_INLINE_OFFSET_CLASS (sm:mt-[3px]) so the horizontal midline of title and description align; separator uses PAGE_HEADER_META_SEPARATOR_CLASS; do not override leading-snug or ad-hoc mt-* on toolbar metadata; reference PlatformTransferPageView.tsx, SettingsFooter.tsx, SandboxHeader.tsx, FileManagerPreviewHeader.tsx, docs/standards/ui-toolbar.md',
      appliesTo: ['page headers', 'PageHeaderToolbar', 'workspace toolbars', 'inline title metadata'],
    },
    {
      id: 'ui.button.workspace-back',
      title: 'Workspace Back Button',
      value:
        'nested editor / development workspace back controls must use WorkspaceBackIcon (src/shared/ui/WorkspaceBackIcon.tsx) exactly — icon-only native button, hit target h-8 w-8, Lucide ArrowLeft h-6 w-6 strokeWidth 2 with rtl:rotate-180, tokens ICON_ACTION_BUTTON_MD_CLASS + ICON_ACTION_CANCEL_CLASS, required ariaLabel (title defaults to ariaLabel); never AppButton, ChevronLeft, HeroUI Button, or ad-hoc ghost chrome; Designer nodes set workspaceBack=true so runtime/codegen emit WorkspaceBackIcon; living sample Base Components → Buttons; see docs/standards/ui-toolbar.md §Workspace back',
      appliesTo: ['nested editors', 'workspace content headers', 'modeler back', 'Component Designer back', 'CMS content editor back'],
    },
    {
      id: 'ui.toolbar.refresh-button',
      title: 'Toolbar Refresh Button',
      value:
        'page toolbars that reload list/grid data must use ToolbarRefreshButton (src/shared/ui/ToolbarRefreshButton.tsx) as the rightmost control in PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS; size icon-md (h-8 w-8), intent utility, RefreshCw h-3.5 w-3.5 with spin when isRefreshing; title and aria-label from culture actions.refresh; separatorBefore true when other actions precede refresh, false when refresh is alone; never ad-hoc RefreshCw/RotateCw AppButton in page toolbars',
      appliesTo: ['page toolbars', 'grid toolbars', 'settings list toolbars', 'CRUD list toolbars'],
    },
    {
      id: 'ui.toolbar.action-semantics',
      title: 'Toolbar Action Semantic Colors',
      value:
        'toolbar buttons with the same role use the same AppButton intent across pages: create/add/new labeled=create; refresh/reload=ToolbarRefreshButton utility; test/connectivity/expand-collapse=utility; sync/positive reconcile=confirm; push/pull/secondary remote=secondary; clear/flush/bulk delete=destructive-soft; commit/primary workflow=primary; see docs/standards/ui-toolbar.md action table',
      appliesTo: ['page toolbars', 'grid toolbars', 'settings toolbars', 'labeled toolbar buttons'],
    },
    {
      id: 'ui.responsive.selective',
      title: 'Selective Responsive Platform',
      value: 'desktop-first chrome, all studio pages work on phone and tablet: stacked toolbars, presentation=auto grids, CreateEditModalShell near-fullscreen on phone and tablet; do not set minViewport:"desktop" on studio route nav or pageKeys (Server Functions, Git, Data Studio, File Manager, SSH/RDP/Sftp stay reachable below 1024px); optional minViewport on a custom/published binding still hides that nav item via filterAdminShellNavByViewport and renders DesktopOnlyGate on deep link; studio chrome: phone and tablet hamburger overlay drawer (no docked rail, no hover flyouts); desktop >=1024 expandable docked rail — do not change desktop >=1024; compact chrome keeps the AppEnd mark-only logo (appendo-mark-currentColor.svg) in the header and overlay drawer on phone and tablet; desktop lockup stays appendo-wordmark-currentColor.svg under `/assets/appendo/brand/`; page guide hidden on phone, available on tablet+; use viewportTokens.ts + useViewportTier + isOverlayNavTier + isCompactChromeTier (phone <=399, tablet 400-1023, desktop >=1024); AI panel overlay full-screen on phone and tablet (not docked); settings section select on phone; see docs/standards/ui-responsive.md',
      appliesTo: ['admin shell', 'route bindings', 'nav registry', 'mobile layouts', 'new routes'],
    },
    {
      id: 'ui.responsive.adaptation',
      title: 'Responsive adaptation (pages and components)',
      value:
        'canonical rules in docs/standards/ui-responsive.md (Material 3 + Fluent 2 crosswalk: reflow/show-hide, modal drawer <1024, fullscreen dialogs on compact, reposition/reflow/re-architect vocabulary; WCAG reflow + 24/44px targets): tablet shares overlay nav and compact chrome with phone; bounded shell column is full-bleed at all tiers (SHELL_BOUNDED_HORIZONTAL_PAD_CLASS px-0; atmosphere only outside max-w-* on desktop); toolbars stack below lg and ToolbarActionGroup overflow on isCompactChromeTier; shared controls use ComponentViewportVisibility + useComponentViewportVisible (defaults per component, e.g. ListFilterToolbarControl hide-phone); list grids default presentation=auto and cardBelow=tablet with card.phoneRole/tabletRole and hideBelow to trim compact cards; master-detail stacks like FileManagerPageView below lg (primary pane max-h ~45%); nested-editor read-only inspector MUST stack below lg (body then full-width rail max-h ~45%, border-t, no ghost splitter, metadata visible without Details tab); tab/drawer hide for inspector only with named exception in feature shard — see ui-inspector-rail.md §Compact layout; dialogs use AppDialogShell compact fullscreen on isCompactChromeTier; prefer shared primitives over page hidden classes; min layout width 360px; QA mandatory screenshot loop with separate-model critic until STOP — .claude/skills/appendo-qa-ui-responsive-pass (design-system lens in skill; one page per run default, no operator-first mobile check)',
      appliesTo: ['CRUD pages', 'nested editors', 'toolbars', 'AppTableGrid', 'dialogs', 'split workspaces', 'new UI'],
    },
    {
      id: 'ui.inspector-rail.compact-stack',
      title: 'Inspector rail compact stack',
      value:
        'below lg nested-editor read-only inspectors stack vertically: body flex-1 overflow-auto first, then aside full width border-t max-h ~45% overflow-y-auto, same KV cards as desktop; no side-by-side rail, no ghost splitter, no Details tab or collapsed-by-default metadata; end-edge overlay drawer only when a feature shard documents a named exception (very tall rail, read-only-only page); see docs/standards/ui-inspector-rail.md §Compact layout',
      appliesTo: ['nested editors', 'Idea Foundry', 'read-only inspector rail', 'ui-inspector-rail'],
    },
    {
      id: 'ui.toolbar.search-input-width',
      title: 'Toolbar Search Input Width',
      value:
        'ToolbarSearchInput host uses TOOLBAR_SEARCH_INPUT_HOST_CLASS from surfaceClasses.ts: full width on phone (stacked toolbar filters); 150px from md through lg; 200px from xl; reuse ToolbarSearchInput — do not ad-hoc max-w-xs/lg:max-w-sm on toolbar search hosts',
      appliesTo: ['page toolbars', 'grid toolbars', 'ToolbarSearchInput'],
    },
    {
      id: 'ui.toolbar.filter-select-host',
      title: 'Toolbar Filter Select host',
      value:
        'ToolbarFilterSelect uses TOOLBAR_FILTER_SELECT_SINGLE_HOST_CLASS or TOOLBAR_FILTER_SELECT_MULTIPLE_HOST_CLASS from surfaceClasses.ts: below lg hosts flex-grow inside PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS; from lg filters cluster is flex-nowrap with hidden horizontal scrollbar when overflow scroll is needed (never a clipped second row under page-toolbar h-14); roles multi-select narrower lg–xl, full width 2xl+; secondary enums wide-only; do not use raw w-full sm:w-44 UiSelect for list status filters — use ToolbarFilterSelect (PackagesToolbar, UserFilterToolbar)',
      appliesTo: ['page toolbars', 'grid toolbars', 'ToolbarFilterSelect'],
    },
    {
      id: 'ui.list.scroll-toolbar',
      title: 'List page scroll-linked toolbar',
      value:
        'full-height list pages collapse the page toolbar on the first downward grid scroll tick and expand on any upward tick (useCollapsingListToolbar or useListPageToolbarScroll + ListPageToolbarScrollHost/Root + listPageToolbarScrollChrome.ts); ~360ms grid-row clip motion in index.css .list-page-toolbar-scroll-host; layout-settle suppress windows prevent flash on grid resize; near-top always expanded; admin-shell header unchanged; see docs/standards/ui-responsive.md §List page scroll chrome and ui-toolbar.md',
      appliesTo: ['CRUD list pages', 'UsersPageView', 'page toolbars'],
    },
    {
      id: 'ui.toolbar.filter-checkbox',
      title: 'Toolbar Filter Checkbox',
      value:
        'single boolean filters in PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS use ToolbarFilterCheckbox (or PAGE_TOOLBAR_FILTER_CHECKBOX_LABEL_CLASS): bordered h-8 label, w-auto content width, text-xs font-semibold, placed last after search/select; small multi-option checkbox filters use PAGE_TOOLBAR_FILTER_CHECKBOX_GROUP_CLASS with ToolbarFilterCheckboxGroupItem (or PAGE_TOOLBAR_FILTER_CHECKBOX_ITEM_CLASS) per option — never full-row width; high-cardinality filters (Users roles) use ToolbarFilterSelect multiple (empty = All; AND/OR matchLogic is a group inside the open menu, not a sibling badge) — never wrap a long option list as chips; reference PackagesToolbar.tsx and UserFilterToolbar.tsx',
      appliesTo: ['page toolbars', 'grid toolbars', 'filter toolbars', 'ToolbarFilterCheckbox', 'ToolbarFilterSelect'],
    },
    {
      id: 'ui.toolbar.builtin-filter',
      title: 'Toolbar BuiltIn Origin Filter',
      value:
        'every list that filters platform vs operator items uses ToolbarBuiltInFilter (All default, BuiltIn, Not BuiltIn); do not mix BuiltIn into Kind, a hide-built-in checkbox, or a Hide/Show UiSelect; persist builtInFilter and migrate leftover showBuiltIn, hideBuiltinItems, hideBuiltinPortals, and Kind CSVs with migrateLegacyBuiltInFilter; reference Client Components, Server Functions, Libraries, Portals, Navigations',
      appliesTo: ['page toolbars', 'grid toolbars', 'filter toolbars', 'ToolbarBuiltInFilter', 'built-in items'],
    },
    {
      id: 'ui.toolbar.list-where-filter',
      title: 'List Filter Where Builder',
      value:
        'lists that need nested AND/OR (Logs, Record Events, Users, CRUD Set, designer grids) keep inline toolbar filters in PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS and put ListFilterToolbarControl last (separatorBefore when preceded); ListFilterButton opens ListFilterDialog (CreateEditModalShell size 3xl, UiWhereBuilder, WHERE_BUILDER_LIST_FILTER_CHROME); Apply writes ListFilterSummaryBand as page header 2 and sends the tree as GET where JSON; ToolbarRefreshButton stays rightmost in actions only; on Logs / Record Events Include archived stays in filters cluster (data-source toggle, not a predicate); hook useListFilter in src/shared/ui/list-filter/; see docs/standards/ui-toolbar.md',
      appliesTo: ['page toolbars', 'Logs', 'record events', 'list filters', 'UiWhereBuilder', 'ListFilterButton'],
    },
    {
      id: 'ui.search.panel.appsearchbox',
      title: 'Panel Search Box Standard',
      value: 'sidebar, panel, tree, and embedded list search must use AppSearchBox (src/shared/ui/AppSearchBox.tsx) with APP_SEARCH_BOX_* constants from surfaceClasses.ts; bar is edge-aligned (APP_SEARCH_BOX_BAR_CLASS) with no outer gutter; input is borderless (app-search-box-input class + APP_SEARCH_BOX_INPUT_CLASS) with fixed pr-6; clear is icon-only ghost button shown only when value is non-empty and absolutely positioned (APP_SEARCH_BOX_CLEAR_BUTTON_CLASS) so layout does not jump; optional leading slot for adjacent controls; reference FunctionListSidebar and DesignerPaletteSidebar; bordered admin page toolbar filters may continue ToolbarSearchInput until migrated',
      appliesTo: ['sidebar search', 'panel search', 'tree search', 'embedded list search', 'wizard step search'],
    },
    {
      id: 'ui.floating-panel.border',
      title: 'Floating Panel Border',
      value: 'draggable floating windows (FloatingPanelShell, ToolboxPanelShell) use a default 2px themed border via FLOATING_PANEL_SHELL_CHROME_BORDER_CLASS (border-2) and resolveSurfaceChrome in surfaceChromeClasses.ts; colorSource accent (active theme), tone (preset), or custom (hex); body stays white — tint on border and header/footer chrome only; never border-4 brand frames or full-panel color washes; pass borderClassName only to override (include border-2 or explicit width plus tint); overlapping windows raise on click/focus via a shared stack (z-index 100+); owned nested pickers use stackLayer 1; Data Studio modeler windows use MODELER_PANEL_BORDER_* + MODELER_FLOATING_PANEL_* from modelerChipStyles.ts; reference docs/standards/ui-core.md §Floating panels, docs/standards/data-studio-modeler.md, and Base Components floating-panel / toolbox-panel',
      appliesTo: ['FloatingPanelShell', 'ToolboxPanelShell', 'floating panels', 'draggable windows', 'workflow palette', 'toolbox panel', 'data-studio modeler'],
    },
    {
      id: 'ui.canvas.viewport-controls',
      title: 'Canvas Viewport Controls Match Workflow Editor',
      value:
        'every pan/zoom canvas pins three slots: search top-left (CanvasSearchBox = AppSearchBox), zoom in/out/fit bottom-left (CanvasViewportControls / CanvasFlowViewportControls), layout bottom-right (above MiniMap when present); every other canvas button (toolbox, execute, settings) sits at top-right; MiniMap stays bottom-right; canvas clips overflow with no native scrollbars (CANVAS_PAN_VIEWPORT_CLASS) — pan with pointer drag, wheel zooms; dotted slate background (#cbd5e1, 16px); do not invent a parallel zoom bar, percent readout, or per-surface xyflow Controls styling; file-manager image preview stays its own compact inline zoom; see docs/standards/ui-core.md §Canvas viewport and Base Components → Canvas toolbar',
      appliesTo: ['workflow editor', 'org chart', 'schema diagram', 'explain plan', 'GraphCanvas', 'OrgChartCanvas', 'CanvasViewportControls'],
    },
    {
      id: 'ui.overlay.directional-motion',
      title: 'Overlays Open From The Trigger Edge',
      value: 'hamburger drawers, nav flyouts, popovers, split-button menus, dialogs, and AppEndoo overlay use directional enter motion that matches the trigger edge and reading direction (start drawer / rail flyout / popover origin against the trigger / compact dialog from bottom / desktop dialog from center); use overlayMotionPanelProps and overlayMotionBackdropProps; respect prefers-reduced-motion; see docs/standards/ui-core.md §Overlay motion',
      appliesTo: ['admin shell', 'hamburger', 'drawers', 'flyouts', 'popovers', 'menus', 'dialogs', 'AppEndoo'],
    },
    {
      id: 'ui.data-studio.modeler.layout',
      title: 'Data Studio Modeler Layout',
      value:
        'Edge Model modeler is a document-style workspace: white content header (back + icon + objectName identity title + dataSource subtitle + Data datasheet + Dependencies secondary dialog + Record Policies + Sync confirm) over a slate-50 main column (Columns hero, Relations/APIs/Record Policies summaries) and a fixed w-80 white inspector (General/Relations/APIs + Danger zone footer); Data opens an edit-first table datasheet (one editable SELECT with named columns and TOP/LIMIT, save on leaving a row, max 200) without a published app; Dependencies loads only when the header button opens CreateEditModalShell — never auto-fetch in the inspector; Record Policies authoring opens CreateEditModalShell maximized from the section Configure button — the main section is summary-only; deep work (designer, data datasheet, relations diagram, column/relation properties) opens in FloatingPanelShell — not a freeform canvas on the page; shell header is `{nav group} / Data Studio / Edit` with URL `data-studio/edit/{objectName}` and item identity in the content header; see docs/standards/data-studio-modeler.md and docs/standards/deep-linking.md',
      appliesTo: ['data-studio', 'EdgeModelModelerWorkspace', 'modeler', 'studio workspaces'],
    },
    {
      id: 'ui.data-studio.modeler.tokens-and-color',
      title: 'Data Studio Modeler Tokens And Color',
      value:
        'reuse modelerChipStyles.ts tokens (MODELER_PAGE_SURFACE_CLASS, MODELER_CARD_SURFACE_CLASS, MODELER_TITLE/SUBTITLE/CAPTION_CLASS, chip/badge/empty/floating-panel classes); large surfaces stay white/slate-50; semantic hues only on small objects — Columns indigo, Relations violet, PK/kind amber, Physical violet, Logical teal, FK/success emerald, danger rose; never restore MODELER_SECTION_ACTION_BUTTON_CLASS indigo fills or italic technical identifiers; group accent bars use operator nav color on a 2px start bar only; see docs/standards/data-studio-modeler.md §Token catalog and §Color semantics',
      appliesTo: ['data-studio', 'modelerChipStyles', 'modeler chips', 'relation badges', 'column groups'],
    },
    {
      id: 'ui.data-studio.modeler.buttons-and-states',
      title: 'Data Studio Modeler Buttons Density And States',
      value:
        'Sync Model = AppButton confirm; Dependencies = secondary + GitFork (on-demand dialog, not inspector auto-load); Record Policies Configure = secondary + Shield (not KeyRound); Create API = create; New group / Open diagram / Edit designer / inspector icon actions = secondary; Truncate/Delete = destructive-soft in a labeled Danger zone (no ad-hoc rose NativeButton); labeled buttons always lead with Lucide h-3.5 w-3.5; column-group color swatch always visible when editable — rename/move/remove/missing-icon affordances progressive-disclose on group hover/focus-within; Data API rows open ConfigureDataApiDialog on click (hover Access/Hooks open those forms); Built-in/managed function rows open the same Server Functions Settings form (ConfigureFunctionApiDialog) on click, with Access and Hooks icons; platform-only rows stay non-clickable; row actions disclose on hover/focus-within (delete only on Data APIs); empty sections use MODELER_EMPTY_STATE_CLASS; modeler load uses skeleton not orphan text; see docs/standards/data-studio-modeler.md',
      appliesTo: ['data-studio', 'modeler toolbar', 'Sync Model', 'column groups', 'empty states', 'danger zone'],
    },
    {
      id: 'ui.data-studio.modeler.inspector-list-preview',
      title: 'Data Studio Modeler Inspector List Preview',
      value:
        'inspector Relations and APIs lists show the first 5 items (MODELER_INSPECTOR_LIST_PREVIEW_COUNT); remainder stays behind a caption NativeButton link "and N more" that expands in place (Show less collapses); do not let long lists stretch the w-80 rail; see docs/standards/data-studio-modeler.md §Inspector',
      appliesTo: ['data-studio', 'modeler inspector', 'Relations', 'APIs', 'ModelerInspectorListPreview'],
    },
    {
      id: 'ui.data-studio.modeler.floating-chrome',
      title: 'Data Studio Modeler Floating Window Chrome',
      value:
        'Column Properties border MODELER_PANEL_BORDER_COLUMN_CLASS (indigo-200/70); Relation Properties and Relations workspace MODELER_PANEL_BORDER_RELATION_CLASS (violet-200/70); table designer MODELER_PANEL_BORDER_DESIGNER_CLASS (slate-300/90); headers use MODELER_FLOATING_PANEL_HEADER_CLASS / TITLE / HEADER_BAND (white/slate, h-9); property summary asides border-slate-200 bg-slate-50/50 — never indigo-50 panel washes or violet page gradients; General/Identity modals stay CreateEditModalShell; see docs/standards/data-studio-modeler.md §Floating studio windows',
      appliesTo: ['data-studio', 'EdgeModelModelerColumnDialog', 'EdgeModelModelerRelationDialog', 'EdgeModelRelationsPanel', 'EdgeModelDesignerPanel'],
    },
    {
      id: 'data-studio.live-datasheet',
      title: 'Data Studio Live Datasheet',
      value:
        'Data Studio Data panel is an edit-open table/view datasheet: leaving a row writes that row or focuses the invalid cell; one editable SELECT sentence (named columns, TOP/LIMIT max 200) loads the sheet; no paging header, no batch Apply; see docs/standards/data-studio.md §Live datasheet',
      appliesTo: ['data-studio', 'EdgeModelDatasheetPanel', 'live datasheet'],
    },
    {
      id: 'data-studio.studio-meta.schema-identity',
      title: 'Studio-Meta Follows The Table Not The Model Id',
      value:
        'Data Studio studio-meta (Story, tags, column groups, associationMeta) is keyed by schema object (dataSourceId, objectType, objectName); delete/reimport/Sync of the same table reattaches parked meta; hard-delete studio-meta only on package uninstall or unreadable records; empty base_* Story is filled from baseModelStudioStories.ts and operator edits win; see docs/standards/data-studio.md §Studio-meta identity',
      appliesTo: ['data-studio', 'studio-meta', 'edge models', 'Story'],
    },
    {
      id: 'data-studio.platform-api-inventory',
      title: 'Modeler APIs Show Platform Routes And Data APIs',
      value:
        'Data Studio modeler APIs section lists operations (method + path) from Data APIs, built-in/managed functions, and the platform catalog in baseObjectPlatformApis.ts; match by objectName (and rematch Data APIs via function metadata when edgeModelId changed); Data API rows open ConfigureDataApiDialog; function rows open the same Server Functions Settings form plus Access/Hooks; platform-only rows stay read-only and must not be republished through DataApiExecutor; see docs/standards/data-studio.md §Platform API inventory',
      appliesTo: ['data-studio', 'EdgeModelModelerApisSection', 'baseObjectPlatformApis', 'platform APIs'],
    },
    {
      id: 'data-studio.list-count-and-cache',
      title: 'Data API List COUNT And GET Cache Defaults',
      value:
        'list operations honor ?includeCount (client wins over operation countMode none), operation query.countMode/defaultIncludeCount (Data Studio Query tab), Settings server-functions dataApiListIncludeCountEnabled/dataApiListCacheDefaultEnabled (env overrides when set), Designer server grids bind includeCount=static:page1Only and seed gridQuery before first hydration; see docs/standards/data-studio.md §API route standard',
      appliesTo: ['data-api', 'DataApiExecutor', 'designer grids', 'data-studio'],
    },
    {
      id: 'ui.surface.box.appsurfacebox',
      title: 'Surface Box Standard',
      value:         'bordered panel/box shells in wizard steps, sidebars, and embedded workspaces must use AppSurfaceBox (src/shared/ui/AppSurfaceBox.tsx) with APP_SURFACE_BOX_* constants and APP_SURFACE_BOX_TONE_CLASS from surfaceClasses.ts; layouts: panel (white shell, tinted h-9 header band, p-3 body) and strip (compact tinted row without header); vary visual identity by tone only (slate, violet, cyan, indigo, emerald, amber, rose) — tone controls shell border, header background/border, and title color; use headerExtra for trailing header content and fill when body should scroll in flex layouts; reference RoleMcpAccessModal (builtin indigo, external cyan, package violet)',
      appliesTo: ['wizard step panels', 'embedded workspace panels', 'sidebar sections', 'RoleMcpAccessModal'],
    },
    {
      id: 'ui.tool.active-color.non-gray',
      title: 'Active Tool Color Policy',
      value: 'active tool/icon controls must not use slate/gray text colors; gray is reserved for disabled states only',
      appliesTo: ['all active tool/icon controls'],
    },
    {
      id: 'ui.grid.shell.use-apptablegrid',
      title: 'AppTableGrid Shell Standard',
      value: 'all page table/list grids must render through shared AppTableGrid (src/shared/ui/AppTableGrid.tsx) with APP_TABLE_GRID_* constants from surfaceClasses.ts; feature grids supply header/body content only, or use column mode (columns, rows, getRowKey) for declarative grids with built-in column sort/filter headers; table headers must stay sticky (sticky top-0) while body scrolls; paging footers use the footer slot (typically GridPagingFooter); living sample Base Components → Grid / TreeGrid → Paging (on/off with pattern and footer options — not a separate catalog section); Grid Paging default on; TreeGrid Paging default off; AppTableGrid chrome classic (default, flush page list) or hero (joined 8px card, airy rows) is a visual treatment on the same component; pair hero chrome with GridPagingFooter chrome=hero; embedded editors, dialogs, and property panels use chrome=hero (scrollOwner=panel when the parent scrolls)',
      appliesTo: ['CRUD list pages', 'table grids', 'list grids', 'logs', 'cache', 'plugins'],
    },
    {
      id: 'ui.grid.chrome.classic-hero',
      title: 'AppTableGrid Classic And Hero Chrome',
      value: 'AppTableGrid chrome defaults to classic (flush page list, py-3 cells). chrome=hero keeps the same AppTableGrid (sort, filter, column layout, selection, virtualization) and applies the joined 8px card, airy py-4 rows, quieter header, default margin 4px and borderWidth 5px; pass GridPagingFooter chrome=hero in the footer slot. Embedded editors, dialogs, and property panels use chrome=hero (scrollOwner=panel when the parent scrolls). Living sample: Base Components → Grid → Chrome (classic | hero).',
      appliesTo: ['AppTableGrid', 'CRUD list pages', 'embedded grids', 'Base Components Grid'],
    },
    {
      id: 'ui.grid.toolbar.flush-full-height-composition',
      title: 'Toolbar And Grid Flush Full-Height Composition',
      value: 'full-height list pages must follow UsersPageView.tsx + UserTableGrid.tsx: root flex h-full min-h-0 w-full flex-col; toolbar shrink-0; grid host flex min-h-0 w-full flex-1 flex-col; AppTableGrid fillHeight default true (Height 100%) owns the scroll body and GridPagingFooter; fillHeight false hugs row content; the grid host immediately follows the toolbar with zero gap, space-y, margin, padding, or empty spacer so the table header touches the toolbar bottom border; the only allowed chrome in that gap is an active ListFilterSummaryBand (page header 2) — hide it when the filter is inactive; optional child wrappers render only when React.Children.count(children) > 0 because an empty array is truthy; fix structure rather than global CSS/important overrides; generated Designer/CRUD pages must preserve this composition; living sample Base Components → Grid / TreeGrid → Height (100% | content)',
      appliesTo: ['CRUD list pages', 'AppTableGrid', 'generated list pages', 'Component Designer runtime grids', 'page toolbar and grid adjacency'],
    },
    {
      id: 'ui.grid.list-filter.header-2',
      title: 'List Filter Summary Band As Header 2',
      value:
        'an active ListFilterSummaryBand is page header 2 between the toolbar and the grid host (LIST_FILTER_SUMMARY_BAND_CLASS, shrink-0, border-b); it must return null when the summary is empty so flush toolbar→grid adjacency is preserved; click the summary to reopen ListFilterDialog; its X clears the tree; do not invent a second always-visible filter status bar; see docs/standards/ui-grid.md and LogsPageView.tsx',
      appliesTo: ['Logs', 'record events', 'list filters', 'AppTableGrid', 'page toolbar and grid adjacency'],
    },
    {
      id: 'ui.grid.adaptive.presentation',
      title: 'AppTableGrid Adaptive Presentation',
      value: 'all page list grids use AppTableGrid presentation="auto" and cardBelow="tablet" by default (BaseTreeGrid shares the contract): phone renders 1 card per row, tablet renders 2 cards per row, desktop+ stay a table; set presentation="table" only when compact screens must compare many columns; cardBelow "phone" keeps tablet as horizontal table-scroll with a frozen first column; cardBelow "desktop" uses cards at every viewport, only when records are self-contained items not comparison tasks; compact.phone / compact.tablet overlay per-tier layout (keep-table | table-scroll | cards), tablet cardsPerRow default 2 (phone locked to 1), desktop/wide card lists default 2 columns, freezeFirstColumn, collapseExtraFields, showActions, showMeta; standard card layout only (media at logical start + first 3 data fields without labels, remaining fields label:value one line, footer actions via getCardRowActions with delete on the opposite end); BaseTreeGrid cards = stacked rows (no table-scroll or freeze); declare card.role on AppTableGridColumnDef (title, subtitle, meta, field, media, actions, hidden) with optional card.label/card.priority, card.phoneRole/card.tabletRole, and hideBelow (md|lg); media never shows a card field label; reuse renderCell and toolbar/footer sort-filter on phone (no column header filters in card mode); see docs/standards/ui-grid.md',
      appliesTo: ['CRUD list pages', 'AppTableGrid column mode', 'mobile responsive grids'],
    },
    {
      id: 'ui.grid.presentation.cardinality',
      title: 'Choose Cards For Low-Column Collections',
      value: 'choose list presentation by information density: when each record has only a few meaningful display fields (typically title plus 1-3 compact attributes/status values), prefer AppTableGrid presentation="cards" at every viewport; use table/auto when many comparable columns, dense scanning, or cross-row alignment helps',
      appliesTo: ['CRUD list pages', 'vocabulary pages', 'lookup catalogs', 'generated package pages', 'AppTableGrid presentation'],
    },
    {
      id: 'ui.grid.list-card-chrome',
      title: 'List card chrome unity (compact tiers)',
      value:
        'all list cards use LIST_PAGE_CARD_SHELL_CLASS (px-2 py-1.5, shadow-sm, shared hover) + LIST_PAGE_CARD_GRID_GAP_CLASS gap-2 + LIST_PAGE_CARD_GRID_GUTTER_CLASS inset + APP_TABLE_GRID_CARD_ACTIONS_CLASS footer spacing — catalog and AppTableGrid must not diverge padding/shadow/gap per page; phone is always one card per row; CRUD may hide low-value card fields via phoneRole/tabletRole (Users lock/roles on compact); see docs/standards/ui-grid.md §List card chrome',
      appliesTo: [
        'AppTableGrid',
        'DevelopmentCatalogCard',
        'CRUD list pages',
        'Users',
        'Server Functions',
        'catalog list pages',
      ],
    },
    {
      id: 'ui.grid.cell.padding-x',
      title: 'Grid Cell Horizontal Padding',
      value: 'AppTableGrid cellPaddingX (default 5) sets left and right padding on every column via --app-table-grid-cell-px (APP_TABLE_GRID_TABLE_CLASS / APP_TABLE_GRID_CELL_PS_CLASS / APP_TABLE_GRID_CELL_PE_CLASS); living sample Base Components → Grid → Cell padding; actions column width uses 2 × default cellPaddingX in gridActionsColumnWidth; standalone tables without the table class use appTableGridCellPxClass() / appTableGridHeaderCellClass(); see docs/standards/ui-grid.md',
      appliesTo: ['all table grids', 'list grids', 'AppTableGrid', 'BaseTreeGrid', 'composed grid tables'],
    },
    {
      id: 'ui.grid.column.text-direction',
      title: 'Grid Column Text Direction',
      value: 'AppTableGridColumnDef.textDirection defaults to culture (same as active culture/theme direction); use opposite or explicit ltr/rtl only when required — do not pin columns with physical text-left/text-right or [direction:ltr|rtl]; center/end-aligned columns (actions, booleans, dates) skip bidi overrides; living sample Base Components → Grid → Column text direction; see docs/standards/ui-grid.md',
      appliesTo: ['all table grids', 'AppTableGrid', 'AppTableGridColumnDef', 'CRUD Set grids', 'Designer grids'],
    },
    {
      id: 'ui.grid.cell.clip-overflow',
      title: 'Grid Cell Overflow Clip',
      value: 'AppTableGrid body cells must clip at the column edge so values cannot paint into the next column: APP_TABLE_GRID_TABLE_CLASS is table-fixed, body cells use overflow-hidden min-w-0 (APP_TABLE_GRID_BODY_CELL_CLASS / APP_TABLE_GRID_HERO_BODY_CELL_CLASS); default inner wrap is APP_TABLE_GRID_CELL_CLIP_CLASS (truncate/ellipsis); set wrap:true on a column to use APP_TABLE_GRID_CELL_WRAP_CLASS (whitespace-pre-wrap break-words) so long text stacks onto extra lines; header cells stay overflow-visible; column filter popovers and the column-layout menu portal to document.body (fixed) so the split sticky-header overflow-hidden band and row body cannot clip or cover them; fix this in the base grid, not per page; see docs/standards/ui-grid.md',
      appliesTo: ['all table grids', 'list grids', 'AppTableGrid', 'BaseTreeGrid', 'composed grid tables'],
    },
    {
      id: 'ui.grid.column.leftover-filler',
      title: 'Grid Leftover Width Goes To The Unconstrained Column',
      value: 'AppTableGrid table-fixed leftover width goes to the unconstrained column (typically Title); compact columns keep authored widths and sit next to Actions; do not insert a dead __filler__ spacer — that empty band between the last data column and Actions is leftover in the wrong place and split header/body tables then disagree; scrollGutter overlay (default) uses APP_TABLE_GRID_SCROLL_OVERLAY_CLASS + AppTableGridOverlayScrollbars (no layout gutter when overflow toggles) and APP_TABLE_GRID_LAST_COLUMN_OVERLAY_INSET_CELL_CLASS on last header/body cells (+13px inline each side, wins over column !px-*); scrollGutter native only when a page opts in; ShellRouteOutlet is overflow-hidden so list scroll stays in the grid; non-list scroll hosts use AppScrollOverlayHost / APP_SCROLL_OVERLAY_CLASS; see docs/standards/ui-grid.md',
      appliesTo: ['all table grids', 'list grids', 'AppTableGrid', 'generated package pages'],
    },
    {
      id: 'ui.grid.column.resize-default',
      title: 'Grid Column Resize Defaults On',
      value: 'AppTableGrid column resize is on by default: drag the header edge to set width; double-click the resize handle to auto-fit column width to header and visible cell content; widths restore from browser localStorage when persistListKey is set (same list-prefs blob as paging/sort); per-column layout.resizable defaults true; set layout.resizable false or layout false to lock a column; optional AppTableGridColumnDef minWidth sets per-column resize/sanitize floor (global minimum GRID_COLUMN_MIN_WIDTH 48px); selection and typical Actions columns stay locked; hide/reorder/pin stay behind enableColumnLayout; living sample Base Components → Grid; see docs/standards/ui-grid.md',
      appliesTo: ['all table grids', 'list grids', 'AppTableGrid', 'Base Components Grid', 'CRUD Set grids'],
    },
    {
      id: 'ui.grid.column.sort-filter',
      title: 'Grid Column Sort/Filter Standard',
      value: 'CRUD grids should use AppTableGrid column mode with AppTableGridColumnDef (src/shared/lib/appTableGridQuery.ts); each column may enable sort and/or filter independently; set sort:false/filter:false on actions and display-only columns; per-column mode is client or server; client sort/filter requires getSortValue/getFilterValue accessors; parent pages own GridQueryState through useGridQueryState with sanitization before callbacks; footer sort and column header sort must share the same GridQueryState.sort; supported filter types: text, boolean, select (single or multi), dateRange (YYYY-MM-DD); column header filter popovers use draft-then-apply (confirm with apply icon, discard with cancel icon) and icon-only apply/cancel actions (Check/X with ICON_ACTION_CONFIRM_CLASS/ICON_ACTION_CANCEL_CLASS); filter popovers and the column-layout menu are body-portaled (fixed) so split sticky-header overflow-hidden shells cannot clip them (same pattern as AppGridRowActions overflow) and flip align/side when the viewport has no room so last columns do not open off-screen; AppTableGrid headerQueryControlsVisibility defaults to hover (overlay on column header hover; active sort column also reveals on any header-row hover; pinned when filter active or filter popover open) — pass always for inline header icons; when hook slices rows for paging/infinite scroll pass gridQueryMode="server" to avoid re-processing the page slice; AppTableGridColumnHeader sort/filter icons encode mode visually via Lucide strokeWidth (client=GRID_QUERY_ICON_STROKE_CLIENT 1.25, server=GRID_QUERY_ICON_STROKE_SERVER 2.75) resolved per capability with resolveColumnMode (column sort.mode/filter.mode, not grid default alone); sort/filter title and aria-label must include (client-side) or (server-side); do not duplicate header sort/filter controls or override stroke semantics in feature grids',
      appliesTo: ['CRUD list pages', 'table grids', 'AppTableGrid column mode', 'grid query state'],
    },
    {
      id: 'ui.grid.list-mode.paging-infinite',
      title: 'Grid List Mode Standard',
      value: 'CRUD list pages must support both Paging and Infinite Scroll modes with default Paging (DEFAULT_GRID_LIST_MODE); use shared useGridListPresentation for display slicing and scroll-to-load-more; GridPagingFooter must expose listMode/onListModeChange as icon plus label dropdown and hide numbered paging controls in infinite mode; infinite mode shows Showing N of Total via formatGridInfiniteRange and page-size dropdown controls batch size for load-more increments',
      appliesTo: ['CRUD list pages', 'grid paging footer', 'list mode controls'],
    },
    {
      id: 'ui.grid.list-prefs.client-local',
      title: 'List Filters And Pagination Remembered Client-Side',
      value: 'Remember list toolbar filters, pageSize, listMode, grid column sort/filter, and column resize widths per list key in browser localStorage only (APP_LIST_PREFERENCE_KEYS + usePersistedListPaging/usePersistedListFilters + useGridQueryState persistListKey + AppTableGrid persistListKey). Do not store these in user profile/attributes. Do not persist the current page index.',
      appliesTo: ['CRUD list pages', 'grid paging', 'toolbar filters', 'useGridQueryState'],
    },
    {
      id: 'ui.grid.actions.header-empty',
      title: 'Grid Actions Header Visibility',
      value: 'actions columns must not render visible header text',
      appliesTo: ['all table/grid actions columns'],
    },
    {
      id: 'ui.grid.actions.fixed-width',
      title: 'Grid Actions Width Budget',
      value: 'reserve 20px per visible action slot (inline icons plus overflow trigger) and fix actions column width to horizontal cell padding + (20px × slot count) + (7px × (slot count - 1)); when actions exceed maxVisibleActions (default 3) collapse the remainder into AppGridRowActions overflow dropdown; use gridActionsColumnWidth(resolveGridActionSlotCount(count, maxVisible))',
      appliesTo: ['all table/grid actions columns'],
    },
    {
      id: 'ui.grid.actions.disable-instead-of-hide',
      title: 'Grid Conditional Actions Visibility',
      value: 'when an action is not applicable for a row, keep it visible in the same slot but render it disabled and non-clickable instead of hiding it',
      appliesTo: ['all table/grid actions columns', 'conditional actions'],
    },
    {
      id: 'ui.grid.actions.disabled-light-gray',
      title: 'Grid Disabled Action Color',
      value: 'any disabled action tool in grid actions columns must be displayed as light gray using text-slate-400',
      appliesTo: ['all table/grid actions columns', 'disabled action tools'],
    },
    {
      id: 'ui.grid.actions.active-not-gray',
      title: 'Grid Active Action Color',
      value: 'active action tools in grid actions columns must not use slate/gray text colors; gray is reserved for disabled action states',
      appliesTo: ['all table/grid actions columns', 'active action tools'],
    },
    {
      id: 'ui.grid.actions.semantic-map',
      title: 'Grid Action Semantic Icon/Color Map',
      value: 'use consistent action semantics across grids: View/Details uses Eye+cyan; Test/Preview/Login-As/Change-Password uses cyan; Edit uses Pencil+indigo; Activate/Set-Default uses check+emerald; Lock/Unlock/Reset-Password uses amber; Deactivate/Delete/Evict uses rose',
      appliesTo: ['all table/grid actions columns', 'action icon and color semantics'],
    },
    {
      id: 'ui.grid.boolean.icon-only',
      title: 'Grid Boolean Icon Rendering',
      value: 'in table/grid columns, render booleans with icons only: Check+emerald for true, X+rose for false; never render Yes/No text; use - for null/unknown',
      appliesTo: ['all table/grid boolean columns'],
    },
    {
      id: 'ui.grid.date.align-center',
      title: 'Grid Date Column Alignment',
      value: 'date column header and date cell values must both be center-aligned',
      appliesTo: ['all table/grid date columns'],
    },
    {
      id: 'ui.grid.date.format',
      title: 'Grid Date Value Format',
      value: 'date values must be rendered as YYYY-MM-DD and must not use locale-dependent formatting',
      appliesTo: ['all table/grid date columns'],
    },
    {
      id: 'ui.destructive.confirmation.modal',
      title: 'Destructive Action Confirmation Modal',
      value: 'every delete action must require explicit in-app confirmation before execution with no direct delete on first click; applies to component deletes, grid row deletes, node/entity removals, cache/log clears, and all other destructive removal flows; for destructive actions (delete, clear, reset, revoke), use modern in-app confirmation modal (Users pattern); do not use window.confirm',
      appliesTo: ['all destructive actions in UI', 'delete buttons', 'remove actions', 'clear actions'],
    },
    {
      id: 'ui.destructive.confirmation.danger-header',
      title: 'Destructive Confirmation Danger Header',
      value: 'delete and other destructive confirmation dialogs must use a rose-tinted danger header band (border-rose-200 bg-rose-50/80, title text-rose-800, icon text-rose-600); admin UI via ConfirmDialogShell/DialogPrimaryHeader tone=danger (default when confirmIntent=destructive) and DIALOG_PRIMARY_HEADER_DANGER_* tokens in surfaceClasses.ts; component designer via DesignerDialog tone=danger; non-delete warning confirms keep tone=default with semantic icon color only',
      appliesTo: ['ConfirmDialogShell', 'DialogPrimaryHeader', 'DesignerDialog', 'delete confirmation modals', 'destructive confirmation modals'],
    },
    {
      id: 'ui.destructive.confirmation.body',
      title: 'Destructive Confirmation Body Layout',
      value: 'destructive confirmation dialog body is flat white typography only — no nested rounded-md border bg-* panel boxes around the message; use size/weight hierarchy (semibold question, xs muted warning, optional font-mono entity name/path); English copy in RTL locales uses dir=ltr and text-start on the body block; destructive footer uses Cancel plus destructive AppButton with Trash2 icon; reference ServerFunctionDeleteModal.tsx and docs/standards/confirmations.md',
      appliesTo: ['delete confirmation modals', 'ConfirmDialogShell body content', 'destructive confirmation modals'],
    },
    {
      id: 'data.core-table-prefix',
      title: 'Core Control-Plane Table Prefix',
      value:
        'all database tables owned by AppEndO core/platform (control plane) MUST use the physical prefix base_ with snake_case names (e.g. base_users, base_workflow_definitions, base_work_items); new control-plane tables are Sequelize models on controlPlaneSequelize (tableName/field maps), not Prisma; edge/user data source tables and package runtime tables do NOT use base_ unless they are explicitly control-plane entities; zz_ prefix remains for reusable DB utilities/procedures only; new core features ship with Sequelize base_ tables from day one',
      appliesTo: [
        'Sequelize control plane',
        'control plane tables',
        'database initialization',
        'new core features',
        'workflow tables',
        'feature build tasks',
      ],
    },
    {
      id: 'data.prisma.locked',
      title: 'Prisma Is Locked',
      value:
        'do not add Prisma models, prisma/schema.prisma tables, getPrismaControlPlane() calls, or Prisma migrations unless the operator explicitly and clearly grants Prisma for that specific task in the current prompt; existing Prisma control-plane code is legacy and must not be extended; new base_ tables and Data Studio table I/O use Sequelize',
      appliesTo: [
        'prisma schema',
        'control plane tables',
        'new core features',
        'feature build tasks',
        'Data Studio',
        'workbooks',
      ],
    },
    {
      id: 'data.control-plane.sqlserver-default',
      title: 'SQL Server Is The Default Control-Plane Database',
      value:
        'SQL Server is the default and recommended control-plane database; PostgreSQL, MySQL, and SQLite remain optional install-wizard choices; install templates, runtime.databaseProvider, wizard defaults, and Data Sources create form must prefer SQL Server — do not treat PostgreSQL as the primary or implied default',
      appliesTo: [
        'install wizard',
        'settings.json',
        'settings.example.json',
        'control plane',
        'data sources',
      ],
    },
    {
      id: 'data.control-plane.schema-sync.preserve-unknown-tables',
      title: 'Control-Plane Schema Sync Preserves Unknown Tables',
      value:
        'npm run db:sync-schema (and npm run prisma:push) must apply the Prisma control-plane schema additively and must never drop tables or extra columns that are not in prisma/schema.prisma; domain/package tables stay intact; prisma db push --accept-data-loss is destructive opt-in only (--destructive or CONTROL_PLANE_SCHEMA_PUSH_DESTRUCTIVE=1), not the upgrade default; empty databases still receive the full control-plane schema',
      appliesTo: [
        'control plane',
        'schema sync',
        'prisma db push',
        'platform upgrade',
        'domain package tables',
      ],
    },
    {
      id: 'data.control-plane.schema-ownership',
      title: 'Control-Plane Schema Ownership Layers',
      value:
        'Non-Prisma schema has canonical upgrade commands per layer (controlPlaneSchemaOwnership.ts): db:sync-schema for prisma/schema.prisma; schema:install-extensions for Sequelize feature base_* tables; schema:install-extensions --hwy for Hawiety DDL + satellites + hwy:db-objects; schema:ownership-report for live classification; default protected-table merge includes hwy_/cms_/zz_ prefixes; Hawiety schema-ownership dev closeout CLOSED 2026-11-09 — scripts/schema/schema-ownership-closeout.md',
      appliesTo: [
        'control plane',
        'schema sync',
        'hawiety package',
        'platform upgrade',
      ],
    },
    {
      id: 'data.control-plane.provider-locked-after-setup',
      title: 'Control-Plane Provider Locked After Setup',
      value:
        'the control-plane database provider is chosen once during setup; boot, restart, ensureRuntimeSettings, and ensureDataSourcesSettings must not rewrite database.provider, runtime.databaseProvider, or the default data source type to a different engine; never silently fall back to PostgreSQL or pg-pool when SQL Server (or another stored provider) was selected; missing database.engine is Prisma; corrupt settings.json must fail boot rather than stamp PostgreSQL defaults',
      appliesTo: [
        'install wizard',
        'settings.json',
        'bootstrap',
        'control plane',
        'data sources',
      ],
    },
    {
      id: 'data.note-field-naming',
      title: 'Data Model Note Field Naming',
      value: 'when adding an optional free-text field for human-written explanations, remarks, or supplementary context on an entity, name the column/property note (not description); reserve description for product/marketing copy, manifest metadata, or other domain-specific semantics where description is already the established term',
      appliesTo: ['database columns', 'API payloads', 'form fields', 'new entity schemas'],
    },
    {
      id: 'data.audit-columns',
      title: 'Data Model Audit Columns',
      value: 'app-managed tables should include created_at, created_by, updated_at, and updated_by where it makes sense',
      appliesTo: ['app-managed tables', 'new database tables', 'schema migrations'],
    },
    {
      id: 'data.audit-actor',
      title: 'Audit Actor Source',
      value: 'created_by and updated_by should be nullable foreign keys to base_users(id) and set from the authenticated actor whenever one exists; use NULL for system-generated rows',
      appliesTo: ['created_by', 'updated_by', 'data mutations'],
    },
    {
      id: 'ui.grid.audit-actor.non-interactive',
      title: 'Grid Audit Actor Display',
      value: 'in grid/list _by columns (created_by, updated_by), display actor username or fallback id/text as plain non-interactive text; do not render links/buttons and do not navigate to edit/profile/detail forms',
      appliesTo: ['created_by', 'updated_by', 'table/grid actor columns'],
    },
    {
      id: 'ui.grid.audit-column-width',
      title: 'Grid Created/Updated Column Width',
      value: 'Created and Updated audit columns in admin CRUD grids must use fixed width 150px; reuse APP_TABLE_GRID_AUDIT_COLUMN_WIDTH from src/shared/ui/surfaceClasses.ts; applies to Users, Roles, Data Sources, and Plugins list grids including combined date+actor Created/Updated cells',
      appliesTo: ['Users grid', 'Roles grid', 'Data Sources grid', 'Plugins grid', 'created_at', 'updated_at', 'Created column', 'Updated column'],
    },
    {
      id: 'platform.greenfield.no-backward-compat',
      title: 'Greenfield — No Backward Compatibility',
      value: 'initial-implementation greenfield: ship one canonical contract, storage format, and API per feature; no runtime migration on startup/read/write; no dual-format parsers, deprecated config fallbacks, legacy route aliases, auto-migrate-on-read, initDB repair for old layouts, deprecated export shims, or parallel legacy UI modes; breaking changes are acceptable—update defaults/DDL/routes/call sites together and delete retired symbols; validate strictly and reject invalid payloads; scripts/ migration tools are manual out-of-band operator tools only unless an approved scoped task explicitly requires them',
      appliesTo: [
        'runtime startup logic',
        'database initialization',
        'settings and config loaders',
        'API routes',
        'on-disk artifact stores',
        'shared UI components',
        'schema/data migration code',
      ],
    },
    {
      id: 'component-designer.public-component-name',
      title: 'Component Designer — Public Component Name',
      value: 'outside the Component Designer workspace, identify saved components by name; disk files live under workspace/designer/drafts/general/; never expose draft/version ids (e.g. draft-…) in preview URLs or cross-feature APIs; preview uses ?component={name} (legacy folder/name still resolves); experience manifest pageKey remains the component name slug; draft index and draft ids are designer-internal persistence only; reference docs/standards/component-designer.md',
      appliesTo: [
        'component designer preview',
        'experience manifest',
        'portal navigation',
        'designer route propagation',
        'component-designer API consumers',
      ],
    },
    {
      id: 'component-designer.catalog.flat-folder',
      title: 'Client Components Catalog Is Flat',
      value: 'Client Components catalog is a single list of saved components (operator drafts + installed package UI); the toolbar Kind filter is a ToolbarFilterSelect (All by default with no filter, plus Custom, Shell, Template — type only); BuiltIn is ToolbarBuiltInFilter (All default, BuiltIn, Not BuiltIn) and is not a kind; an item is listed when All is selected for type or its type matches; do not split the catalog into Templates or tag headings — tagged drafts and built-in starters sit in the same grid; page starter presets (blog-list, contact-form, …) live in the virtual templates folder — Create → Based on Templates copies that starter’s layout nodes (heading, cards, form fields) into a named component, not a single composite template widget; saved drafts tagged template or any other tag remain editable; catalog cards put type as footer text badges next to the date, same chrome as Server Functions (BuiltInBadge for built-ins; custom/shell/template CatalogSystemTagBadge otherwise — builtin amber, template cyan, shell indigo, custom emerald; package UI uses custom; do not show operator-tag chips or package-source badges or title-row dots); search matches name and kind; clicking a card title opens Live Designer for every component including built-in starters, templates, and shells — first save writes an editable overlay draft under the same name and hides the built-in row; Duplicate still copies to a new name; built-in portal shells (app-shell) live in the main catalog folder (general), not templates; no Pages/App Shells filter; catalog footer page size is locked at 1000 with no page-size dropdown and no paging/infinite switch (sort stays); Create is an AppSplitButton dropdown (CRUD Set, Based on Templates — no Start-step kind cards; Empty is parked like API Connected Form/Grid); CRUD Set follows docs/standards/crud-set.md and CrudSetSpec (wizard only sets CrudSet props; AI uses .claude/skills/appendo-build-crud-set); last wizard step is always name + optional tags; API Connected Form/Grid/CRUD Set remain in code but are not catalog Create options; CatalogTagsField inside DesignerDialog uses an in-tree listbox with UiCombobox menuTrigger=input so previous tags appear only after typing, or type a new one and press Enter; the Tags dialog has no footer and persists each add/remove immediately; every draft persists under workspace/designer/drafts/general/ (portal-layouts is a virtual portal shell prefix, not a disk folder); folder must not appear in titles, editor URLs, create/rename dialogs, or catalog sort/filter chrome; reference docs/standards/component-designer.md',
      appliesTo: [
        'Component Designer catalog',
        'designer draft storage',
        'client-components',
      ],
    },
    {
      id: 'component-designer.crud-set',
      title: 'CRUD Set Contract',
      value:
        'a CRUD Set is one unified CrudSet (src/shared/ui/CrudSet.tsx, Base Components CRUD Set) customized by CrudSetSpec props: list + optional filter bar + optional creates + purpose patches + optional content-edit patch + optional delete + optional export + optional refresh; body is required (grid, tree-grid, kanban, or map) and columns stay required; wizard only sets those props and does nothing else; first question is always collection mode (suggest-then-cut vs decide-now); every option is a question and the assistant always has a suggestion; list API is required; columns is required (which list-API fields, array order left-to-right, do not dump every field, actions column appended last); filterBar.enabled is operator-chosen (default on; false hides search and field filters); pagination is a spec option (grid default on with GridPagingFooter customized by paging pattern/page sizes/summary/first-last/list-mode, off = full queried set no paging footer; tree-grid, kanban, and map never paged); sorting.footer defaults on with the paging footer, defaultField first sortable column, defaultDirection asc; refresh is a spec option (default on); omit the toolbar when filter bar, create, export, collection, auto-refresh, and refresh are all off; each create has acceptedFields; read-one is required when a form patch or delete exists (not for boolean-toggle); omit chrome for missing APIs; two+ creates default to AppSplitButton (createLayout split) and adjacent is two labeled Create buttons for identity; form patches are read-one then dialog then only acceptedFields then confirm then list refresh; a purpose patch with exactly one boolean uses interaction boolean-toggle (click inverts list-row value, no read-one form; toggleConfirm optional); delete is read-one display then rose PK confirm; Export toolbar opens an options dialog (columns, editable filename stem with locked xlsx/csv extension, include header, both xlsx and csv by default — full queried set, server ExcelJS/CSV, no PDF, no immediate download); content-edit opens from the title/display/id column by default (openFromColumnId actions to keep it in the actions column); other patch/delete actions last column unless openFromColumnId; chrome gold is Users; see docs/standards/crud-set.md',
      appliesTo: ['CRUD Set', 'CrudSet', 'Base Components', 'Client Components', 'Component Designer'],
    },
    {
      id: 'component-designer.crud-set.spec',
      title: 'CRUD Set Spec Is Shared',
      value:
        'do not invent a second CRUD Set shape; CrudSet is the only runtime; the Client Components Create → CRUD Set wizard only sets CrudSet props from CrudSetSpec and does nothing else; the crud-set skill fills the same spec then renders one CrudSet; living sample is Base Components CRUD Set; see docs/standards/crud-set.md',
      appliesTo: ['CRUD Set wizard', 'crud-set skill', 'CrudSet', 'Component Designer'],
    },
    {
      id: 'component-designer.crud-set.columns',
      title: 'CRUD Set Grid Columns Are Explicit',
      value:
        'CRUD Set grid/tree-grid columns come from CrudSetSpec.columns: each entry names the list-API dataset field the cell reads (field, optional secondaryField+stack), with label, cellKind (includes image and audit), optional transform (date-only/year/custom, yes-no, case), imageMask, sortable, filterable, width, optional conditionalFormat rules (when + operator-picked background hex via color picker, first match paints the cell background — not a side border), cardRole (first column title), hideBelow, isRowHeader, formPlacement (main vs Edit/View side panel; suggest side for boolean-icon and lock-status), formControl (auto/text/password/image/color/html/json/…), optional visibleWhen (sibling field equals), resizable (default on), and hideable/reorderable/pinned when grid.enableColumnLayout is on; array order is left-to-right; at least one column; do not render every API field by default; the actions column is not in columns and is appended last unless a patch openFromColumnId names a column id or field; export dialog column picks start from this same list; wizard and living-sample Columns lists show the column name plus Edit (details in CreateEditModalShell via CrudSetColumnPropertyFields, including Form placement); see docs/standards/crud-set.md',
      appliesTo: ['CRUD Set', 'grid columns', 'list API', 'AppTableGrid'],
    },
    {
      id: 'component-designer.crud-set.filter-bar',
      title: 'CRUD Set Filter Bar Is Operator-Chosen',
      value:
        'CRUD Set left toolbar is CrudSetSpec.filterBar: enabled defaults on (false hides the whole left cluster, including search and field filters); search defaults on (ToolbarSearchInput) when the bar is on; searchClear defaults on; 0..n field filters each have field, label, controlType (checkbox-group, radio-group, select), options, optional optionsFrom (static or distinct-rows from the current list), and checkbox matchLogic; array order is left-to-right after search; do not dump every column into the filter bar; chrome is Users (ToolbarFilterCheckboxGroupItem, ToolbarFilterRadioGroup, ToolbarFilterSelect, ToolbarFilterMatchLogicBadge); column-header filters stay on the grid; see docs/standards/crud-set.md',
      appliesTo: ['CRUD Set', 'filter bar', 'page toolbar', 'Users toolbar'],
    },
    {
      id: 'component-designer.crud-set.pagination',
      title: 'CRUD Set Pagination Is Optional',
      value:
        'CRUD Set pagination is CrudSetSpec.pagination plus paging chrome: grid and kanban default on shows GridPagingFooter; paging.pattern numbered (page numbers) or prev-next; default page size 50 from the closed catalog 50/100/500/1000/10000 (pageSizes, cannot drop the last); summary and first/last default on; listModeSwitch default on with defaultListMode paging; pagination off omits the paging footer and shows the full queried set in one scroll; tree-grid and map are never paged; do not invent a second footer or cursor/load-more patterns; export still dumps the full queried set either way; see docs/standards/crud-set.md',
      appliesTo: ['CRUD Set', 'GridPagingFooter', 'list paging', 'tree-grid'],
    },
    {
      id: 'component-designer.crud-set.sorting',
      title: 'CRUD Set Sorting Is Operator-Chosen',
      value:
        'CRUD Set sorting is CrudSetSpec.sorting: footer sort field + direction show on GridPagingFooter when pagination is on and sorting.footer is not false (suggest on); defaultField is the first sortable column; defaultDirection asc; those defaults apply even when the footer is off; column-header sort still follows columns[].sortable; do not put list sort in the toolbar; see docs/standards/crud-set.md',
      appliesTo: ['CRUD Set', 'GridPagingFooter', 'list sort', 'AppTableGrid'],
    },
    {
      id: 'component-designer.crud-set.grid',
      title: 'CRUD Set Exposes AppTableGrid Public Props',
      value:
        'CRUD Set grid chrome is CrudSetSpec.grid: every operator-facing AppTableGrid public prop (chrome classic/hero, density default/compact, fillHeight, stickyHeader, presentation table/auto/cards/table-scroll, cardBelow when auto, selection none/single/multiple, empty/loading messages, ariaLabel, margin, borderWidth, enableColumnLayout/showColumnLayoutControl for hide-reorder-pin (suggest off; column resize stays on by default), compact phone/tablet policy); card view is the single standard layout (not operator-configurable); tree-grid omits table-scroll, freeze-first, and cards-per-row; do not expose className, query state, or ReactNode slots; GridPagingFooter chrome follows grid.chrome (hero → hero, else page); see docs/standards/crud-set.md',
      appliesTo: ['CRUD Set', 'AppTableGrid', 'GridPagingFooter', 'grid chrome'],
    },
    {
      id: 'component-designer.crud-set.kanban',
      title: 'CRUD Set Exposes Kanban Public Props',
      value:
        'CRUD Set kanban chrome is CrudSetSpec.kanban when listBody is kanban: statusField/titleField/descriptionField (default status/title/subtitle); statusColumns define board columns and replace the status toolbar filter; UiKanbanBoard height full/auto, columnWidth sm/md/lg, columnLayout fill/scroll (default fill), density compact/comfortable, showCardCount/showDescriptions, coloredColumns or single tone, hideEmptyColumns, interactive, enableKeyboardMove, wipLimit per column (0 off); kanban supports pagination like grid; wizard and Base Components living sample show CrudSetKanbanFields; see docs/standards/crud-set.md',
      appliesTo: ['CRUD Set', 'UiKanbanBoard', 'kanban chrome'],
    },
    {
      id: 'component-designer.crud-set.actions',
      title: 'CRUD Set Exposes Row-Action Public Props',
      value:
        'CRUD Set actions column is CrudSetSpec.actions: AppGridRowActions maxVisible 1..5 (default 3) and align start/end/center (default end); extra rowActions are host callbacks (onHostAction) or a view dialog; optional disabledWhen / deleteDisabledWhen; collectionActions are toolbar buttons on the queried set (onCollectionAction); the actions column is still appended last unless a patch uses openFromColumnId; see docs/standards/crud-set.md',
      appliesTo: ['CRUD Set', 'AppGridRowActions', 'row actions'],
    },
    {
      id: 'component-designer.crud-set.dialogs',
      title: 'CRUD Set Exposes Dialog Public Props',
      value:
        'CRUD Set dialogs are CrudSetSpec.dialogs: CreateEditModalShell formSize sm/md/lg/xl/2xl/3xl/4xl/maximized/full (default lg) for create and form patch; more than four fields auto-widen to 4xl unless maximized/full; export is locked 2xl; ConfirmDialogShell confirmSize sm/md/lg (default sm) for delete and toggle-confirm; shared showCloseButton, closeOnEscape, showHeader, showFooter, backdropTint/Blur/Transparency; confirmInitialFocus cancel (safer) or confirm; sidePanelTitle is the Edit/View side-column heading (default Flags); sidePanelPlacement is right/left/end (opposite theme direction, default)/start (same as theme direction); sidePanelPinnable default off; sidePanelSplitter default on (ghost — no painted rail); sidePanelShowTitle default on and sidePanelTitleInHeader default off (in-body heading); createComponent/editComponent/viewComponent are optional designed RecordForm component names (empty generates from columns); viewKind is record-form (default), json, or thread; delete tone stays locked danger; do not expose contained, className, or ReactNode slots; see docs/standards/crud-set.md',
      appliesTo: ['CRUD Set', 'CreateEditModalShell', 'ConfirmDialogShell'],
    },
    {
      id: 'component-designer.crud-set.edit-view',
      title: 'CRUD Set Edit And View Use RecordForm',
      value:
        'CRUD Set create, form-patch, and view/delete-display bodies are RecordForm (Base Components Edit / View, palette heroui.record-form): main fields plus an optional docked side panel for formPlacement side (checkboxes, lock status) flush to header/footer/edge with equal 15px padding on the main column; default placement end (opposite theme direction); theme fill is --app-inspector-rail-bg (3.5% accent wash) and the splitter is ghost by default (WorkspaceVerticalSplitHandle appearance ghost); pin, show-title, title-in-header, and custom hex fill remain dialogs chrome; formControl and visibleWhen apply; View is read-only with no submit; patches use the Edit form; dialogs may name a designed Edit/View component; wrapping dialogs honor showHeader/showFooter; hand-written CRUD create/edit/view dialogs (Roles, Base Info, Org/Geo vocab) also render RecordForm — do not fork a parallel FormSection layout; configurators use CrudSetConfigCheckbox as a yes/no select (short label beside select); RecordForm booleans pass control="checkbox"; do not wrap each field in a second section with the same title or repeat labels; boxed KV inspector cards stay nested-editor only; see docs/standards/crud-set.md and docs/standards/ui-inspector-rail.md',
      appliesTo: ['CRUD Set', 'RecordForm', 'Edit / View', 'Component Designer'],
    },
    {
      id: 'component-designer.crud-set.refresh',
      title: 'CRUD Set Refresh Is Optional',
      value:
        'CRUD Set Refresh is CrudSetSpec.refresh: default on shows ToolbarRefreshButton rightmost on the toolbar; false hides it; autoRefresh.enabled adds a checkbox next to Refresh (default off); omit the whole toolbar when filter bar, create, export, collection, auto-refresh, and refresh are all off (do not render an empty strip); the grid stays; see docs/standards/crud-set.md',
      appliesTo: ['CRUD Set', 'ToolbarRefreshButton', 'page toolbar'],
    },
    {
      id: 'component-designer.crud-set.operator-decides',
      title: 'CRUD Set Operator Decides Every Selected Piece',
      value:
        'CRUD Set options are questions: first ask CRUD_SET_FIRST_QUESTION (suggest-then-cut vs decide-now); the assistant always has a suggestion for every applicable selected-piece question (columns, include filter bar, include refresh, pagination plus paging chrome, sorting, export, include create, include patches, each create acceptedFields, each patch interaction); suggest-then-cut applies suggestions and renders one CrudSet; decide-now asks with the suggestion shown; do not render CrudSet before the fork, do not ask a blank option; see docs/standards/crud-set.md §Collection',
      appliesTo: ['CRUD Set', 'CRUD Set wizard', 'crud-set skill', 'operator decisions'],
    },
    {
      id: 'component-designer.crud-set.collection',
      title: 'CRUD Set Collection Mode Fork',
      value:
        'CRUD Set collection starts with CRUD_SET_FIRST_QUESTION: suggest-then-cut (assistant fills every option from its suggestions, operator cuts later) or decide-now (ask each option with a suggestion); English copy lives in crudSetSpec.ts; see docs/standards/crud-set.md §Collection',
      appliesTo: ['CRUD Set', 'crud-set skill', 'AppEndO Agent', 'CRUD Set wizard'],
    },
    {
      id: 'component-designer.crud-set.paths',
      title: 'CRUD Set Has Two Entry Paths',
      value:
        'CRUD Set has two related paths over one spec and one CrudSet: the catalog Create wizard only sets CrudSet props from CrudSetSpec; the AI skill fills the same spec then renders one CrudSet; living sample is Base Components CRUD Set; do not generate a parallel toolbar+grid+dialogs page; do not use hidden API Connected Form/Grid/CRUD Set starters; see docs/standards/crud-set.md',
      appliesTo: ['CRUD Set', 'Client Components catalog', 'AppEndO Agent'],
    },
    {
      id: 'component-designer.crud-set.sample-mock',
      title: 'CRUD Set Living Sample Uses base_sample_mock',
      value:
        'CRUD Set living sample binds GET/POST/PATCH/DELETE /api/sample-mock/records to control-plane tables base_sample_mock_* (records with parent_id for tree, latitude/longitude for map, statuses belongsTo, people belongsTo, details hasOne city+note, comments hasMany, tags belongsToMany via record_tags). Standard columns show every cellKind. Relation includes are togglable in Base Components and omit the matching column plus create/edit fields. Seed always with control-plane reference data. See docs/standards/crud-set.md',
      appliesTo: ['CRUD Set', 'Base Components', 'sample mock', 'base_sample_mock'],
    },
    {
      id: 'component-designer.crud-set.boolean-toggle',
      title: 'CRUD Set Boolean-Toggle Patch',
      value:
        'a purpose patch whose acceptedFields is exactly one boolean may use interaction boolean-toggle: no read-one form; click inverts the list-row value and PATCHes; toggleConfirm false (default) applies on click, true shows ConfirmDialogShell first; do not use boolean-toggle on content patches, multi-field patches, or non-booleans; see docs/standards/crud-set.md',
      appliesTo: ['CRUD Set', 'purpose patch', 'boolean toggle', 'lock/archive/active'],
    },
    {
      id: 'component-designer.crud-set.export',
      title: 'CRUD Set Export Options Dialog',
      value:
        'CRUD Set Export never downloads on the toolbar click; it opens a fixed 500px-tall 2xl CreateEditModalShell (not dialogs.formSize; body scrolls, shell does not grow): header band 2 holds filename stem (UiInput, list name + date, locked .xlsx/.csv suffix) plus UiSegmentedControl format (both xlsx and csv by default); header band 3 holds include header (default yes); body has wrap AppSelectionToggle column chips (same CrudSetSpec.columns order, not actions; selected mild emerald+Check, unselected slate+X); always the full queried set (filters/sort), never current-page or a record limit; xlsx is a real ExcelJS workbook and csv is built on the server; no PDF; export.enabled false hides the button; see docs/standards/crud-set.md',
      appliesTo: ['CRUD Set', 'Excel export', 'CSV export', 'list toolbar'],
    },
    {
      id: 'component-designer.toolbox-catalog-subset',
      title: 'Toolbox Is A Subset Of Base Components',
      value:
        'Live Designer Toolbox is derived from Base Components nav (groups, section order, labels) — identity only maps a section to a droppable palette item; Toolbox labels are the Base Components section titles (Grid, not App Table Grid); Properties are that section’s public-prop and composition-prop options grouped by inspectorGroup (same FormSection titles as the lab, including CRUD Set APIs); writes go through propPath (CRUD Set keeps node.props.spec and uses the same shared living field widgets as the lab); Binding keys come from axis:data (or non-fixture data-editor); merge losers stay as legacy:true; shell/platform stay out of the public Toolbox; landing/marketing stay parked; see docs/standards/component-designer.md',
      appliesTo: ['Component Designer', 'Toolbox', 'Inspector', 'Base Components', 'Live Designer'],
    },
    {
      id: 'component-designer.page-guide.sidecar',
      title: 'Generated Visual Pieces Include Page Guide Sidecar',
      value:
        'auto-form, auto-CRUD, and agent-drafted Component Designer controls must include label plus a plain-language hint; runtime preview and exported TSX wrap those nodes with data-page-guide attributes; after designer_insert_palette_item set hint with designer_set_prop; Inspector Page Guide Hint is the authoring field; see docs/standards/component-designer.md §Page guide sidecar',
      appliesTo: ['Component Designer', 'auto form', 'auto CRUD', 'generated UI', 'page guide', 'vibe coding'],
    },
    {
      id: 'component-designer.canvas.viewport-local',
      title: 'Live Designer Remembers Canvas Size Per Component',
      value: 'Live Designer canvas size (preset, corner-resize, or 100% height via the corner-grip toggle) is remembered per component name in browser localStorage (appendo:designer:viewport:{name}); 100% uses fillMode fill-height so width stays fixed; click again or drag the grip to restore a fixed height; restore on reopen without a save; never key by draft id; see docs/standards/component-designer.md',
      appliesTo: ['Component Designer', 'Live Designer', 'canvas viewport'],
    },
    {
      id: 'component-designer.editor.ai-panel',
      title: 'Live Designer AI Chat Panel',
      value: 'Client Components Live Designer docks the same UiContextChatPanel as Server Functions (Sparkles toggle, Ask vs Agent); Ask proposes a layout document for Apply; Agent drafts via draft_component_layout / designer tools and auto-applies onto the canvas; nothing is saved until Save; see docs/standards/component-designer.md and vibe-designer-edit',
      appliesTo: ['Component Designer', 'Live Designer', 'Client Components', 'UiContextChatPanel', 'vibe-designer-edit'],
    },
    {
      id: 'data.images.grid-thumbnail-only',
      title: 'Grid Image Payload Policy',
      value: 'for entities with image blobs, list/grid endpoints must return only thumbnail payloads or thumbnail references; full-size image binaries are forbidden in bulk list/grid responses',
      appliesTo: ['list endpoints', 'grid endpoints', 'image blob entities'],
    },
    {
      id: 'data.db.utility-prefix',
      title: 'Reusable DB Utility Naming',
      value: 'reusable/general-purpose database helper procedures and functions must use zz_ prefix',
      appliesTo: ['database utility functions', 'database utility procedures'],
    },
    {
      id: 'platform.cache.key-format',
      title: 'Cache Manager Key Format',
      value: 'all CacheManager keys must be built via src/shared/lib/cacheKeyFormat.ts with colon-separated segments; fixed widths segment1=7, segment2=4, segment3+=10; pad shorter values with trailing dashes inside each width; abbreviate canonical tokens when needed (attrs→attr); overflow compresses to prefix-hash within width; omit segments entirely when scope does not need them (no empty/dash-only placeholder segments)—platform session/role/user-roles=3 segments (session:ctx3:42--------, user---:role:42--------), edge base=3 segments plus param/query fingerprints only when byParam and payload non-empty, actor only when byUser; use buildCacheKeyPrefix and exported *_CACHE_PREFIX for invalidation filters (prefixes already end with `:`; invalidateByPrefix must not append another `:`); after login, session context and user roles stay cached until mutation invalidation or TTL—/api/auth/me and other read paths must use getSessionContextForUser / getUserRolesForRequest (not force-rebuild)',
      appliesTo: ['CacheManager', 'cache keys', 'session context cache', 'role attributes cache', 'user roles cache', 'edge response cache'],
    },
    {
      id: 'platform.record-policy.capability-vs-scope',
      title: 'Record Policy Capability vs Scope',
      value: 'FunctionAccessControl on each Data API/page answers whether a principal may call it; Record Policy Engine answers which rows they may see or change afterward — both required; recordScope is on/off (off = engine off even if policies exist; on = the policy AND/OR tree filters every list/get/lookup/create/update/patch/delete on the model; on with no policies behaves like off and Studio must warn); scope never grants a call that Access Control denied; per-operation bypassRecordPolicy skips row filters on that Data API only; policies are workspace JSON; scope axes are built-in only (org/geo) with Base Info nodes projected into server session context as scope.*; predicate value refs resolve only from serverContext keys (user.*/role.*/sys.*/scope.*) — never clientContext; memberships are Prisma base_scope_memberships / base_scope_role_memberships (not packaged); closed predicate AST only (no free SQL/JS); out-of-scope get/update/delete returns 404; Data API merges policyWhere AND defaultWhere AND userFilter; see docs/standards/record-policy.md and specs/record-policy/',
      appliesTo: ['Record Policy', 'Data API row authorization', 'scope dimensions', 'record-policy package capabilities'],
    },
    {
      id: 'ui.crud.toolbar.filter-and-create',
      title: 'CRUD Toolbar Coverage',
      value:
        'CRUD list pages must include toolbar filter controls and a Create button when the feature creates records; inline filters stay in PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS; DB-backed lists add ListFilterToolbarControl last in that cluster (separatorBefore when preceded) plus ListFilterSummaryBand and ListFilterDialog via useListFilter — never drop inline filters and never put List Filter beside Refresh; see docs/standards/crud-pages.md §New DB-backed list interface and ui-toolbar.md',
      appliesTo: ['CRUD list pages', 'table/grid list views', 'Users list', 'package Phase 3 lists'],
    },
    {
      id: 'ui.crud.grid.edit-action',
      title: 'CRUD Grid Edit Action',
      value: 'CRUD grids must include an actions column with an Edit action',
      appliesTo: ['CRUD table/grid actions columns'],
    },
    {
      id: 'ui.crud.list-navigation-modes',
      title: 'CRUD List Navigation Modes',
      value: 'CRUD list views must support both Paging and Infinite Scroll and allow end-user switching between modes',
      appliesTo: ['CRUD list views', 'list navigation controls'],
    },
    {
      id: 'ui.crud.create.modal-default',
      title: 'CRUD Create Modal Default',
      value: 'create actions in CRUD grids should open in-app modal editor by default and must not navigate to separate create page unless explicitly required',
      appliesTo: ['CRUD create actions', 'table/grid action handlers'],
    },
    {
      id: 'ui.list.footer.sort',
      title: 'List Footer Sort Controls',
      value:
        'sort field and sort direction controls belong in the page list footer (GRID_PAGING_FOOTER_CLASS or equivalent catalog footer), not in the toolbar — unless a feature spec or standards shard explicitly places sort in the toolbar; sort direction uses an icon toggle (ArrowUpAZ/ArrowDownAZ), not a select; package Designer standardGrid / paginated AppTableGrid must set showSortControls with sortOptions whenever showPagingFooter is on (catalogs with pagination:false are exempt); reference FunctionListSidebar.tsx, GridPagingFooter.tsx, docs/standards/package-ui.md §P3',
      appliesTo: ['catalog list pages', 'development catalog pages', 'list footers', 'sort controls', 'package Designer scaffolds'],
    },
    {
      id: 'ui.crud.footer.standard',
      title: 'CRUD Standard Footer',
      value: 'CRUD list pages must use shared GridPagingFooter (src/shared/ui/GridPagingFooter.tsx) with showing range, label-style page-size dropdown, label-style sort-field dropdown, sort-direction icon toggle, and paging actions in paging mode — do not ship a paging footer without sort field + direction controls; inside AppDialogShell/CreateEditModalShell the footer auto-insets 10px from the window left/right edges (CREATE_EDIT_MODAL_GRID_PAGING_FOOTER_CLASS via DialogHostContext); AppTableGrid chrome=hero paging uses GridPagingFooter chrome=hero (classic controls, hero body fill, joined shell with configurable borderWidth) and skips dialog page-list inset',
      appliesTo: ['CRUD list pages', 'grid/list footer', 'dialog grids'],
    },
    {
      id: 'ui.crud.footer.page-size.standard',
      title: 'CRUD Paging Page Size Standard',
      value: 'default grid page size is 50 records; allowed page-size options are 50, 100, 500, 1000, and 10000 (canonical source: src/shared/lib/gridPagingConstants.ts)',
      appliesTo: ['CRUD list pages', 'grid paging footer', 'items-per-page controls'],
    },
    {
      id: 'ui.crud.footer.dropdown-label.standard',
      title: 'CRUD Paging Footer Dropdown Presentation',
      value: 'page-size and sort-field controls in grid paging footers must render as label-like dropdown triggers with pointer cursor on hover and click-to-open menus; do not use native select elements',
      appliesTo: ['CRUD list pages', 'grid paging footer', 'sort controls'],
    },
    {
      id: 'ui.crud.footer.sort-direction.icon-toggle',
      title: 'CRUD Sort Direction Icon Toggle',
      value: 'sort direction in grid paging footers must use a switchable icon toggle for asc/desc; do not use select or combo controls for direction',
      appliesTo: ['CRUD list pages', 'grid paging footer', 'sort controls'],
    },
    {
      id: 'ui.crud.footer.mode-switch.icon-combo',
      title: 'CRUD Mode Switch Presentation',
      value: 'paging/infinite list mode switch must be rendered in footer as icon plus combo control',
      appliesTo: ['CRUD list pages', 'list mode switch controls'],
    },
    {
      id: 'ui.crud.edit.modal-default',
      title: 'CRUD Edit Modal Default',
      value: 'edit actions in CRUD grids should open in-app modal editor by default and must not navigate to separate edit page unless explicitly required',
      appliesTo: ['CRUD edit actions', 'table/grid action handlers'],
    },
    {
      id: 'api.server-functions.openapi-docs',
      title: 'Server Functions OpenAPI Documentation',
      value: 'every managed and built-in server function route must expose OpenAPI 3.1.2 and server-served Swagger UI (swagger-ui-dist >= 5.32.x) via reserved /api/docs paths — aggregated spec/UI require auth and include only routes visible to the caller (canAccessFunctionDoc in buildManagedFunctionOpenApi.ts; ADMIN bypass; built-in access_control + metadata allowedRoles); scoped /api/docs/routes/:functionId uses the same access gate; canonical generator buildManagedFunctionOpenApi.ts with script parser parseServerFunctionScriptDoc.ts (primary: code script VALIDATION_SCHEMA/SQL/comments/req usage; fallback metadata_json + Data API metadata or apiDoc + test_payload); include built-in routes via serverFunctionDocCatalog.ts; cache full aggregated spec by content fingerprint in openApiSpec.service.ts, filter per principal on read, invalidate on managed-function CRUD; document { success: true, data, count?, source? } and { success: false, error } with bearerAuth JWT; UI opens /api/docs and /api/docs/routes/:functionId in new tabs via AppButton intent=utility (built-in enabled); never embed Swagger in React admin or place docs under business resource paths; greenfield only (no Swagger 2.0 or dual-format legacy)',
      appliesTo: ['buildManagedFunctionOpenApi', 'docs.routes', 'openApiSpec.service', 'FunctionListSidebar', 'ServerFunctionEditorPanel', 'managedFunctionRouteRegistry'],
    },
    {
      id: 'ui.tree.widget-required',
      title: 'Tree Widget Required',
      value: 'hierarchical data must be displayed with a tree widget or a grid+tree hybrid; plain lists are not acceptable for tree-structured data',
      appliesTo: ['tree pages', 'hierarchical data views'],
    },
    {
      id: 'ui.tree.no-pagination',
      title: 'Tree No Pagination',
      value: 'tree pages must not use pagination or infinite scroll; all visible nodes render in a single scrollable container; Base Components TreeGrid living sample defaults Paging off (operators may turn it on in the demo only)',
      appliesTo: ['tree pages'],
    },
    {
      id: 'ui.tree.root-nodes-initial-load',
      title: 'Tree Root Nodes Initial Load',
      value: 'all root-level nodes (no parent) must be loaded and rendered on initial page load',
      appliesTo: ['tree pages', 'tree data loading'],
    },
    {
      id: 'ui.tree.children-lazy-load',
      title: 'Tree Children Lazy Load',
      value: 'child nodes must load lazily only when the user expands a parent node; do not preload all descendants',
      appliesTo: ['tree pages', 'tree expand handlers'],
    },
    {
      id: 'ui.tree.grid-hybrid-preferred',
      title: 'Tree Grid Hybrid Preferred',
      value: 'a grid+tree hybrid (tree rows inside a column-based table) is preferred over a plain tree when tabular columns add value',
      appliesTo: ['tree pages'],
    },
    {
      id: 'ui.tree.expand-collapse-all',
      title: 'Tree Expand/Collapse All Actions',
      value: 'tree pages must include Expand All and Collapse All toolbar actions',
      appliesTo: ['tree pages', 'tree toolbar'],
    },
    {
      id: 'ui.tree.footer-stats-only',
      title: 'Tree Footer Stats Only',
      value: 'the tree footer must show summary stats only (root count, visible count); no paging controls',
      appliesTo: ['tree pages', 'tree footer'],
    },
    {
      id: 'ui.feedback.toast.top-center',
      title: 'Feedback Toast Top Center Placement',
      value: 'all in-app feedback toasts must render top-center (fixed top-4 left-1/2 -translate-x-1/2); do not use bottom-corner or inline-below-grid toast placement',
      appliesTo: ['page feedback toasts', 'CRUD success/error toasts', 'lock/unlock feedback'],
    },
    {
      id: 'ui.feedback.toast.app-toast-component',
      title: 'Shared AppToast Component',
      value: 'reuse AppToast (src/shared/ui/AppToast.tsx) for page-level feedback toasts (success, error, warning, info) with prominent styling (text-sm, px-5 py-3, rounded-xl, border, shadow) and a contextual icon related to the message concept; error toasts stay until the operator clicks dismiss — do not auto-hide them',
      appliesTo: ['users toast', 'roles toast', 'page feedback toasts'],
    },
    {
      id: 'data.base-info.ui-html.icon-format',
      title: 'Base Info UI Html Icon Format',
      value: 'store reusable option icons in base_info.ui_html as <i data-lucide="IconName"></i> and render through BaseInfoUiIcon (src/shared/lib/baseInfoUiIcon.tsx) instead of hardcoding duplicate icon maps in feature pages',
      appliesTo: ['base info options', 'gender icons', 'person type icons', 'grid icon columns'],
    },
    {
      id: 'package.base-info-vocab.shared-form',
      title: 'Package Base Info Vocabulary — Shared Form, Injected API',
      value:
        'studio package LOV/category settings pages (CMS, CRM, …) must reuse the shared Base Info record form (BaseInfoFormFields = RecordForm / designer bridge form.base-info-record) — never duplicate create/edit modal fields in package scaffold or feature code; inject list/create/update/delete/move through DataSourceDefinition.operations on the vocab data source; catalog cards for sparse vocabs; CMS reference: buildCmsVocabularyPage + buildVocabDataSource in scripts/cms-phase3/cmsDesignerScaffold.ts; full shard: docs/standards/package-base-info-vocab.md',
      appliesTo: [
        'package plans',
        'CMS vocabulary pages',
        'CRM vocabulary pages',
        'package Phase 3 scaffold',
        'designer package settings',
        'form.base-info-record',
      ],
    },
    {
      id: 'package.hawiety.db-objects',
      title: 'Hawiety — atomic writes as SQL Server procedures',
      value:
        'Hawiety multi-step or guarded DML and complex reads (not simple single-row SELECTs) MUST ship as dbo.hwy_* procedures/functions/views under scripts/hwy-phase1/db/install/hwy_db_*.sqlserver.sql; repackage in vertical-app hawiety (npm run hawiety:pack / hawiety:install, ETL-not-seed); ensureHwyDbObjects when package enabled; npm run hwy:db-objects; verify hwy:verify-db-objects (+ --install on sqlserver) and hwy:verify-db-objects:tests; skill appendo-build-hwy-db-objects; nomination SQL via hwy:gen-nomination-procs; TypeScript auth/roles then EXEC; never write legacy MembersV2 — legacy SQL connections are ApplicationIntent ReadOnly only; shard package-hawiety-db',
      appliesTo: [
        'Hawiety package',
        'hwy_* tables',
        'src/server/domain/hwy',
        'scripts/hwy-phase1/db/install',
        'scripts/hwy-phase3/install-hwy',
      ],
    },
    {
      id: 'package.hawiety.locale-policy',
      title: 'Hawiety — Arabic UI, English repo copy, no Persian',
      value:
        'Hawiety end-user and iq overlay copy Arabic (e.g. هويتي not Persian هویتی); AppEndO-Hawiety README/templates and non-UI Hawiety metadata English only; no Persian in hawiety shell seeds or hawiety.* culture keys; shard package-hawiety-locale-policy',
      appliesTo: [
        'src/core/packages/hawietyPackage.ts',
        'src/domain/hwy/hwyPlatformPortalBrandDefaults.ts',
        'scripts/release-cut/templates/AppEndO-Hawiety-README.md',
        'src/core/system-extensions/culture-packs/overlays/hawiety.iq.json',
        'workspace/platform-registry/shells/hawiety.json',
      ],
    },
    {
      id: 'package.hawiety.ui-vocab',
      value:
        'Hawiety Studio UI copy: say region (منطقة) not eghtera/اقتراع; maktab (مكتب) not tamvin/تموين; electoral breadcrumb order province → ghavateh? → circle → maktab → region; grid column 3 rows (province|ghavateh / circle|maktab / region) via hwyElectoralBreadcrumbStandard.ts — legacy SQL/route names stay; shard package-hawiety-ui-vocab',
      appliesTo: [
        'Hawiety package UI',
        'culture-packs/overlays/hawiety.*.json',
        'src/domain/hwy',
        'src/features/hwy-*',
      ],
    },
    {
      id: 'package.hawiety.member-face-caption',
      title: 'Hawiety member-directory avatar caption (username vs tracking)',
      value:
        'member-directory list avatar code line MUST use HwyMemberAvatarWithMembershipCode / HwyMemberDirectoryListFaceCard / HwyMemberDirectoryGridFaceCell (Hawiety /hawiety/identity-components, section member-directory-face) and resolveHwyMemberDirectoryListFaceCaptionForScope(row, listScopeLegacy) — never resolveHwyMemberFaceCaptionFromIdentity on list rows; six-digit allocated username blue else tracking red; Waited/Marfoozeh/pending-institute scopes tracking-only (never blue); server lists MUST finish with applyHwyMemberDirectoryListFaceCaptionUsernames(rows, { listScopeLegacy }); npm run test:hwy-member-face-caption; shard package-hawiety-member-face-caption; barrel hwyMemberDirectoryFaceCaptionContract.ts',
      appliesTo: [
        'Hawiety member-directory lists',
        'GET /api/hwy/member-directory',
        'src/domain/hwy/hwyMemberDirectoryFaceCaptionContract.ts',
        'src/shared/ui/hwy/HwyMemberAvatarWithMembershipCode.tsx',
        'src/server/domain/hwy/hwyMemberDirectoryListFaceCaption.ts',
      ],
    },
    {
      id: 'package.hawiety.member-list-legacy-filters',
      title: 'Hawiety member-list field-by-field filter rows (toolbar mode 2)',
      value:
        'People lists with HwyLegacyFieldFilterBarToggle MUST compose mode-2 panel via HwyMemberListLegacyFieldByFieldStack: identity → personal details → education/work (HwyMemberListLegacyFieldFilterEducationWorkRow) → electoral → extra; hwy-members-all uses HwyMemberDirectoryAllPeopleLegacyFieldByFieldPanel; shard package-hawiety-member-list-legacy-filters',
      appliesTo: [
        'Hawiety member-directory lists',
        'src/domain/hwy/HwyMemberListLegacyFieldByFieldStack.tsx',
        'src/domain/hwy/HwyMemberListLegacyFieldFilterIdentityRow.tsx',
        'src/domain/hwy/HwyMemberListLegacyFieldFilterPersonalDetailsRow.tsx',
        'src/domain/hwy/HwyMemberListLegacyFieldFilterEducationWorkRow.tsx',
        'src/domain/hwy/HwyMemberListLegacyFieldFilterElectoralRow.tsx',
        'src/domain/hwy/HwyMemberDirectoryAllPeopleLegacyFieldByFieldPanel.tsx',
      ],
    },
    {
      id: 'package.hawiety.domain-invariants',
      title: 'Hawiety — electoral tree geo assignment (process vs direct)',
      value:
        'One member MAY hold multiple roles; one geo_level at a time — process path (geo responsibility) = exactly one node; direct path (employees list role+region) MAY assign multiple approved nodes on the same level; cross-level approved anchors are drift — skipped in hwy:etl:legacy-edge-parity and geo-responsibility ETL (hwyMemberAreaLimitsCrossLevelEtl), purge via hwy:etl:purge-cross-level-area-limits; same-level multi-row expected; nakhebin join and plain membership out of scope; operator mirror electoral-tree-role-anchor + hwy:business-rules:seed; shard package-hawiety-domain-invariants; probe schema:area-limits-invariant fails on cross-level only',
      appliesTo: [
        'Hawiety package',
        'hwy-geo-responsibility',
        'hwy_member_area_limits',
        'hwy-business-rules-reference',
        'src/server/domain/hwy/hwyGeoResponsibility.service.ts',
        'scripts/hwy-phase1/db/install/hwy_db_procedures_writes.sqlserver.sql',
      ],
    },
    {
      id: 'package.ui.phase3-contract',
      title: 'Package UI — Phase 3 Executable Contract',
      value:
        'operational Studio packages (CMS, CRM, …) must treat Phase 3 like Phase 1: page-by-page UI contracts before Designer scaffolding — Users-style list shell, density-based cards vs table, deep editors = writable FormSection main + Idea Foundry inspector rail (docs/standards/ui-inspector-rail.md — not FormSection/MetaField), create-identity dialog then deep link `{list}/edit/{id}` with shell `{nav group}/{list}/Edit` and item identity in the content header (docs/standards/deep-linking.md), vocab via package-base-info-vocab, Designer scaffold modeled on scripts/cms-phase3 with contract tests + live-verify; EVERY control must come from Base Components (/studio/base-components) matching the living section (toolbar, buttons, text-fields, choice-fields, selection-fields, grid, kanban/UiKanbanBoard, create-edit, confirm, toast, …) — never raw HTML inputs or package-local base widgets; if Designer cannot emit an existing Base Component, add a generic Designer bridge first; split Phase 3 into sub-phases (vocab → golden editor → clone); never generate list UI from a table wizard — use CRUD Set; load docs/standards/package-ui.md (shard package-ui) and pass the Phase 3 readiness gate before coding package UI',
      appliesTo: [
        'package plans',
        'package Phase 3',
        'CMS UI',
        'CRM UI',
        'Designer package scaffold',
        'p-packages-* UX sections',
      ],
    },
    {
      id: 'package.records.optional-initial',
      title: 'Package Optional Initial Records',
      value:
        'seed db_objects may set installMode optional for installer-chosen initial rows; required schema and foundation vocab always install; SQL scripts must live under db/install/, db/uninstall/, db/seed/, or sql/ (Builder: db/install/schema.sql, db/uninstall/schema.sql, db/seed/optional-records.sql); Package Builder and Repack offer Include initial records and Pack CMS module (schema + CMS vocab required, content and files optional); Install Package offers Install initial records when the ZIP contains optional seed; colliding Base Info ids remap via db/base-info-hid.json; do not put required vocab in the optional seed script; binary columns pack as db/blobs/files with package_blob tokens restored at install; ZIP limit 512 MB; shard package-ui + docs/architecture/artifacts.md',
      appliesTo: [
        'Package Builder',
        'Package Repack',
        'Package Install',
        'package manifests',
        'CMS package export',
      ],
    },
    {
      id: 'package.studio-nav-patch',
      title: 'Package Studio Navigation Group',
      value:
        'Studio package pages use capabilities.navigation_patches (heading = package name, platform/navigation-patches/studio.json); do not bake this package pages into shipped src/config/platform-registry/navigation/studio.json; install claims an unowned leftover group with the same heading and tracks only this package pageKeys; another package sidecar still conflicts; uninstall removes tracked pageKeys and drops the heading only when empty (leftover untracked items stay); CMS sidebar is Contents + Settings only (not editor/vocab/comments or table-wizard pages); same-node install adopts existing loaderKind designer pages instead of overlaying package ui_routes; shard package-ui + docs/architecture/artifacts.md',
      appliesTo: [
        'Package Install',
        'Package Uninstall',
        'Studio navigation',
        'CMS package export',
      ],
    },
    {
      id: 'package.install-rollback',
      title: 'Package Install Rollback',
      value:
        'extension install is atomic: any failure after a step has started must reverse that attempt (nav patch, culture keys, home portal, deployment, workflows, record policies, edge models/APIs created by this attempt, DB uninstall SQL only if this attempt ran install SQL, object registry, UI/API runtime); failed install clears pending deployment so the grid shows Install not Apply; Studio extension ui_routes confirm during install (Apply is vertical-app propose only); do not delete reused same-node edge APIs; do not run uninstall SQL if this attempt never executed install scripts; superseded managed functions are not restored; shard package-ui + docs/architecture/artifacts.md',
      appliesTo: [
        'Package Install',
        'Package Uninstall',
        'package lifecycle',
        'CMS package export',
      ],
    },
    {
      id: 'package.home-portal',
      title: 'Package Public Home Portal',
      value:
        'shipped home-shell redirects culture root to Studio; CMS package cms claims home-shell as site-shell via capabilities.home_portal (platform/home-shell.json) while installed; uninstall restores the Studio redirect even for CMS versions packed before this capability; built-in home cannot be published via capabilities.portals; shard package-ui + docs/architecture/artifacts.md',
      appliesTo: [
        'Package Install',
        'Package Uninstall',
        'home-shell',
        'CMS package export',
        'Portals',
      ],
    },
    {
      id: 'ai.assistant.product-name',
      title: 'AppEndO Assistant Product Name',
      value: 'the built-in in-app AI assistant is branded AppEndO; do not put a chat trigger in the main shell header; ShellAppEndOButton remains the Bot control (Designer overlay) with a styled AppEndO tooltip on hover; aria-labels use shell.openAppendo / shell.closeAppendo culture keys; do not label it Copilot, AI Chat, or generic assistant in shell chrome',
      appliesTo: ['ShellAppEndOButton', 'DesignerShell', 'AppEndooPanel chrome', 'shell culture keys'],
    },
    {
      id: 'ai.mcp.builtin-packs',
      title: 'AI Agent Built-in MCP Packs',
      value: 'built-in MCP capability packs are in-process bundles under src/server/services/ai/mcp/builtin/ registered via registerBuiltinCapabilityPacks; canonical catalog is AI_CAPABILITY_PACK_CATALOG in capabilityPacks.ts (UI dropdown + runtime); migrate native tools into packs without dual registration; MCP tools are Agent mode only',
      appliesTo: ['agent.service', 'capabilityPacks.ts', 'mcp/builtin', 'AgentCapabilityDropdown', 'ToolRegistry'],
    },
    {
      id: 'ai.mcp.scope-and-policy',
      title: 'AI Agent MCP Scope and Security Policy',
      value: 'per-session agent capability scope persists as agent_capability_scope_json { packIds, mcpServerIds } with enabledCapabilityPackIds and enabledMcpServerIds on agent runs; default scope from DEFAULT_AGENT_CAPABILITY_SCOPE; write/git-write tools require confirm gate; appendo-git write tools are git_commit, git_checkout, git_branch (draft then apply); external MCP via McpBridge with SSRF validateMcpRemoteUrl at save, ai.mcp.stdioAllowlist for stdio, MCP_STDIO_MAX_OUTPUT_BYTES in sanitizer, visible bridge errors in trace/UI; appendo-web/fetch_url and screenshot_url SSRF-protected; appendo-http restricted to ai.http.allowedHostnames; ai.webSearch settings redacted in traces',
      appliesTo: ['agent.service', 'McpBridge', 'mcpPolicy', 'mcpUrlGuard', 'aiMcp settings', 'AgentCapabilityDropdown'],
    },
    {
      id: 'ai.mcp.inbound-host',
      title: 'AI Inbound MCP Host',
      value: 'external MCP clients connect to GET/POST/DELETE /api/mcp using Streamable HTTP transport; authenticate with ai.mcp.inboundHost.apiKey via Authorization Bearer or X-API-Key; disabled or missing key returns 503/401; exposed builtin tools from ai.mcp.defaultCapabilityPackIds intersected with ai.mcp.inboundHost.serviceRoleName MCP grants (default DEVELOPER); ADMIN service role bypasses grant clamp; draft/git-write tools excluded; implementation in src/server/services/ai/mcp/inbound/ including inboundBuiltinPackBridge.ts',
      appliesTo: ['mcp.routes', 'mcp/inbound', 'aiMcp settings'],
    },
    {
      id: 'ai.vibe.workflows-shard',
      title: 'Vibe Coding Workflows Shard',
      value: 'internal vibe coding operational workflows (WF-1 Server Functions, WF-2 CRUD UI, WF-3 modify layout, WF-4 full-stack) live in docs/standards/vibe-coding-workflows.md; load via get_project_standards({ shard: "appendoo-workflows" }) or shard "vibe-coding-workflows" (alias) or query vibe-crud / vibe-server-function / vibe-designer-edit; plan p-50 and gate VC-1 code on PO sign-off of benchmarks + workflows',
      appliesTo: ['AgentOrchestrator', 'contextAssembly', 'AppEndooPanel', 'appendo-server-functions', 'appendo-designer', 'vibe-coding'],
    },
    {
      id: 'ai.vibe.operator-playbook',
      title: 'Vibe Coding Operator Playbook',
      value: 'AppEndO Agent must load docs/standards/vibe-operator-playbook.md on every coding task via get_project_standards({ shard: "vibe-operator-playbook" }) before draft_* tools; playbook covers live unified runtime, platform-constrained development, project template paths, mandatory retrieve→plan→draft→finalize pipeline, WF-1..4 map, UI standard shards, generated-field page-guide hints, and anti-patterns; compact rules also inlined in contextAssembly APPENDO_VIBE_PLATFORM_RULES',
      appliesTo: ['contextAssembly', 'VibeHarness', 'AppEndooPanel', 'getProjectStandards', 'vibe-coding'],
    },
    {
      id: 'ai.vibe.workflow-shards',
      title: 'Vibe Workflow Topic Shards',
      value: 'WF topic shards are real markdown files: vibe-server-function (WF-1 + draft_server_function template), vibe-crud (WF-2 + UI rules), vibe-designer-edit (WF-3); load via get_project_standards({ shard }) — not query-only aliases',
      appliesTo: ['getProjectStandards', 'vibeWorkflowContext', 'contextAssembly', 'vibe-coding'],
    },
    {
      id: 'ai.vibe.unified-live-runtime',
      title: 'Vibe Coding Unified Live Runtime',
      value: 'no separate execution engine for vibe-generated server or client code; after apply, managed Server Functions under workspace/server-functions/ are immediately available as API from the same Node process; Client Component layouts under workspace/designer/drafts/ render from the same React app via Component Designer; test_server_function (optional source = unsaved editor / Test Console Execute) and VC-4 run_tests verify on this live runtime — not a new sandbox, sidecar, or per-draft deploy pipeline',
      appliesTo: ['Server Functions', 'Component Designer', 'changeSet.service', 'vibe-coding', 'run_tests'],
    },
    {
      id: 'ai.vibe.harness-phases',
      title: 'Vibe Harness Phases',
      value: 'target agent pipeline for internal vibe coding is retrieve → plan → draft → finalize; draft_* tools only after retrieve gate (get_feature_graph, search_codebase, read_file, get_server_function, get_project_standards); after retrieve gate, max 8 additional retrieve-tool calls without draft (VIBE_POST_RETRIEVE_TOOL_BUDGET) then draft_* required; finalize runs validateProposal with max 2 repair loops before proposal UI; enforced in VibeHarness.ts (VC-2)',
      appliesTo: ['VibeHarness', 'AgentOrchestrator', 'validateProposal', 'vibe-coding'],
    },
    {
      id: 'ai.vibe.confirm-and-rollback',
      title: 'Vibe Coding Write Confirm and Rollback',
      value: 'all vibe coding writes go through draft_* → proposal → apply API (writeRequiresConfirm); AppEndooPanel auto-applies valid proposals in Agent mode without asking the user to type confirm or click Create; apply creates rollback snapshots; users may rollback last apply from AppEndooPanel; agent must never tell users to save or apply manually in the UI',
      appliesTo: ['changeSet.service', 'AppEndooPanel', 'agent proposals', 'vibe-coding'],
    },
    {
      id: 'ai.vibe.manual-operator-parity',
      title: 'Vibe Coding Manual Operator Parity',
      value: 'AppEndO Agent must simulate admin UI paths — Server Functions via draft_server_function only (canonical functionId folder.name, path /api/{folder}/{name}, disk workspace/server-functions/custom/{folder}.{name}.ts); the Server Functions editor AI panel writes that draft source into Monaco (Agent auto-applies, unsaved until Save); Component Designer via draft_component_layout (and designer_set_prop / designer_insert_palette_item); the Client Components Live Designer AI panel writes that drafted layout onto the canvas (Agent auto-applies, unsaved until Save); never draft_file_patch under workspace/server-functions/ or workspace/designer/; platform source only via allowlisted draft_file_patch; manual parity rules in vibe-operator-playbook, vibe-server-function, and vibe-designer-edit shards plus contextAssembly APPENDO_VIBE_PLATFORM_RULES',
      appliesTo: ['draft_server_function', 'draft_component_layout', 'changeSet.service', 'contextAssembly', 'vibe-operator-playbook', 'vibe-server-function', 'vibe-designer-edit', 'vibe-coding'],
    },
    {
      id: 'naming.latin-slug.identifier',
      title: 'Latin Slug Identifier',
      value: 'valid operator-facing slug/name identifiers are any combination of lowercase Latin letters, digits, underscore, dash, and dot only; canonical regex is LATIN_SLUG_RE (/^[a-z0-9._-]+$/) in src/shared/lib/latinSlug.ts with sanitizeLatinSlugInput and validateLatinSlug helpers',
      appliesTo: ['URL segments', 'application slugs', 'operator identifiers', 'form validation'],
    },
    {
      id: 'ui.form.url-segment-slug-input',
      title: 'URL Segment Slug Input',
      value: 'URL segment editors must render a fixed leading slash outside the input (never typed by the operator); the input accepts only the slug body sanitized through sanitizeLatinSlugInput / UrlSegmentSlugInput (src/shared/ui/UrlSegmentSlugInput.tsx)',
      appliesTo: ['platform portals', 'URL segment fields', 'duplicate segment dialogs'],
    },
    {
      id: 'platform.portals.create-default-enabled',
      title: 'Platform Applications Create Default Enabled',
      value: 'new platform portal create forms default enabled: true so operators add active portals unless they explicitly turn Enabled off',
      appliesTo: ['platform portals', 'PortalsPageView', 'usePortalsPage'],
    },
    {
      id: 'auth.dev.simple-login-preset',
      title: 'Development Simple Login Preset',
      value: 'during development keep auth on simple username/password login only — OTP (authOtpEnabled), email-verify gates, and public registration stay off via M0_DEV_SIMPLE_AUTH_PRESET; enforced on non-production server boot and npm run setup; do not enable these in Settings or seeds unless running auth E2E tests (M0_DEV_AUTH_PRESET); production operators enable hardening in Settings when needed',
      appliesTo: ['auth settings', 'login', 'bootstrap', 'setup', 'm0DevAuthPreset.ts', 'SystemConfigForm'],
    },
    {
      id: 'auth.login.browser-password-manager',
      title: 'Login Form Lets The Browser Save Credentials',
      value: 'the sign-in form must be a real HTML login form so the browser password manager can save username/password: method=post action=/login (SPA still preventDefault + JSON /api/auth/login), named fields autocomplete=username and current-password, keep those inputs in the DOM through submit (hide not unmount during OTP), call navigator.credentials.store(PasswordCredential) after success with no in-page save-password checkbox; never write username/password to localStorage or sessionStorage; see docs/standards/dev-auth.md §Browser password manager',
      appliesTo: ['login', 'LoginPage', 'UiInput', 'UiPasswordInput', 'password manager', 'autocomplete'],
    },
    {
      id: 'auth.session.browser-restore',
      title: 'Browser Session Restore (HttpOnly cookies)',
      value: 'JWTs live only in HttpOnly SameSite=Lax cookies (access_token 15m, refresh_token 7d with server rotation in base_auth_refresh_tokens); on app boot AuthProvider.checkSession must call restoreBrowserSession() in authSession.ts (GET /api/auth/me, silent POST /api/auth/refresh only when /me lacks success+user, then GET /me again); keep /api/auth/me on isAuthExemptEndpoint; reactive 401 refresh on other /api routes stays in apiFetch; never store access tokens in localStorage; regression tests authSession.restore.test.ts — do not bypass restoreBrowserSession from AuthContext',
      appliesTo: ['AuthContext', 'authSession.ts', 'login', 'session', 'refresh token', 'checkSession'],
    },
    {
      id: 'platform.zip-extension-growth',
      title: 'ZIP-First Platform Extension Growth',
      value: 'long-term platform capabilities (System Extensions: culture-pack, storage-adapter, deployment-adapter, …) should be addable via signed ZIP packs without rebuilding the app; identity-provider login adapters ship in-tree under src/core/system-extensions/identity-providers/; Package ZIPs remain sandboxed and cannot register identity-provider login adapters; new non-IdP extensibility work must extend the System Extension pack pipeline (contract + validator + install service)',
      appliesTo: ['system extensions', 'identity providers', 'platform install', 'architecture', 'ProviderRegistry'],
    },
    {
      id: 'platform.release-cut',
      title: 'Local Release Cut (no cloud CI)',
      value:
        'platform and package publishes run only via npm run release:cut or @appendo-release-cut on the operator machine — never GitHub Actions on push/tag for release; orchestrator bumps versions from scripts/release-cut/releaseCutVersions.json, tags release/vX.Y.Z on private main, packs publish packages (default hawiety) in P4 only when versions change; public AppEndO-Release (cms + remote-hubs) and private AppEndO-Hawiety (full source + dist + promoted hawiety zip, no pack on hawiety export); P9 (full cut, not --fast): clone:provision per deploy-line DB — structure only, no ETL — via cloneProfilesForSchemaSync; clone exports sanitize operator settings.json and ship settings.recommended.json + CLONE_PROFILE per releaseCutCloneProfiles (oss AppEndORelease / hawiety AppEndOHawiety); clone dev: APPENDO_SETTINGS_PATH + APPENDO_CLONE_SQL_PASSWORD + npm run dev; npm run clone:bootstrap / clone:install-wizard / clone:provision (hawiety greenfield: hawiety:install --skip-legacy-parity); extend releaseCutPackageDeployLines for new package git lines; see docs/standards/release-cut.md',
      appliesTo: ['release', 'packages', 'CI', 'hawiety pack', 'open source bundle'],
    },
    {
      id: 'platform.identity-provider.zip-not-plugin',
      title: 'Identity Providers Via System Extension ZIP Only',
      value: 'login IdP adapters ship as in-tree identity-provider System Extensions under src/core/system-extensions/identity-providers/ — never as Package marketplace packages or runtime ZIP drops; operator config stays in auth.identityProviders[]; extensions supply adapter code only; Core owns OAuth/SAML flow, session, merge, and provision',
      appliesTo: ['identity-provider', 'OAuth', 'SAML', 'PackageManifestValidator', 'identity engine'],
    },
    {
      id: 'routing.nested-editor.deep-link',
      title: 'Nested Editor Deep Link URLs',
      value: 'list→edit Studio pages use bookmarkable URLs `{list-segment}/edit/{item-slug}`; folder-scoped catalogs add folder after edit (`server-functions/edit/{folder}/{name}`); flat items use `{list-segment}/edit/{key}` (`workflows/edit/order-approval`, `data-studio/edit/{objectName}`, `client-components/edit/{name}`, `workbooks/edit/{id}`, `idea-foundry/edit/{id}`); new drafts use `…/edit/new`; literal `edit` segment is required on every editor URL including Data Studio; helpers in src/shared/routing/nestedEditorDeepLink.ts plus feature *Route.ts modules; LegacyAdminUrlResolver redirects retired shapes (including `data-studio/{objectName}` → `data-studio/edit/{objectName}` and `client-components/edit/{folder}/{name}` → `client-components/edit/{name}`); see docs/standards/deep-linking.md',
      appliesTo: ['workflows', 'server-functions', 'data-studio', 'workbooks', 'idea-foundry', 'routing', 'navigation', 'deep links'],
    },
    {
      id: 'routing.nested-editor.shell-header',
      title: 'Nested Editor Shell Header Title',
      value: 'nested editor open → main shell header is `{nav group} / {list label} / Edit` (group always present; Edit segment required so the header is not identical to the list; no folder, no item in title); Sftp / SSH / RDP use `/ Session` instead of `/ Edit` because those pages are live connection sessions; use buildNestedEditorShellHeaderOverride + useShellHeaderOverride from the page/workspace (WorkflowsWorkspace, WorkbooksWorkspace, ServerFunctionsPageView, DataStudioPage) — not inside nested editor panels; leave groupLabel unset so merge keeps nav group; ShellHeaderTitle prepends group to titleTrail `[listLabel, Edit|Session]`; list label from culture nav.{pageKey}; item identity belongs in the content header (Workflows: definition.key — never WorkflowModel.name; Server Functions: function name; Data Studio: objectName; Client Components: name; Workbooks: name) — derive from URL slug before catalog loads when needed; singleton pages that are not list→item pass modeLabel null; see docs/standards/deep-linking.md',
      appliesTo: ['workflows', 'server-functions', 'data-studio', 'workbooks', 'idea-foundry', 'AdminShellHeader', 'AppShellHeader', 'shell header'],
    },
    {
      id: 'routing.nested-editor.implementation-checklist',
      title: 'Nested Editor Implementation Checklist',
      value: 'new list→edit surfaces need: canonical edit URL builders/parsers, URL↔state sync + canonicalize on rename, platform route binding (list exact + edit splat), workspace-level shell header hook with `{list}/Edit` trail (connection hubs `{list}/Session`; no item identity) and retained nav group, content header item identity title + WorkspaceBackIcon, tests for routes and header override; follow WorkflowsWorkspace + WorkbooksWorkspace + ServerFunctionsPageView + DataStudioPage; full checklist in docs/standards/deep-linking.md',
      appliesTo: ['workflows', 'server-functions', 'data-studio', 'workbooks', 'idea-foundry', 'routing', 'navigation', 'new features'],
    },
    {
      id: 'routing.workspace-overlay.deep-link',
      title: 'Workspace Overlay Deep Link Query Param',
      value: 'floating panels (FloatingPanelShell) and modal shells (CreateEditModalShell) on a routed workspace sync to ?overlay={token} — tokens are slash-separated paths (panel/designer, dialog/create, panel/sql/VIEW/name); primary list→edit identity stays in the path (never only in overlay); use workspaceOverlayDeepLink.ts + useWorkspaceOverlayDeepLink; CrudSet lists use crudSet/useCrudSetOverlayDeepLink; feature token catalogs per workspace; migration inventory in docs/standards/deep-linking.md §Workspace overlays',
      appliesTo: ['FloatingPanelShell', 'CreateEditModalShell', 'deep links', 'routing', 'data-studio', 'workflows', 'crud-set', 'modal', 'floating panel'],
    },
    {
      id: 'routing.workspace-overlay.implementation-checklist',
      title: 'Workspace Overlay Implementation Checklist',
      value: 'when adding or revisiting overlays: register stable overlay tokens, wire useWorkspaceOverlayDeepLink (activeToken from panel managers/modal open state, openFromUrl resolves catalog context), share links via buildHrefWithWorkspaceOverlay, add token parser/builder tests; see docs/standards/deep-linking.md §Workspace overlays and migration inventory',
      appliesTo: ['FloatingPanelShell', 'CreateEditModalShell', 'deep links', 'routing', 'new features'],
    },
    {
      id: 'hygiene.optimization.independent-axes',
      title: 'Optimization Axes Are Independently Invokable',
      value:
        'optimization playbook has three independent axes — dead-code, performance, security; invoke one alone (@appendo-perf-dead-code, @appendo-perf-app, @appendo-perf-security) or all three (@appendo-perf-full); boot/startup is separate skill appendo-perf-startup (@appendo-perf-startup) with baseline docs/perf/p-56-startup-baseline.md; never run unrequested axes; skip those phases and mark their report sections N/A; see docs/standards/optimization.md',
      appliesTo: ['optimization', 'dead-code', 'performance', 'security', 'hygiene', 'knip'],
    },
    {
      id: 'hygiene.optimization.test-only-is-dead',
      title: 'Test-Only References Do Not Keep Production Code Alive',
      value:
        'a production file or export whose only importers are tests (*.test.ts, __tests__, *.spec.ts) is still dead — Knip and tsc count test imports as usage; delete the production symbol then tests that solely covered it; keep in-test helpers and intentional public-API contract tests; see docs/standards/optimization.md §1.2b',
      appliesTo: ['optimization', 'dead-code', 'knip', 'hygiene', 'tests'],
    },
    {
      id: 'hygiene.optimization.verify-before-report',
      title: 'Verify Security Findings On Source Before Reporting',
      value:
        'do not report a security issue from a grep hit alone — read the actual definition and drop parameterized SQL, sanitized HTML, allowlisted hosts, and test fixtures; apply fixes in the working tree for operator review; never git commit, push, or open a PR unless the user explicitly asked; never log real secrets; see docs/standards/optimization.md §3.4',
      appliesTo: ['optimization', 'security', 'hygiene', 'secrets', 'SQL injection'],
    },
    {
      id: 'data-api.pivot.dataset-not-layout',
      title: 'Pivot API Stores Dataset Prep Only',
      value:
        'a published Data API pivot operation stores dataset preparation only (fields.read columns, defaultWhere / allowFilter row filter, enrichments for ID titles) — never rows/columns/measures/aggregation layout; the client sends PivotSpec on every POST; see docs/standards/data-api-pivot.md',
      appliesTo: ['Data API', 'pivot', 'Edge model', 'Data Studio wizard'],
    },
    {
      id: 'data-api.pivot.published-api',
      title: 'Pivot Is a Published Data API Kind',
      value:
        'pivot is released on a TABLE/VIEW Edge model like other Data APIs (kind pivot, POST {basePath}/pivot, same access control, cache, hooks, Record Policy); do not accept a free table name or raw SQL; Record Policy applies to raw rows before aggregation; see docs/standards/data-api-pivot.md',
      appliesTo: ['Data API', 'pivot', 'Edge model', 'Record Policy'],
    },
    {
      id: 'data-api.pivot.request-spec',
      title: 'Pivot Layout Is Request Body',
      value:
        'each pivot call POST body is PivotSpec: rows[], columns[], measures[] with aggregation sum|count|avg|min|max|countDistinct, optional list-DSL filters, optional totals; fields must belong to the prepared dataset; see docs/standards/data-api-pivot.md',
      appliesTo: ['Data API', 'pivot', 'PivotSpec'],
    },
    {
      id: 'data-api.pivot.result-matrix',
      title: 'Pivot Returns a Matrix',
      value:
        'pivot responses are PivotResult (rowAxis, colAxis, measures, cells) inside the standard Data API envelope with meta cell/cardinality caps — not a flat fact-row list; grid and chart both consume this object; see docs/standards/data-api-pivot.md',
      appliesTo: ['Data API', 'pivot', 'PivotResult'],
    },
    {
      id: 'data-api.pivot.utility',
      title: 'Pivot Utility Is Generic Server-Side',
      value:
        'server pivot execution is a domain utility pivotFlatDataset(datasetQuery, spec) → PivotResult; the published kind pivot operation prepares the dataset query then calls it; pivot in SQL over the query, do not materialize the full fact set in Node; cube and client engines are later providers behind the same contracts; see docs/standards/data-api-pivot.md',
      appliesTo: ['Data API', 'pivot', 'EdgeDbRouter', 'server domain'],
    },
    {
      id: 'data-api.pivot.no-third-party-widget',
      title: 'No Bundled Third-Party Pivot Widget',
      value:
        'do not adopt Perspective Viewer, Flexmonster, WebDataRocks, react-pivottable, or FortuneSheet as the product pivot grid/chart; v1 is the server utility + published API only; later UI is a thin PivotGrid plus existing UiChart/ECharts over PivotResult; see docs/standards/data-api-pivot.md',
      appliesTo: ['pivot', 'PivotGrid', 'charts', 'ECharts'],
    },
    {
      id: 'data-api.pivot.json-field-extraction',
      title: 'JSON Field Extraction Is Explicit',
      value:
        'JSON path extraction for pivot is an explicit declared extraction (outputField, sourceColumn, jsonPath) compiled per dialect — never implicit dotted SQL; see docs/standards/data-api-pivot.md',
      appliesTo: ['Data API', 'pivot', 'JSON'],
    },
    {
      id: 'data-api.pivot.result-cache-keyed-by-policy-context',
      title: 'Pivot Result Cache Is Policy-Keyed',
      value:
        'pivot result cache keys include the Record Policy / principal context — never share a cached matrix across users or roles; see docs/standards/data-api-pivot.md',
      appliesTo: ['Data API', 'pivot', 'cache', 'Record Policy'],
    },
    {
      id: 'personalizable-dashboard.domain-is-explicit-whitelist',
      title: 'Dashboard Domain Is An Explicit Whitelist',
      value:
        'a personalizable dashboard page declares an explicit domain whitelist; Add Widget and PivotSpec may only use those entries and fields; see docs/standards/personalizable-dashboard-canvas.md',
      appliesTo: ['dashboard canvas', 'Component Designer', 'pivot'],
    },
    {
      id: 'personalizable-dashboard.no-new-record-type',
      title: 'Dashboard Personalization Reuses User Layout',
      value:
        'per-user canvas personalization lives in the existing dashboard_layout user attribute (pageCanvases keyed by page id) — no new record type; see docs/standards/personalizable-dashboard-canvas.md',
      appliesTo: ['dashboard canvas', 'profile', 'personalization'],
    },
    {
      id: 'personalizable-dashboard.server-side-domain-check',
      title: 'Dashboard Pivot Is Server-Checked',
      value:
        'viewer pivot POST /api/dashboard-canvas/pages/:pageId/pivot enforces the page domain whitelist server-side; admin POST /api/data-sources/:id/pivot is diagnostics only; see docs/standards/personalizable-dashboard-canvas.md',
      appliesTo: ['dashboard canvas', 'pivot', 'security'],
    },
    {
      id: 'olap-bridge.external-optional-service',
      title: 'OLAP Bridge Is An External Optional Service',
      value:
        'SSAS access is an optional external HTTP bridge (tools/olap-bridge), never an in-process Microsoft library or a second OLAP server inside AppEndO; see docs/standards/olap-bridge.md',
      appliesTo: ['OLAP', 'data sources', 'SSAS'],
    },
    {
      id: 'rolap.star-schema.studio-annotations',
      title: 'ROLAP Uses Studio Cube Annotations',
      value:
        'internal star-schema pivot uses cubeMeasure on columns, cubeDimension on associations, and cubeDerivedMeasures in studio-meta.extensions — AppEndO computes the cube, it does not speak XMLA; see docs/standards/rolap-star-schema.md',
      appliesTo: ['ROLAP', 'Data Studio', 'pivot'],
    },
    {
      id: 'mongodb-analytics.aggregation-only',
      title: 'MongoDB Analytics Is Aggregation-Only',
      value:
        'MongoDB Analytics data sources expose a field whitelist and compile PivotSpec to an aggregation pipeline — never arbitrary Mongo commands from the viewer; see docs/standards/mongodb-analytics-provider.md',
      appliesTo: ['MongoDB', 'pivot', 'data sources'],
    },
    {
      id: 'elasticsearch-analytics.aggregation-only',
      title: 'Elasticsearch Analytics Is Aggregation-Only',
      value:
        'Elasticsearch Analytics data sources expose a field whitelist and compile PivotSpec to aggregations — never arbitrary query DSL from the viewer; see docs/standards/elasticsearch-analytics-provider.md',
      appliesTo: ['Elasticsearch', 'pivot', 'data sources'],
    },
    {
      id: 'pivot-threshold-alerts.workflow-actions',
      title: 'Pivot Threshold Alerts Are Workflow Actions',
      value:
        'threshold checks and snapshot delivery are core workflow actions data.pivot-threshold-check and data.pivot-snapshot-delivery over PivotSpec — no parallel scheduler; see docs/standards/pivot-threshold-alerts.md',
      appliesTo: ['workflow', 'pivot', 'alerts'],
    },
    {
      id: 'dashboard-widget-comments.page-widget-scoped',
      title: 'Widget Comments Are Page+Widget Scoped',
      value:
        'dashboard widget comments persist on base_dashboard_widget_comments keyed by pageId + widgetNodeId; see docs/standards/dashboard-widget-comments.md',
      appliesTo: ['dashboard canvas', 'comments'],
    },
    {
      id: 'dashboard-ai-assist.draft-does-not-write',
      title: 'Dashboard AI Drafts Do Not Write Personalization',
      value:
        'draft_dashboard_widget and query_dashboard_domain never write personalization; drafts pre-fill Add Widget only; see docs/standards/dashboard-ai-assist.md',
      appliesTo: ['dashboard canvas', 'AI', 'MCP'],
    },
    {
      id: 'dashboard-sharing.function-access-control',
      title: 'Dashboard Sharing Reuses Function Access Control',
      value:
        'dashboard page sharing uses FunctionAccessControl like Workbooks; public visitors personalize locally only; embed HTML sends CSP frame-ancestors from embedAllowedOrigins (default deny); ?dc_embed=1 strips Studio chrome; frozen snapshots render at /shared/dashboard-snapshots/:id with a dated banner; see docs/standards/dashboard-sharing.md',
      appliesTo: ['dashboard canvas', 'sharing', 'access control'],
    },
    {
      id: 'user-message-inbox.dispatch-ledger',
      title: 'User Message Inbox (MSGI)',
      value:
        'outbound product notifications use dispatchNotification and base_user_message_dispatches (Sequelize); personal Inbox (/studio/my-inbox) and shell bell use GET /api/personal-inbox — Phase B projection for work/feedback/alert; Phase C kind=message_dispatch reads dispatches live (same UI, not in bell summary); PERSONAL_INBOX_READ_MODE=live for Phase A fallback; pageKey my-messages removed; in-app rows use base_user_notifications; retention userMessageDispatches (Settings → Logs); ADMIN Records in-app-notifications; see docs/standards/user-message-inbox.md and specs/unified-personal-inbox/03-phase-c-interface-union.md',
      appliesTo: ['notifications', 'dispatchNotification', 'my-messages', 'my-inbox', 'personal-inbox', 'MSGI'],
    },
    {
      id: 'record-event-log.append-only',
      title: 'Record Event Log Is Append-Only History',
      value:
        'base_record_events is append-only record history (not event sourcing); current row stays source of truth; Prisma is locked; HTTP logs and auth audit stay separate tables; see docs/standards/record-event-log.md',
      appliesTo: ['record events', 'timeline', 'Users', 'Data API', 'audit'],
    },
    {
      id: 'record-event-log.prefer-over-sidecar-tables',
      title: 'Record-Scoped Tracking Uses Record Events Not Side Tables',
      value:
        'when audit or change history is anchored on subject_kind plus subject_id and fits Timeline, History, reason, or client metadata on writes, emit into base_record_events (emitRecordEvent, PLATFORM_HISTORY_MARKS, documented payload kinds) — do not add new per-entity *_history, *_change_log, or audit tables; legacy side tables are ETL-in only; HTTP logs, auth audit, and non-record ledgers from their own shards stay separate; see docs/standards/record-event-log.md and AGENTS.md always-on rule 11',
      appliesTo: [
        'record events',
        'audit',
        'history',
        'Data API',
        'Hawiety',
        'database',
        'Sequelize',
      ],
    },
    {
      id: 'record-event-log.studio-meta',
      title: 'Record History Is Defined In Studio-Meta',
      value:
        'track, redact, lifecycle, retention, and legalHold live on studio-meta history (model/column/association); Reason Ask lives on each named API (Data API Runtime, Design API, Server Functions Settings) except GET/list, create, password, and auth; each API owns a situation folder under 100.6 with no Vocab node picker; Include general is the only shared-list switch; Manage reasons edits that API folder only; Express constants are fallbacks until stored; trackReads/trackViews are schema-only until wave 4; see docs/standards/record-event-log.md',
      appliesTo: ['record events', 'Data Studio', 'studio-meta'],
    },
    {
      id: 'record-event-log.reason-on-event',
      title: 'Change Reason Lives On The Event',
      value:
        'reason_code and reason_text belong on the record event not the domain row; Confirm follows that API Ask on PUT/PATCH/DELETE only (never GET/list, create, password, or auth settings or Confirm); combo is never empty (API folder leaves first, then General when included); Manage reasons edits that API folder only; lock/unlock/locked share 100.6.20; sample-mock writes share 100.6.35; one API write = one reason; CrudSet omitted policy defaults Ask off; overlay stays until the write succeeds; CrudSet overlay/toggle and Users profile/roles Confirm Save are primary not destructive; see docs/standards/record-event-log.md',
      appliesTo: ['record events', 'Users', 'RecordForm', 'Data API'],
    },
    {
      id: 'record-event-log.client-context',
      title: 'Client Metadata Is Per-Operation Off/Record/Require',
      value:
        'closed catalog on Data API clientContext; envelope X-AppEndO-Client or __client (header wins, 4KB); claimed IP discarded; observed.ip is req.ip; Require is write-only and not bypassed by User-Agent; interceptor is apiFetch identity-only; GPS only via attachClientContext on Save; see docs/standards/record-event-log.md',
      appliesTo: ['record events', 'Data API', 'client context', 'apiFetch'],
    },
    {
      id: 'record-event-log.users-first',
      title: 'Users Is The First Record Event Consumer',
      value:
        'Express /api/users and /api/profile emit via PLATFORM_HISTORY_MARKS onto subject_kind=base_users; junctions do not get history.enabled; Login As keeps impersonator plus acting-as; GET v1 is ADMIN or self on base_users (not Edge Record Policy); vocab root is 100.6 with General 100.6.0 and Users lock/roles/lifecycle folders; see docs/standards/record-event-log.md',
      appliesTo: ['record events', 'Users', 'profile', 'impersonation'],
    },
    {
      id: 'record-event-log.hwy-members',
      title: 'Hawiety Members Emit Field History On Dossier Patch',
      value:
        'PLATFORM_HISTORY_MARKS.hwy_members tracks dossier PATCH fields (redact phone1, phone2, email); dossier satellites emit with payload.hwyDossierKind (idempotency hwy-dossier:*); change log reads those events plus member summary procs; legacy change history ETL hwy-etl:ch:*; backfill hwy:etl:backfill-dossier-record-events and gap pass hwy:etl:backfill-dossier-record-gaps; see docs/standards/record-event-log.md § Hawiety dossier satellites',
      appliesTo: ['record events', 'Hawiety', 'hwy_members', 'member dossier'],
    },
    {
      id: 'record-event-log.sample-mock',
      title: 'Sample Mock Living Sample Emits Record Events',
      value:
        'CRUD Set /api/sample-mock emits onto subject_kind=base_sample_mock_records; PATCH/lock/approve/DELETE share family folder 100.6.35 and resolve stored metadataJson.changeReason; seed fills ORD-001/002/007 when that subject is empty; sample-mock and Users lock/roles/profile API Ask stay optional; living sample hydrates Confirm from PATCH /api/sample-mock/records/:id; 4xx does not fall back to the in-memory demo; see docs/standards/record-event-log.md',
      appliesTo: ['record events', 'sample-mock', 'CRUD Set'],
    },
    {
      id: 'record-event-log.auditee-ui',
      title: 'Record Events Auditee Page Matches Logs Chrome',
      value:
        'ADMIN page-module record-events is a Logs-like list: ListFilterToolbarControl at end of filters cluster plus where-builder dialog and ListFilterSummaryBand header 2 (entity/API/record/field/outcome/kind/time; API/entity allowCustomValue), AppTableGrid and GridPagingFooter; Include archived when Keep dest is same-type-db (filters cluster only, not a predicate); Control records and Refresh in actions; no Signed export toolbar button; Actor/Reason cells show read-time identity and reason title not bare ids/codes; do not embed that Timeline on domain forms; see docs/standards/record-event-log.md',
      appliesTo: ['record events', 'auditee', 'Logs', 'Studio'],
    },
    {
      id: 'record-event-log.retention-offload',
      title: 'Hot Logs And Record Events Leave The Operational Database',
      value:
        'Settings Logs Retention: App logs / Auth audit and Record events share one Older than combo and one Keep dest — no extra family-name rows — same-type connections then File last (default, gzip JSONL) — never a sidecar archive table on the operational control plane; always copy to dest then delete hot (no Discard); not per-model; hold/legalHold skip; after event offload emit history.archived stub; Include archived and HTTP-log lookup search dest DB only; Clear wipes hot only; Control logs / Control records open an auto-size dialog for Dry-run, Run now, and Clear (all destructive-soft equal width; Settings is policy only); no boot cron; Prisma locked for archive tables; see docs/standards/record-event-log.md',
      appliesTo: ['record events', 'Logs', 'Settings', 'jobs', 'audit'],
    },
    {
      id: 'record-event-log.form-surfaces',
      title: 'Record History On Forms Is Button-Only Retrieve',
      value:
        'when history.enabled: list-row Record timeline (RecordEventHistoryIcon + platform.recordSubjectTimeline.*) opens RecordEventHistoryDialog maximized spine; Edit/View headerExtra only toggles field timeline icons (off until pressed); those labelExtra / association-label icons then GET the field-filtered timeline; inspector Created label shows the timeline trigger only when that model history.enabled (Idea Foundry stamps stay Created/Edited without the icon); event detail dialog carries Actor/Reason/from/to and optional restore; never paint events, provenance, embedded timeline, Devices, or a History accordion on the form; never on Create; no form-load GET; do not replace inspector Created/Edited with events; auditee record-events page stays grid; see docs/standards/record-event-log.md',
      appliesTo: ['record events', 'RecordForm', 'CRUD Set', 'Users', 'inspector', 'auditee'],
    },
    {
      id: 'platform-ops-dashboards.insights-home',
      title: 'Platform Ops Dashboards Live On Home Insights',
      value:
        'three ADMIN Insights canvases (Studio operations, Work queue, People and access) seed on the default control-plane Data Source with whitelist-only Pivot APIs and Sequelize VIEWs base_ops_*; Home widget insights sits after kpi; routes are nav:null with no sidebar Insights group; no Prisma models and no fake chart rows; see docs/standards/platform-ops-dashboards.md',
      appliesTo: ['Insights', 'Home', 'ops dashboards', 'Pivot', 'Studio'],
    },
    {
      id: 'workflow.engine.testing-boundary',
      title: 'Workflow Engine Testing — Data/Design First',
      value:
        'while testing or scenario-evaluating the Workflow Engine: default fix is workflow design and DB/runtime data (AWM model in Designer, publish, input mappings, assignment, edges, instance/work-item rows, scripts/seed) — not application code; change platform code only for engine bugs (vs normative docs) or generic capabilities all workflows share; never hardcode a specific WorkflowDefinition.key, scenario-named domain hooks, bootstrap ensure*Workflow*, or Work Item UI branches for one workflow; prefer MANUAL_API start via runtime API or test scripts over domain CRUD hooks during engine-only testing; see docs/standards/workflow-engine-testing.md',
      appliesTo: ['workflow engine', 'workflows', 'work items', 'AWM', 'workflow runtime', 'engine testing'],
    },
  ],
};

/** Canonical markdown shard key for a machine standard id. */
export const shardForStandardId = (id: string): string => {
  if (id.startsWith('agent.')) return 'agents-hub';
  if (id.startsWith('ui.visual') || id.startsWith('ui.appearance')) return 'ui-design-system';
  if (id.startsWith('ui.inspector-rail')) return 'ui-inspector-rail';
  if (
    id.startsWith('ui.dialog')
    || id.startsWith('ui.wizard')
    || id.startsWith('ui.form.create-edit')
    || id.startsWith('ui.form.record-editor')
    || id.startsWith('ui.form.access-control')
    || id.startsWith('ui.form.dialog')
    || id.startsWith('ui.form.flat-sections')
    || id.startsWith('ui.destructive')
  ) {
    return 'ui-dialog';
  }
  if (
    id.startsWith('ui.toolbar')
    || id.startsWith('ui.button')
    || id.startsWith('ui.icon-action')
    || id.startsWith('ui.search')
    || id.startsWith('ui.surface.box')
    || id.startsWith('ui.tool.active')
    || id.startsWith('ui.grid.toolbar')
    || id === 'ui.list.footer.sort'
  ) {
    return 'ui-toolbar';
  }
  if (id.startsWith('ui.grid')) return 'ui-grid';
  if (id.startsWith('ui.crud') || id.startsWith('ui.tree')) return 'crud-pages';
  if (id.startsWith('ui.data-studio.modeler')) return 'data-studio-modeler';
  if (id.startsWith('data-studio')) return 'data-studio';
  if (id.startsWith('data.images')) return 'ui-grid';
  if (id.startsWith('data-api.pivot')) return 'data-api-pivot';
  if (id.startsWith('personalizable-dashboard')) return 'personalizable-dashboard-canvas';
  if (id.startsWith('olap-bridge')) return 'olap-bridge';
  if (id.startsWith('rolap.')) return 'rolap-star-schema';
  if (id.startsWith('mongodb-analytics')) return 'mongodb-analytics-provider';
  if (id.startsWith('elasticsearch-analytics')) return 'elasticsearch-analytics-provider';
  if (id.startsWith('pivot-threshold-alerts')) return 'pivot-threshold-alerts';
  if (id.startsWith('dashboard-widget-comments')) return 'dashboard-widget-comments';
  if (id.startsWith('dashboard-ai-assist')) return 'dashboard-ai-assist';
  if (id.startsWith('dashboard-sharing')) return 'dashboard-sharing';
  if (id.startsWith('data.')) return 'data-model';
  if (id === 'platform.release-cut') return 'release-cut';
  if (id.startsWith('platform.greenfield') || id.startsWith('platform.zip') || id.startsWith('platform.identity')) {
    return 'greenfield';
  }
  if (id.startsWith('platform.cache')) return 'cache-keys';
  if (id.startsWith('platform.record-policy')) return 'record-policy';
  if (id.startsWith('component-designer.crud-set') || id.startsWith('crud-set')) return 'crud-set';
  if (id.startsWith('component-designer')) return 'component-designer';
  if (id.startsWith('package.records') || id.startsWith('package.home') || id.startsWith('package.studio') || id.startsWith('package.install')) return 'package-ui';
  if (id.startsWith('package.base-info')) return 'package-base-info-vocab';
  if (id === 'package.hawiety.locale-policy') return 'package-hawiety-locale-policy';
  if (id === 'package.hawiety.ui-vocab') return 'package-hawiety-ui-vocab';
  if (id === 'package.hawiety.member-face-caption') return 'package-hawiety-member-face-caption';
  if (id === 'package.hawiety.member-list-legacy-filters') return 'package-hawiety-member-list-legacy-filters';
  if (id === 'package.hawiety.domain-invariants') return 'package-hawiety-domain-invariants';
  if (id.startsWith('package.hawiety')) return 'package-hawiety-db';
  if (id.startsWith('package.ui')) return 'package-ui';
  if (id.startsWith('ai.vibe')) return 'vibe-coding-workflows';
  if (id.startsWith('ai.')) return 'mcp-servers';
  if (id.startsWith('api.server-functions')) return 'edge-openapi';
  if (id.startsWith('naming.') || id.startsWith('platform.portals')) return 'data-model';
  if (id.startsWith('auth.')) return 'dev-auth';
  if (id.startsWith('routing.nested-editor')) return 'deep-linking';
  if (id.startsWith('routing.workspace-overlay')) return 'deep-linking';
  if (id.startsWith('record-event-log')) return 'record-event-log';
  if (id.startsWith('user-message-inbox')) return 'user-message-inbox';
  if (id.startsWith('platform-ops-dashboards')) return 'platform-ops-dashboards';
  if (id.startsWith('workflow.engine')) return 'workflow-engine-testing';
  if (id.startsWith('hygiene.optimization')) return 'optimization';
  return 'ui-core';
};

