import { describe, expect, it } from 'vitest';
import { createInitialDesignerState, designerReducer } from '../../../domain/component-designer/state';
import {
  extractShellHeaderConfigFromDocument,
  resolveShellHeaderConfigFromProps,
  SHELL_HEADER_SHOW_LOGO_PROP,
  SHELL_HEADER_SHOW_BREADCRUMB_PROP,
  SHELL_HEADER_SHOW_ACTIONS_PROP,
} from '../shellHeaderProps';
import { SHELL_CHROME_HEADER } from '../shellChromeSlots';

describe('shellHeaderProps', () => {
  it('reads header config from slot props', () => {
    expect(resolveShellHeaderConfigFromProps({
      [SHELL_HEADER_SHOW_LOGO_PROP]: true,
      [SHELL_HEADER_SHOW_BREADCRUMB_PROP]: false,
      [SHELL_HEADER_SHOW_ACTIONS_PROP]: true,
    })).toEqual({
      showLogo: true,
      showBreadcrumb: false,
      showActions: true,
    });
  });

  it('extracts header config from the first header system-slot in a document', () => {
    const initial = createInitialDesignerState();
    const inserted = designerReducer(initial, {
      type: 'insert-palette-item',
      itemId: 'shell.chrome.header',
      parentId: initial.document.rootNodeId,
    });

    const headerContainerId = inserted.document.nodes[inserted.document.rootNodeId].children[0];
    const headerNodeId = inserted.document.nodes[headerContainerId].children[0];
    
    const withHeader = designerReducer(inserted, {
      type: 'set-node-prop',
      nodeId: headerNodeId,
      key: SHELL_HEADER_SHOW_BREADCRUMB_PROP,
      value: false,
    });

    const headerNode = withHeader.document.nodes[headerNodeId];
    expect(headerNode.props.slotId).toBe(SHELL_CHROME_HEADER);
    expect(extractShellHeaderConfigFromDocument(withHeader.document)).toEqual({
      showLogo: true,
      showBreadcrumb: false,
      showActions: true,
    });
  });
});
