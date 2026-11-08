import type { WorkItemInboxBucket } from '../types';
import { resolveCultureLabel } from '../../../core/culture/cultureShellKeys';
import type { useCultureT } from '../../../core/culture/CultureContext';

export type WorkItemInboxTab = WorkItemInboxBucket | 'OPEN_TASKS';

export const buildWorkItemInboxBucketGroups = (
  t: ReturnType<typeof useCultureT>,
): Array<{ groupLabel: string; buckets: Array<{ value: WorkItemInboxTab; label: string }> }> => [
  {
    groupLabel: resolveCultureLabel(t, 'shell.inbox.workItem.group.all', 'All'),
    buckets: [{
      value: 'OPEN_TASKS',
      label: resolveCultureLabel(t, 'shell.inbox.workItem.bucket.openTasks', 'Open tasks'),
    }],
  },
  {
    groupLabel: resolveCultureLabel(t, 'shell.inbox.workItem.group.myWorklist', 'My worklist'),
    buckets: [
      {
        value: 'MINE_ASSIGNED',
        label: resolveCultureLabel(t, 'shell.inbox.workItem.bucket.assignedToMe', 'Assigned to me'),
      },
      {
        value: 'MINE_CLAIMED',
        label: resolveCultureLabel(t, 'shell.inbox.workItem.bucket.claimedByMe', 'Claimed by me'),
      },
      {
        value: 'MINE_RECENT',
        label: resolveCultureLabel(t, 'shell.inbox.workItem.bucket.recentlyCompleted', 'Recently completed'),
      },
    ],
  },
  {
    groupLabel: resolveCultureLabel(t, 'shell.inbox.workItem.group.teamQueue', 'Team queue'),
    buckets: [{
      value: 'AVAILABLE_TO_CLAIM',
      label: resolveCultureLabel(t, 'shell.inbox.workItem.bucket.availableToClaim', 'Available to claim'),
    }],
  },
];
