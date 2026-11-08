import React, { useMemo, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  FormField,
  FormSection,
  UiKanbanBoard,
  UiSelect,
  type UiKanbanColumn,
  type UiKanbanColumnWidth,
  type UiKanbanDensity,
  type UiKanbanHeight,
  type UiKanbanTone,
} from '../../../shared/ui';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import {
  BaseComponentsPreviewFrame,
  BASE_COMPONENTS_WORKSPACE_INSET_CLASS,
} from '../components/BaseComponentsWorkspacePanel';
import { BaseComponentsResetButton, BaseComponentsConfigToolbarControls } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsConfigBoolField } from '../components/BaseComponentsConfigBoolField';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
  BASE_COMPONENTS_PREVIEW_BODY_CLASS,
} from '../baseComponentsConfiguratorLayout';

const HEIGHT_OPTIONS: UiKanbanHeight[] = ['auto', 'full'];
const TONE_OPTIONS: UiKanbanTone[] = ['slate', 'violet', 'cyan', 'indigo', 'emerald', 'amber', 'rose'];
const COLUMN_WIDTH_OPTIONS: UiKanbanColumnWidth[] = ['sm', 'md', 'lg'];
const DENSITY_OPTIONS: UiKanbanDensity[] = ['compact', 'comfortable'];

const COLUMN_TONES: Record<string, UiKanbanTone> = {
  todo: 'amber',
  'in-progress': 'cyan',
  done: 'emerald',
};

const BASE_COLUMNS: UiKanbanColumn[] = [
  {
    id: 'todo',
    title: 'To do',
    cards: [
      { id: 'card-1', title: 'Design review', description: 'Confirm Fluent 2 alignment.' },
      { id: 'card-2', title: 'Write migration notes' },
    ],
  },
  {
    id: 'in-progress',
    title: 'In progress',
    cards: [
      { id: 'card-3', title: 'Kanban primitive', description: 'dnd-kit, closestCorners collision.' },
    ],
  },
  {
    id: 'done',
    title: 'Done',
    cards: [
      { id: 'card-4', title: 'Chart primitive' },
    ],
  },
];

export type KanbanBaseComponentsConfig = {
  height: UiKanbanHeight;
  tone: UiKanbanTone;
  columnWidth: UiKanbanColumnWidth;
  density: UiKanbanDensity;
  showCardCount: boolean;
  showDescriptions: boolean;
  coloredColumns: boolean;
  preset: 'status' | 'read-only';
  interactive: boolean;
  keyboardMove: boolean;
  programmaticMove: boolean;
  wipLimits: boolean;
  state: 'default' | 'dragging' | 'invalid-drop' | 'saving' | 'move-error' | 'empty';
  viewport: 'desktop' | 'tablet' | 'phone-list' | 'phone-snap';
};

export const DEFAULT_KANBAN_BASE_COMPONENTS_CONFIG: KanbanBaseComponentsConfig = {
  height: 'auto',
  tone: 'slate',
  columnWidth: 'md',
  density: 'comfortable',
  showCardCount: true,
  showDescriptions: true,
  coloredColumns: true,
  preset: 'status',
  interactive: true,
  keyboardMove: true,
  programmaticMove: true,
  wipLimits: false,
  state: 'default',
  viewport: 'desktop',
};

const applyColumnTones = (columns: UiKanbanColumn[], coloredColumns: boolean): UiKanbanColumn[] =>
  columns.map((column) => ({
    ...column,
    tone: coloredColumns ? COLUMN_TONES[column.id] : undefined,
  }));

export function resolveKanbanInteraction(config: Pick<KanbanBaseComponentsConfig, 'interactive' | 'keyboardMove' | 'state'>) {
  return {
    interactive: config.interactive && config.state !== 'saving',
    enableKeyboardMove: config.keyboardMove,
  };
}

export function resolveKanbanStateOptions(config: Pick<KanbanBaseComponentsConfig, 'interactive' | 'wipLimits'>) {
  return [
    'default',
    ...(config.interactive ? ['dragging', 'saving', 'move-error'] : []),
    ...(config.interactive && config.wipLimits ? ['invalid-drop'] : []),
    'empty',
  ] as KanbanBaseComponentsConfig['state'][];
}

export function applyKanbanPreset(
  current: KanbanBaseComponentsConfig,
  preset: KanbanBaseComponentsConfig['preset'],
): KanbanBaseComponentsConfig {
  return {
    ...current,
    preset,
    interactive: preset !== 'read-only',
    state: preset === 'read-only' ? 'default' : current.state,
  };
}

export function applyKanbanInteractionMode(
  current: KanbanBaseComponentsConfig,
  interactive: boolean,
): KanbanBaseComponentsConfig {
  return {
    ...current,
    interactive,
    preset: interactive ? 'status' : 'read-only',
    state: interactive ? current.state : 'default',
  };
}

export function canMoveKanbanCard(
  wipLimits: boolean,
  toColumnId: string,
  columns: UiKanbanColumn[],
  limit = 2,
): boolean {
  return !wipLimits || (columns.find((column) => column.id === toColumnId)?.cards.length ?? 0) < limit;
}

export const KanbanBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<KanbanBaseComponentsConfig>(DEFAULT_KANBAN_BASE_COMPONENTS_CONFIG);
  const [columns, setColumns] = useState<UiKanbanColumn[]>(() =>
    applyColumnTones(BASE_COLUMNS, DEFAULT_KANBAN_BASE_COMPONENTS_CONFIG.coloredColumns),
  );
  const [moveNotice, setMoveNotice] = useState<string | null>(null);

  const boardColumns = useMemo(
    () => applyColumnTones(columns, config.coloredColumns),
    [columns, config.coloredColumns],
  );
  const boardInteraction = resolveKanbanInteraction(config);

  const configJson = useMemo(
    () => JSON.stringify({
      public: {
        interactive: config.interactive,
        density: config.density,
        columnWidth: config.columnWidth,
        enableKeyboardMove: config.keyboardMove,
        enforceWipLimits: config.wipLimits,
        height: config.height,
        tone: config.coloredColumns ? undefined : config.tone,
        showCardCount: config.showCardCount,
        showDescriptions: config.showDescriptions,
      },
      composition: { preset: config.preset, showMoveAction: config.programmaticMove },
      demo: {
        fixtures: { board: 'standard-board', columns: boardColumns },
        scenarios: { state: config.state, viewport: config.viewport },
      },
    }, null, 2),
    [config, boardColumns],
  );

  const moveFirstCard = () => {
    setColumns((current) => {
      const source = current.find((column) => column.cards.length > 0);
      if (!source) return current;
      const sourceIndex = current.findIndex((column) => column.id === source.id);
      const targetIndex = (sourceIndex + 1) % current.length;
      if (!canMoveKanbanCard(config.wipLimits, current[targetIndex].id, current)) {
        setMoveNotice(`Move blocked: ${current[targetIndex].title} reached its WIP limit.`);
        return current;
      }
      const [card, ...remaining] = source.cards;
      setMoveNotice(`Moved ${card.title} to ${current[targetIndex].title}.`);
      return current.map((column, index) => (
        index === sourceIndex ? { ...column, cards: remaining }
          : index === targetIndex ? { ...column, cards: [...column.cards, card] }
            : column
      ));
    });
  };

  const reset = () => {
    setConfig(DEFAULT_KANBAN_BASE_COMPONENTS_CONFIG);
    setColumns(applyColumnTones(BASE_COLUMNS, DEFAULT_KANBAN_BASE_COMPONENTS_CONFIG.coloredColumns));
    setMoveNotice(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="kanban" json={configJson}>
          <BaseComponentsResetButton onClick={reset} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Pattern" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Preset" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.preset}
                    onChange={(event) => {
                      const preset = event.target.value as KanbanBaseComponentsConfig['preset'];
                      setConfig((current) => applyKanbanPreset(current, preset));
                    }} ariaLabel="Kanban preset">
                    <option value="status">status</option>
                    <option value="read-only">read-only</option>
                  </UiSelect>
                </FormField>
                <FormField label="Interaction" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.interactive ? 'interactive' : 'read-only'}
                    onChange={(event) => {
                      const interactive = event.target.value === 'interactive';
                      setConfig((current) => applyKanbanInteractionMode(current, interactive));
                    }}
                    ariaLabel="Kanban interaction mode">
                    <option value="interactive">pointer + keyboard</option>
                    <option value="read-only">read-only</option>
                  </UiSelect>
                </FormField>
                <FormField label="State" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.state}
                    onChange={(event) => setConfig((current) => ({ ...current, state: event.target.value as KanbanBaseComponentsConfig['state'] }))}
                    ariaLabel="Kanban state scenario">
                    {resolveKanbanStateOptions(config).map((state) => <option key={state} value={state}>{state}</option>)}
                  </UiSelect>
                </FormField>
                <FormField label="Viewport" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect size="sm" className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS} value={config.viewport}
                    onChange={(event) => setConfig((current) => ({ ...current, viewport: event.target.value as KanbanBaseComponentsConfig['viewport'] }))}
                    ariaLabel="Kanban viewport scenario">
                    <option value="desktop">desktop board</option>
                    <option value="tablet">tablet board</option>
                    <option value="phone-list">phone list</option>
                    <option value="phone-snap">phone horizontal snap</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>
            <FormSection title="Layout" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Height" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.height}
                    onChange={(event) =>
                      setConfig((current) => ({
                        ...current,
                        height: event.target.value as UiKanbanHeight,
                      }))
                    }
                    ariaLabel="Kanban height"
                  >
                    {HEIGHT_OPTIONS.map((height) => (
                      <option key={height} value={height}>
                        {height === 'full' ? '100%' : height}
                      </option>
                    ))}
                  </UiSelect>
                </FormField>

                <FormField label="Column width" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.columnWidth}
                    onChange={(event) =>
                      setConfig((current) => ({
                        ...current,
                        columnWidth: event.target.value as UiKanbanColumnWidth,
                      }))
                    }
                    ariaLabel="Kanban column width"
                  >
                    {COLUMN_WIDTH_OPTIONS.map((columnWidth) => (
                      <option key={columnWidth} value={columnWidth}>{columnWidth}</option>
                    ))}
                  </UiSelect>
                </FormField>

                <FormField label="Density" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.density}
                    onChange={(event) =>
                      setConfig((current) => ({
                        ...current,
                        density: event.target.value as UiKanbanDensity,
                      }))
                    }
                    ariaLabel="Kanban density"
                  >
                    {DENSITY_OPTIONS.map((density) => (
                      <option key={density} value={density}>{density}</option>
                    ))}
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Color" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                {!config.coloredColumns ? <FormField label="Tone" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.tone}
                    onChange={(event) =>
                      setConfig((current) => ({
                        ...current,
                        tone: event.target.value as UiKanbanTone,
                      }))
                    }
                    ariaLabel="Kanban tone"
                  >
                    {TONE_OPTIONS.map((tone) => (
                      <option key={tone} value={tone}>{tone}</option>
                    ))}
                  </UiSelect>
                </FormField> : null}

                <BaseComponentsConfigBoolField
                  label="Per-column colors"
                  checked={config.coloredColumns}
                  ariaLabel="Per-column colors"
                  onChange={(checked) => setConfig((current) => ({ ...current, coloredColumns: checked }))}
                />
              </div>
            </FormSection>

            <FormSection title="Display" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <BaseComponentsConfigBoolField
                  label="Show card count"
                  checked={config.showCardCount}
                  ariaLabel="Show card count"
                  onChange={(checked) => setConfig((current) => ({ ...current, showCardCount: checked }))}
                />

                <BaseComponentsConfigBoolField
                  label="Show descriptions"
                  checked={config.showDescriptions}
                  ariaLabel="Show descriptions"
                  onChange={(checked) => setConfig((current) => ({ ...current, showDescriptions: checked }))}
                />
                {config.interactive ? (
                  <BaseComponentsConfigBoolField
                    label="Keyboard move"
                    checked={config.keyboardMove}
                    ariaLabel="Keyboard move"
                    onChange={(checked) => setConfig((current) => ({ ...current, keyboardMove: checked }))}
                  />
                ) : null}
                {config.interactive ? (
                  <BaseComponentsConfigBoolField
                    label="Move action"
                    checked={config.programmaticMove}
                    ariaLabel="Move action"
                    onChange={(checked) => setConfig((current) => ({ ...current, programmaticMove: checked }))}
                  />
                ) : null}
                {config.interactive ? (
                  <BaseComponentsConfigBoolField
                    label="WIP limits"
                    checked={config.wipLimits}
                    ariaLabel="WIP limits"
                    onChange={(checked) => setConfig((current) => ({
                      ...current,
                      wipLimits: checked,
                      state: !checked && current.state === 'invalid-drop' ? 'default' : current.state,
                    }))}
                  />
                ) : null}
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="kanban" fill={config.height === 'full'}>
          <div
            className={cn(
              BASE_COMPONENTS_PREVIEW_BODY_CLASS,
              config.height === 'full' && 'min-h-0',
            )}
          >
            {config.programmaticMove ? (
              <div className="mb-3 flex flex-wrap gap-2">
                <AppButton size="sm" intent="secondary" onClick={moveFirstCard} disabled={!config.interactive || config.state === 'saving'}>
                  <ArrowRight className="h-3.5 w-3.5" />
                  Move first card
                </AppButton>
                <AppButton size="sm" intent="utility" onClick={() => setColumns(BASE_COLUMNS)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset board
                </AppButton>
              </div>
            ) : null}
            {config.state === 'saving' ? <p className="mb-2 text-xs text-cyan-700" role="status">Saving board changes…</p> : null}
            {config.state === 'dragging' ? <p className="mb-2 text-xs text-indigo-700" role="status">Drag preview active — drop a card into another column.</p> : null}
            {config.state === 'invalid-drop' ? <p className="mb-2 text-xs text-amber-700" role="alert">This column has reached its WIP limit.</p> : null}
            {config.state === 'move-error' ? <p className="mb-2 text-xs text-rose-700" role="alert">The card move could not be saved.</p> : null}
            {moveNotice ? <p className="mb-2 text-xs font-medium text-slate-700" role="status">{moveNotice}</p> : null}
            <div className={cn(
              config.viewport === 'phone-list' && 'max-w-[360px] [&>div]:flex-col [&>div]:overflow-x-visible',
              config.viewport === 'phone-snap' && 'max-w-[360px] [&>div]:snap-x [&>div]:snap-mandatory [&>div>div]:snap-start',
            )}>
            <UiKanbanBoard
              columns={config.state === 'empty' ? boardColumns.map((column) => ({ ...column, cards: [] })) : boardColumns}
              onColumnsChange={setColumns}
              interactive={boardInteraction.interactive}
              enableKeyboardMove={boardInteraction.enableKeyboardMove}
              canMoveCard={({ toColumnId, columns: nextColumns }) => (
                canMoveKanbanCard(config.wipLimits, toColumnId, nextColumns)
              )}
              height={config.height}
              tone={config.tone}
              columnWidth={config.columnWidth}
              density={config.density}
              showCardCount={config.showCardCount}
              showDescriptions={config.showDescriptions}
              className={config.height === 'full' ? 'h-full' : undefined}
            />
            </div>
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
