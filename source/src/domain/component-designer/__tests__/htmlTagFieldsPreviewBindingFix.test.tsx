/**
 * @vitest-environment jsdom
 *
 * Bug found (parity audit item 37): Property Bindings on HTML tag fields for `html.form`
 * (action/method/encType/target/autoComplete/noValidate/name), `html.link`
 * (href/target/rel/download/referrerPolicy), `html.iframe` (src/title/width/height/allowFullScreen),
 * and part of `html.image` (width/height/loading/decoding/srcSet/sizes) were dead in interactive
 * Preview — fields were read only from static `node.props` while Export already resolved them via
 * `buildNodeJsxAttributesWithBindings`. Fixed in `designerRuntimePreview.tsx` via
 * `previewBindings.resolveTextProp` (same pattern as file-upload accept/multiple).
 */
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { createStoreReadBindingDefinition } from '../bindingStoreEngine';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, { type: 'insert-palette-item', itemId, parentId: parentId ?? state.document.rootNodeId });

const lastChildId = (state: DesignerState, parentId?: string): string => {
  const node = state.document.nodes[parentId ?? state.document.rootNodeId];
  return node.children[node.children.length - 1] as string;
};

const bindStoreProp = (state: DesignerState, nodeId: string, prop: string, storePath: string): DesignerState => {
  const binding = createStoreReadBindingDefinition(prop, storePath);
  return designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: binding.bindingKey,
    definition: binding.definition,
  });
};

afterEach(() => cleanup());

describe('HTML tag field Property Bindings in Preview (parity audit item 37)', () => {
  it('html.form: bound tag fields appear as real DOM attributes', () => {
    let state = insertItem(createInitialDesignerState(), 'html.form');
    const nodeId = lastChildId(state);
    state = bindStoreProp(state, nodeId, 'action', 'formMeta.action');
    state = bindStoreProp(state, nodeId, 'method', 'formMeta.method');
    state = bindStoreProp(state, nodeId, 'encType', 'formMeta.encType');
    state = bindStoreProp(state, nodeId, 'target', 'formMeta.target');
    state = bindStoreProp(state, nodeId, 'autoComplete', 'formMeta.autoComplete');
    state = bindStoreProp(state, nodeId, 'name', 'formMeta.name');
    state = bindStoreProp(state, nodeId, 'noValidate', 'formMeta.noValidate');

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          bindingDefinitions: state.bindingDefinitions,
          designerStore: {
            formMeta: {
              action: '/api/submit',
              method: 'post',
              encType: 'multipart/form-data',
              target: '_blank',
              autoComplete: 'off',
              name: 'bound-form',
              noValidate: true,
            },
          },
        })}
      </>,
    );

    const form = container.querySelector('form');
    expect(form).toBeTruthy();
    expect(form?.getAttribute('action')).toBe('/api/submit');
    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.getAttribute('enctype')).toBe('multipart/form-data');
    expect(form?.getAttribute('target')).toBe('_blank');
    expect(form?.getAttribute('autocomplete')).toBe('off');
    expect(form?.getAttribute('name')).toBe('bound-form');
    expect(form?.hasAttribute('novalidate')).toBe(true);
  });

  it('html.link: bound tag fields appear as real DOM attributes', () => {
    let state = insertItem(createInitialDesignerState(), 'html.link');
    const nodeId = lastChildId(state);
    state = bindStoreProp(state, nodeId, 'href', 'linkMeta.href');
    state = bindStoreProp(state, nodeId, 'target', 'linkMeta.target');
    state = bindStoreProp(state, nodeId, 'rel', 'linkMeta.rel');
    state = bindStoreProp(state, nodeId, 'download', 'linkMeta.download');
    state = bindStoreProp(state, nodeId, 'referrerPolicy', 'linkMeta.referrerPolicy');

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          bindingDefinitions: state.bindingDefinitions,
          designerStore: {
            linkMeta: {
              href: 'https://example.com/docs',
              target: '_blank',
              rel: 'noopener',
              download: 'guide.pdf',
              referrerPolicy: 'no-referrer',
            },
          },
        })}
      </>,
    );

    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('https://example.com/docs');
    expect(anchor?.getAttribute('target')).toBe('_blank');
    expect(anchor?.getAttribute('rel')).toBe('noopener');
    expect(anchor?.getAttribute('download')).toBe('guide.pdf');
    expect(anchor?.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('html.iframe: bound tag fields appear as real DOM attributes', () => {
    let state = insertItem(createInitialDesignerState(), 'html.iframe');
    const nodeId = lastChildId(state);
    state = bindStoreProp(state, nodeId, 'src', 'frameMeta.src');
    state = bindStoreProp(state, nodeId, 'title', 'frameMeta.title');
    state = bindStoreProp(state, nodeId, 'width', 'frameMeta.width');
    state = bindStoreProp(state, nodeId, 'height', 'frameMeta.height');
    state = bindStoreProp(state, nodeId, 'allowFullScreen', 'frameMeta.allowFullScreen');

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          bindingDefinitions: state.bindingDefinitions,
          designerStore: {
            frameMeta: {
              src: 'https://example.com/embed',
              title: 'Bound frame',
              width: '640',
              height: '360',
              allowFullScreen: true,
            },
          },
        })}
      </>,
    );

    const iframe = container.querySelector('iframe');
    expect(iframe?.getAttribute('src')).toBe('https://example.com/embed');
    expect(iframe?.getAttribute('title')).toBe('Bound frame');
    expect(iframe?.getAttribute('width')).toBe('640');
    expect(iframe?.getAttribute('height')).toBe('360');
    expect(iframe?.hasAttribute('allowfullscreen')).toBe(true);
  });

  it('html.image: bound width/height/loading/srcSet/sizes appear as real DOM attributes', () => {
    let state = insertItem(createInitialDesignerState(), 'html.image');
    const nodeId = lastChildId(state);
    state = bindStoreProp(state, nodeId, 'width', 'imageMeta.width');
    state = bindStoreProp(state, nodeId, 'height', 'imageMeta.height');
    state = bindStoreProp(state, nodeId, 'loading', 'imageMeta.loading');
    state = bindStoreProp(state, nodeId, 'srcSet', 'imageMeta.srcSet');
    state = bindStoreProp(state, nodeId, 'sizes', 'imageMeta.sizes');

    const { container } = render(
      <>
        {renderDesignerDocumentPreview(state.document, {
          interactive: true,
          bindingDefinitions: state.bindingDefinitions,
          designerStore: {
            imageMeta: {
              width: '320',
              height: '240',
              loading: 'lazy',
              srcSet: '/a.png 1x, /a@2x.png 2x',
              sizes: '(max-width: 600px) 100vw, 320px',
            },
          },
        })}
      </>,
    );

    const img = container.querySelector('img');
    expect(img?.getAttribute('width')).toBe('320');
    expect(img?.getAttribute('height')).toBe('240');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.getAttribute('srcset')).toBe('/a.png 1x, /a@2x.png 2x');
    expect(img?.getAttribute('sizes')).toBe('(max-width: 600px) 100vw, 320px');
  });
});
