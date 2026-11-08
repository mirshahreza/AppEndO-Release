import type { HomeWidgetDefinition } from '../../shared/api/contracts/home-widgets';

type PageModuleHomeWidgetSeed = {
  pageKey: string;
  homeWidgets: HomeWidgetDefinition[];
};

/** Fallback when page-module JSON has no `homeWidgets` (e.g. Remote Hubs from package deploy). */
export const PAGE_MODULE_HOME_WIDGET_SEEDS: PageModuleHomeWidgetSeed[] = [
  {
    pageKey: 'ssh-hub',
    homeWidgets: [{
      componentRef: 'core:SshHubHomeWidget',
      span: 'half',
      defaultVisible: false,
      catalog: {
        labelKey: 'homeWidget.sshHub.title',
        descriptionKey: 'homeWidget.sshHub.description',
        icon: 'Terminal',
        tone: 'emerald',
      },
      requiredRoles: ['ADMIN'],
      deepLink: { pageKey: 'ssh-hub' },
    }],
  },
  {
    pageKey: 'file-hub',
    homeWidgets: [{
      componentRef: 'core:FileHubHomeWidget',
      span: 'half',
      defaultVisible: false,
      catalog: {
        labelKey: 'homeWidget.fileHub.title',
        descriptionKey: 'homeWidget.fileHub.description',
        icon: 'FolderOpen',
        tone: 'cyan',
      },
      requiredRoles: ['ADMIN'],
      deepLink: { pageKey: 'file-hub' },
    }],
  },
  {
    pageKey: 'cms-contents-list',
    homeWidgets: [{
      id: 'review-queue',
      componentRef: 'core:CmsReviewQueueHomeWidget',
      span: 'half',
      defaultVisible: false,
      catalog: {
        labelKey: 'homeWidget.cmsContentsList.reviewQueue.title',
        descriptionKey: 'homeWidget.cmsContentsList.reviewQueue.description',
        icon: 'Newspaper',
        tone: 'violet',
      },
      deepLink: { pageKey: 'cms-contents-list' },
    }],
  },
  {
    pageKey: 'rdp-hub',
    homeWidgets: [{
      componentRef: 'core:RdpHubHomeWidget',
      span: 'half',
      defaultVisible: false,
      catalog: {
        labelKey: 'homeWidget.rdpHub.title',
        descriptionKey: 'homeWidget.rdpHub.description',
        icon: 'Monitor',
        tone: 'indigo',
      },
      requiredRoles: ['ADMIN'],
      deepLink: { pageKey: 'rdp-hub' },
    }],
  },
];

export function resolvePageModuleHomeWidgetSeed(pageKey: string): HomeWidgetDefinition[] | undefined {
  return PAGE_MODULE_HOME_WIDGET_SEEDS.find((seed) => seed.pageKey === pageKey)?.homeWidgets;
}
