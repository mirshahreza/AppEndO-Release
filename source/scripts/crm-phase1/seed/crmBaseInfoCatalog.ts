/**
 * CRM package Base Info catalog (opt-in) — v2.
 * Not wired into controlPlaneSeed / app bootstrap.
 *
 * v2: no "Party Kinds" category — `person_type_code` is platform-owned
 * (Base Info root `100.2`), not part of the CRM root.
 */

export type CrmBaseInfoItemSeed = {
  title: string;
  shortName: string;
  lucideIcon?: string;
  viewOrder: number;
  value: number;
};

export type CrmBaseInfoCategorySeed = {
  title: string;
  viewOrder: number;
  value: number;
  items: CrmBaseInfoItemSeed[];
};

const lucide = (name: string) => `<i data-lucide="${name}"></i>`;

const item = (
  title: string,
  shortName: string,
  viewOrder: number,
  lucideIcon?: string,
): CrmBaseInfoItemSeed => ({
  title,
  shortName,
  viewOrder,
  value: viewOrder,
  lucideIcon,
});

export const CRM_BASE_INFO_ROOT_TITLE = 'CRM';

export const CRM_BASE_INFO_CATEGORIES: CrmBaseInfoCategorySeed[] = [
  {
    title: 'Lifecycle Stages',
    viewOrder: 1,
    value: 1,
    items: [
      item('Lead', 'lead', 1, 'Sprout'),
      item('Qualified', 'qualified', 2, 'BadgeCheck'),
      item('Customer', 'customer', 3, 'Handshake'),
      item('Lost', 'lost', 4, 'UserX'),
    ],
  },
  {
    title: 'Lead Sources',
    viewOrder: 2,
    value: 2,
    items: [
      item('Website', 'website', 1, 'Globe'),
      item('Referral', 'referral', 2, 'Users'),
      item('Cold Call', 'cold_call', 3, 'Phone'),
      item('Event', 'event', 4, 'CalendarDays'),
      item('Advertising', 'advertising', 5, 'Megaphone'),
      item('Import', 'import', 6, 'Upload'),
      item('Other', 'other', 7, 'CircleEllipsis'),
    ],
  },
  {
    title: 'Pipeline Stages',
    viewOrder: 3,
    value: 3,
    items: [
      item('New', 'new', 1, 'Sparkle'),
      item('Qualifying', 'qualifying', 2, 'SearchCheck'),
      item('Proposal', 'proposal', 3, 'FileText'),
      item('Negotiation', 'negotiation', 4, 'Scale'),
      item('Won', 'won', 5, 'Trophy'),
      item('Lost', 'lost', 6, 'XCircle'),
    ],
  },
  {
    title: 'Activity Types',
    viewOrder: 4,
    value: 4,
    items: [
      item('Call', 'call', 1, 'Phone'),
      item('Email', 'email', 2, 'Mail'),
      item('Meeting', 'meeting', 3, 'Users'),
      item('Note', 'note', 4, 'StickyNote'),
      item('Task', 'task', 5, 'ListTodo'),
    ],
  },
  {
    title: 'Ticket Status',
    viewOrder: 5,
    value: 5,
    items: [
      item('New', 'new', 1, 'CircleDot'),
      item('Open', 'open', 2, 'FolderOpen'),
      item('Pending', 'pending', 3, 'Clock'),
      item('Resolved', 'resolved', 4, 'CheckCircle2'),
      item('Closed', 'closed', 5, 'Archive'),
    ],
  },
  {
    title: 'Ticket Priority',
    viewOrder: 6,
    value: 6,
    items: [
      item('Low', 'low', 1, 'ArrowDown'),
      item('Normal', 'normal', 2, 'Minus'),
      item('High', 'high', 3, 'ArrowUp'),
      item('Urgent', 'urgent', 4, 'TriangleAlert'),
    ],
  },
  {
    title: 'Ticket Channel',
    viewOrder: 7,
    value: 7,
    items: [
      item('Email', 'email', 1, 'Mail'),
      item('Phone', 'phone', 2, 'Phone'),
      item('Web Form', 'web_form', 3, 'FileText'),
      item('Chat', 'chat', 4, 'MessageCircle'),
      item('Social', 'social', 5, 'Share2'),
    ],
  },
  {
    title: 'Customer Tags',
    viewOrder: 8,
    value: 8,
    items: [
      item('VIP', 'vip', 1, 'Star'),
      item('Cold', 'cold', 2, 'Snowflake'),
      item('Newsletter Subscriber', 'newsletter_subscriber', 3, 'Mail'),
      item('Partner', 'partner', 4, 'Handshake'),
      item('Reseller', 'reseller', 5, 'Repeat'),
      item('High Value', 'high_value', 6, 'Gem'),
      item('At Risk', 'at_risk', 7, 'AlertTriangle'),
      item('Do Not Contact', 'do_not_contact', 8, 'BellOff'),
    ],
  },
];

export const crmBaseInfoUiHtml = (lucideIcon?: string): string | null => (
  lucideIcon ? lucide(lucideIcon) : null
);

/** Lucide icon names keyed by Base Info `short_name` (from the CRM catalog). */
export const CRM_BASE_INFO_ITEM_UI_ICONS: Record<string, string> = Object.fromEntries(
  CRM_BASE_INFO_CATEGORIES.flatMap((category) => (
    category.items
      .filter((entry) => entry.lucideIcon)
      .map((entry) => [entry.shortName, entry.lucideIcon!])
  )),
);
