import { describe, expect, it } from 'vitest';
import { toBuiltInComponentId } from '../builtInComponents';
import { createStateFromNewLayoutPreset } from '../newLayoutPresets';
import { resolveBuiltInTemplateSeeds } from '../builtInTemplateResolver';

describe('builtInTemplateResolver', () => {
  it('resolves layout preset templates by built-in component id', () => {
    const seeds = resolveBuiltInTemplateSeeds(toBuiltInComponentId('contact-form'));

    expect(seeds).not.toBeNull();
    expect(seeds?.[0]?.paletteItemId).toBe('html.form');
    expect(seeds?.[0]?.binding?.['event:onSubmit']).toEqual({ sourceType: 'apiRef' });

    const fieldsContainer = seeds?.[0]?.children?.[2];
    const firstNameField = fieldsContainer?.children?.[0]?.children?.[0]?.children?.[1];
    expect(firstNameField?.paletteItemId).toBe('heroui.input-text');
    expect(firstNameField?.props?.name).toBe('firstName');
    expect(firstNameField?.props?.label).toBe('First name');
  });

  it('materializes contact-form presets with palette ids and submit binding', () => {
    const { state } = createStateFromNewLayoutPreset('contact-form');
    const formNode = Object.values(state.document.nodes).find(
      (node) => node.props._designerPaletteItemId === 'html.form',
    );

    expect(formNode).toBeTruthy();
    expect(formNode?.binding?.['event:onSubmit']).toEqual({ sourceType: 'apiRef' });

    const emailField = Object.values(state.document.nodes).find(
      (node) => node.props._designerPaletteItemId === 'heroui.input-text'
        && node.props.name === 'email',
    );
    expect(emailField).toBeTruthy();
    expect(emailField?.props.label).toBe('Email');
    expect(emailField?.props.inputType).toBe('email');
  });

  it('resolves newsletter signup with labeled heading, email field, and subscribe action', () => {
    const seeds = resolveBuiltInTemplateSeeds(toBuiltInComponentId('newsletter-signup'));
    const block = seeds?.[0];

    expect(block?.paletteItemId).toBe('html.container');
    expect(block?.children?.[0]?.props?.text).toBe('Stay In The Loop');
    const row = block?.children?.[1];
    expect(row?.children?.[0]?.paletteItemId).toBe('heroui.input-text');
    expect(row?.children?.[0]?.props?.placeholder).toBe('you@company.com');
    expect(row?.children?.[1]?.paletteItemId).toBe('heroui.button-solid');
    expect(row?.children?.[1]?.props?.text).toBe('Subscribe');
  });

  it('resolves auth-login with binding-ready form and credential fields', () => {
    const seeds = resolveBuiltInTemplateSeeds(toBuiltInComponentId('auth-login'));
    const section = seeds?.[0];
    const form = section?.children?.[1];

    expect(section?.paletteItemId).toBe('html.section');
    expect(form?.paletteItemId).toBe('html.form');
    expect(form?.binding?.['event:onSubmit']).toEqual({ sourceType: 'apiRef' });
    expect(form?.children?.[0]?.props?.name).toBe('email');
    expect(form?.children?.[1]?.props?.name).toBe('password');
  });

  it('resolves kpi-metrics-grid with four stat-trend nodes', () => {
    const seeds = resolveBuiltInTemplateSeeds(toBuiltInComponentId('kpi-metrics-grid'));
    const grid = seeds?.[0]?.children?.[1];

    expect(grid?.paletteItemId).toBe('layout.grid-2');
    expect(grid?.children).toHaveLength(4);
    expect(grid?.children?.[0]?.paletteItemId).toBe('content.stat-trend');
  });

  it('resolves kanban-board with viz.kanban widget', () => {
    const seeds = resolveBuiltInTemplateSeeds(toBuiltInComponentId('kanban-board'));
    expect(seeds?.[0]?.children?.[1]?.paletteItemId).toBe('viz.kanban');
  });

  it('resolves crud-collection-page with app-table-grid', () => {
    const seeds = resolveBuiltInTemplateSeeds(toBuiltInComponentId('crud-collection-page'));
    const section = seeds?.[0];
    const grid = section?.children?.find((child) => child.paletteItemId === 'heroui.app-table-grid');
    expect(grid).toBeTruthy();
    expect(grid?.binding?.gridListResource?.sourceType).toBe('apiRef');
  });
});
