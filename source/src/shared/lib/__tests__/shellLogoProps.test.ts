import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../../../domain/component-designer/state';
import {
  extractShellLogoConfigFromDocument,
  resolveShellLogoConfigFromProps,
  resolveShellLogoImageSrc,
  SHELL_LOGO_ALT_PROP,
  SHELL_LOGO_HREF_PROP,
  SHELL_LOGO_SRC_PROP,
} from '../shellLogoProps';
import { SHELL_CHROME_LOGO } from '../shellChromeSlots';
import { resolveShellChromeTemplateSeeds } from '../../../domain/component-designer/shellChromeTemplates';

describe('shellLogoProps', () => {
  it('resolves custom logo src and falls back to default asset', () => {
    expect(resolveShellLogoImageSrc({ src: 'https://example.com/logo.png' }))
      .toBe('https://example.com/logo.png');
    expect(resolveShellLogoImageSrc(null)).toBe('/assets/appendo-logo.png');
  });

  it('reads logo config from slot props', () => {
    expect(resolveShellLogoConfigFromProps({
      [SHELL_LOGO_SRC_PROP]: ' /assets/custom.png ',
      [SHELL_LOGO_ALT_PROP]: 'My brand',
      [SHELL_LOGO_HREF_PROP]: 'https://example.com',
    })).toEqual({
      src: '/assets/custom.png',
      alt: 'My brand',
      href: 'https://example.com',
    });
  });

  it('extracts logo config from the first logo system-slot in a document', () => {
    const initial = createInitialDesignerState();
    const inserted = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'shell.chrome.slot-logo',
      parentId: initial.document.rootNodeId,
    });

    const logoNodeId = inserted.document.nodes[inserted.document.rootNodeId].children[0];
    const withLogo = designerReducer(inserted, {
      type: 'set-node-prop',
      nodeId: logoNodeId,
      key: SHELL_LOGO_SRC_PROP,
      value: 'data:image/png;base64,abc',
    });

    const logoNode = withLogo.document.nodes[logoNodeId];
    expect(logoNode.props.slotId).toBe(SHELL_CHROME_LOGO);
    expect(extractShellLogoConfigFromDocument(withLogo.document)).toEqual({
      src: 'data:image/png;base64,abc',
    });
  });

  it('seeds logo slot template with logo prop keys', () => {
    const seeds = resolveShellChromeTemplateSeeds('shell.chrome.slot-logo');
    expect(seeds?.[0]?.props?.[SHELL_LOGO_SRC_PROP]).toBe('');
    expect(seeds?.[0]?.props?.[SHELL_LOGO_ALT_PROP]).toBe('');
    expect(seeds?.[0]?.props?.[SHELL_LOGO_HREF_PROP]).toBe('');
  });
});
