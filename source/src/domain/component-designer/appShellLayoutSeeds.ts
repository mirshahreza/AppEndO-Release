import { PLATFORM_NAV_TREE_TWO_LEVEL } from '../../shared/api/contracts/platform/platformNavigationComponents';
import {
  SHELL_CHROME_HEADER,
  SHELL_CHROME_LOGO,
  SHELL_CHROME_PORTAL_MENU,
  SHELL_CHROME_SIDEBAR_TOGGLE,
} from '../../shared/lib/shellChromeSlots';
import {
  SHELL_NAVIGATION_COMPONENT_KEY_PROP,
  SHELL_NAVIGATION_REF_PROP,
} from '../../shared/lib/shellNavigationProps';
import {
  ADMIN_SHELL_CONTENT_HOST_CLASS,
  ADMIN_SHELL_CONTENT_WRAPPER_CLASS,
  ADMIN_SHELL_HEADER_CLASS,
  ADMIN_SHELL_HEADER_INNER_CLASS,
  ADMIN_SHELL_MAIN_CLASS,
  ADMIN_SHELL_ROOT_CLASS,
  ADMIN_SHELL_SIDEBAR_CLASS,
} from '../../shared/ui/surfaceClasses';
import {
  ADMIN_SHELL_SIDEBAR_INSET_TEMPLATE_CLASS,
  ADMIN_SHELL_SIDEBAR_LOGO_INNER_WRAPPER_CLASS,
  ADMIN_SHELL_SIDEBAR_LOGO_REGION_TEMPLATE_CLASS,
  ADMIN_SHELL_SIDEBAR_NAV_HOST_CONTAINER_CLASS,
} from '../../shared/ui/adminShellSidebarMetrics';
import type { TemplateNodeSeed } from './types';

/** Designer canvas template mirroring `AppShell` / AdminLayout structure and surface tokens. */
export const APP_SHELL_LAYOUT_TEMPLATE: TemplateNodeSeed[] = [
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
          className: `${ADMIN_SHELL_SIDEBAR_CLASS} designer-shell-sidebar w-[var(--designer-shell-sidebar-width,var(--admin-shell-sidebar-width,250px))] md:w-[var(--designer-shell-sidebar-width,var(--admin-shell-sidebar-width,250px))] relative max-md:-translate-x-full max-md:rtl:translate-x-full md:translate-x-0`,
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
                      [SHELL_NAVIGATION_REF_PROP]: 'studio',
                      className: 'min-h-0',
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
