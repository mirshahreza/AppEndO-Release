import { describe, expect, it } from 'vitest';
import { renderHtmlEditorCustomJsx, renderMarkdownEditorCustomJsx } from '../tsxPhase2Palette';
import type { DesignerNode } from '../types';

const createHtmlEditorNode = (props: Record<string, unknown> = {}): DesignerNode => ({
  id: 'node-rich-text',
  type: 'container',
  parentId: 'root',
  order: 0,
  props: {
    _designerPaletteItemId: 'form.html-editor',
    label: 'Body',
    value: '<p>Hello</p>',
    placeholder: 'Start writing…',
    editorHeight: 180,
    fontSize: 15,
    showToolbar: true,
    enableBold: true,
    enableTaskList: true,
    enableImage: true,
    enableTable: true,
    enableCodeBlock: false,
    ...props,
  },
  layout: {},
  binding: {},
  componentRef: null,
  children: [],
});

const createMarkdownEditorNode = (props: Record<string, unknown> = {}): DesignerNode => ({
  id: 'node-markdown',
  type: 'container',
  parentId: 'root',
  order: 0,
  props: {
    _designerPaletteItemId: 'form.markdown-editor',
    label: 'Body (markdown)',
    value: '## Hello',
    placeholder: 'Write in Markdown…',
    editorHeight: 220,
    fontSize: 14,
    showToolbar: true,
    enableHeading: true,
    enableLink: true,
    enableCodeBlock: true,
    enableTextDirection: true,
    enableImage: false,
    enableTable: false,
    ...props,
  },
  layout: {},
  binding: {},
  componentRef: null,
  children: [],
});

describe('renderHtmlEditorCustomJsx', () => {
  it('emits expanded rich text toolbar props for DesignerHtmlEditorField', () => {
    const jsx = renderHtmlEditorCustomJsx(createHtmlEditorNode());

    expect(jsx).toContain('DesignerHtmlEditorField');
    expect(jsx).toContain('placeholder="Start writing…"');
    expect(jsx).toContain('editorHeight={180}');
    expect(jsx).toContain('fontSize={15}');
    expect(jsx).toContain('showToolbar={true}');
    expect(jsx).toContain('enableBold={true}');
    expect(jsx).toContain('enableTaskList={true}');
    expect(jsx).toContain('enableImage={true}');
    expect(jsx).toContain('enableTable={true}');
    expect(jsx).toContain('enableInlineCode={true}');
    expect(jsx).toContain('enableClearFormatting={true}');
    expect(jsx).toContain('enableCodeBlock={false}');
    expect(jsx).not.toContain('lineNumbers');
    expect(jsx).not.toContain('minimap');
  });
});

describe('renderMarkdownEditorCustomJsx', () => {
  it('emits the Base Components markdown editor with its toolbar', () => {
    const jsx = renderMarkdownEditorCustomJsx(createMarkdownEditorNode());

    expect(jsx).toContain('DesignerMarkdownEditorField');
    expect(jsx).toContain('placeholder="Write in Markdown…"');
    expect(jsx).toContain('editorHeight={220}');
    expect(jsx).toContain('showToolbar={true}');
    expect(jsx).toContain('enableHeading={true}');
    expect(jsx).toContain('enableLink={true}');
    expect(jsx).toContain('enableCodeBlock={true}');
    expect(jsx).toContain('enableTextDirection={true}');
    expect(jsx).toContain('enableImage={false}');
    expect(jsx).toContain('enableTable={false}');
    expect(jsx).not.toContain('lineNumbers');
  });
});
