import { createInitialDesignerState } from '../state';
import type { DesignerNode, TemplateNodeSeed } from '../types';
import {
  SHELL_CHROME_HEADER,
  SHELL_CHROME_LOGO,
  SHELL_CHROME_PORTAL_MENU,
  SHELL_CHROME_SIDEBAR_TOGGLE,
} from '../../../shared/lib/shellChromeSlots';
import { PLATFORM_NAV_TREE_TWO_LEVEL } from '../../../shared/api/contracts/platform/platformNavigationComponents';
import {
  SHELL_NAVIGATION_COMPONENT_KEY_PROP,
  SHELL_NAVIGATION_REF_PROP,
} from '../../../shared/lib/shellNavigationProps';
import {
  ADMIN_SHELL_CONTENT_HOST_CLASS,
  ADMIN_SHELL_CONTENT_WRAPPER_CLASS,
  ADMIN_SHELL_HEADER_CLASS,
  ADMIN_SHELL_HEADER_INNER_CLASS,
  ADMIN_SHELL_MAIN_CLASS,
  ADMIN_SHELL_ROOT_CLASS,
  ADMIN_SHELL_SIDEBAR_CLASS,
} from '../../../shared/ui/surfaceClasses';
import {
  ADMIN_SHELL_SIDEBAR_INSET_TEMPLATE_CLASS,
  ADMIN_SHELL_SIDEBAR_LOGO_INNER_WRAPPER_CLASS,
  ADMIN_SHELL_SIDEBAR_LOGO_REGION_TEMPLATE_CLASS,
  ADMIN_SHELL_SIDEBAR_NAV_HOST_CONTAINER_CLASS,
} from '../../../shared/ui/adminShellSidebarMetrics';

/** Designer canvas template mirroring `AdminLayout` structure and surface tokens. */
export const ADMIN_SHELL_LAYOUT_TEMPLATE: TemplateNodeSeed[] = [
  {
    type: 'container',
    props: {
      className: ADMIN_SHELL_ROOT_CLASS,
      htmlExtraAttrs: '{"data-admin-shell-root":"true"}',
    },
    children: [
      {
        type: 'container',
        props: {
          id: 'admin-shell-sidebar',
          className: `${ADMIN_SHELL_SIDEBAR_CLASS} designer-shell-sidebar w-[var(--designer-shell-sidebar-width,var(--admin-shell-sidebar-width,250px))] lg:w-[var(--designer-shell-sidebar-width,var(--admin-shell-sidebar-width,250px))] relative max-lg:-translate-x-full max-lg:rtl:translate-x-full lg:translate-x-0`,
        },
        children: [
          {
            type: 'system-slot',
            props: { slotId: SHELL_CHROME_SIDEBAR_TOGGLE },
          },
          {
            type: 'container',
            props: { className: 'flex min-h-0 flex-1 flex-col' },
            children: [
              {
                type: 'container',
                props: {
                  className: ADMIN_SHELL_SIDEBAR_LOGO_REGION_TEMPLATE_CLASS,
                },
                children: [
                  {
                    type: 'container',
                    props: { className: ADMIN_SHELL_SIDEBAR_LOGO_INNER_WRAPPER_CLASS },
                    children: [
                      {
                        type: 'system-slot',
                        props: { slotId: SHELL_CHROME_LOGO },
                      },
                    ],
                  },
                ],
              },
              {
                type: 'container',
                props: { className: ADMIN_SHELL_SIDEBAR_INSET_TEMPLATE_CLASS },
                children: [
                  {
                    type: 'system-slot',
                    props: { slotId: SHELL_CHROME_PORTAL_MENU },
                  },
                ],
              },
              {
                type: 'container',
                props: {
                  className: ADMIN_SHELL_SIDEBAR_NAV_HOST_CONTAINER_CLASS,
                },
                children: [
                  {
                    type: 'platform-nav',
                    props: {
                      [SHELL_NAVIGATION_COMPONENT_KEY_PROP]: PLATFORM_NAV_TREE_TWO_LEVEL,
                      // Empty on purpose: this template is the generic shell scaffold reused for
                      // ANY portal (not just Studio). Leaving navigationRef unset lets
                      // useShellNavigationHost fall back to the *active* portal's own
                      // shell.navigationRef at render time — hardcoding 'studio' here would make
                      // every portal built from this template show Studio's nav instead of its own.
                      [SHELL_NAVIGATION_REF_PROP]: '',
                      className: 'flex min-h-0 flex-1 flex-col h-full w-full',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'container',
        props: { className: ADMIN_SHELL_MAIN_CLASS },
        children: [
          {
            type: 'container',
            props: { className: ADMIN_SHELL_HEADER_CLASS },
            children: [
              {
                type: 'system-slot',
                props: {
                  slotId: SHELL_CHROME_HEADER,
                  className: ADMIN_SHELL_HEADER_INNER_CLASS,
                  showLogo: false,
                },
              },
            ],
          },
          {
            type: 'container',
            props: { className: ADMIN_SHELL_CONTENT_WRAPPER_CLASS },
            children: [
              {
                type: 'container',
                props: { className: ADMIN_SHELL_CONTENT_HOST_CLASS },
                children: [
                  {
                    type: 'container',
                    props: { className: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
                    children: [
                      {
                        type: 'system-slot',
                        props: {
                          slotId: 'core.shell.route-outlet',
                          className: 'flex min-h-0 min-w-0 w-full flex-1 flex-col h-full',
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

export function createStateFromAdminShellLayoutTemplate(): {
  state: ReturnType<typeof createInitialDesignerState>;
  preferredSelectedNodeId: string | null;
} {
  const baseState = createInitialDesignerState();
  const rootNodeId = baseState.document.rootNodeId;
  const now = new Date().toISOString();
  const nodes: Record<string, DesignerNode> = {
    ...baseState.document.nodes,
  };

  let seed = 0;
  const buildNode = (item: TemplateNodeSeed, parentId: string, order: number): string => {
    seed += 1;
    const nodeId = `admin-shell-${item.type}-${Date.now()}-${seed}`;
    const children = (item.children ?? []).map((child, childIndex) => buildNode(child, nodeId, childIndex));

    nodes[nodeId] = {
      id: nodeId,
      type: item.type,
      parentId,
      order,
      props: { ...(item.props ?? {}) },
      layout: {},
      binding: {},
      children,
    };

    return nodeId;
  };

  const rootChildren = ADMIN_SHELL_LAYOUT_TEMPLATE.map((item, index) => buildNode(item, rootNodeId, index));
  nodes[rootNodeId] = {
    ...nodes[rootNodeId],
    children: rootChildren,
  };

  return {
    state: {
      ...baseState,
      document: {
        ...baseState.document,
        nodes,
        metadata: {
          ...baseState.document.metadata,
          updatedAt: now,
          shellLayoutWidth: 'bounded',
          shellLayoutWidthUserControl: true,
          shellBoundedMaxWidth: 'lg',
          shellBoundedEdge: 'outset',
        },
      },
    },
    preferredSelectedNodeId: rootChildren[0] ?? null,
  };
}

