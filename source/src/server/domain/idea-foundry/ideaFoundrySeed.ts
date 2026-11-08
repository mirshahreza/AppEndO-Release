import { QueryTypes } from 'sequelize';
import { SETTINGS_PATH } from '../../config/settingsFile';
import { getAiSettings } from '../../db/aiSettingsStore';
import { getControlPlaneSequelize } from '../../db/controlPlaneSequelize';
import { isAiModelChatCapable } from '../../../shared/api/contracts/ai/constants';
import type {
  IdeaImportance,
  IdeaMaturity,
  IdeaPackageHome,
  IdeaScale,
  IdeaTargetKind,
  IdeaTeamModel,
  IdeaTeamPerson,
} from '../../../shared/api/contracts/idea-foundry/types';
import { IDEA_WHOLE_PACKAGE_SECTION_KEY } from '../../../shared/api/contracts/idea-foundry/types';
import { ensureProductIdeaTable } from './ideaFoundrySequelizeModel';
import { listIdeaPackageHomes } from './ideaFoundryHomes';
import { replaceAllProductIdeas } from './ideaFoundryRepository';
import { loadIdeaTeamPeopleByIds } from './ideaFoundryTeam';

type SeedSpec = {
  title: string;
  description: string;
  icon: string;
  importance: IdeaImportance;
  scale: IdeaScale;
  maturity: IdeaMaturity;
  targetKind: IdeaTargetKind;
  packageHint?: string;
  frontOffice: string;
  backOffice: string;
};

const SEED_SPECS: readonly SeedSpec[] = [
  {
    title: 'Night-shift dispatch board',
    description: [
      'Warehouse night crews still reconcile pick lists on paper and in a shared chat. Between 22:00 and 06:00 a clerk can spend twenty to forty minutes finding who owns the next aisle, which lines are blocked, and which short-picks the supervisor already knows about.',
      'The idea is a live floor board that is the only place night work is claimed. Open picks, blockers, and ownership sit on one surface so the team does not reconstruct the shift from screenshots.',
      'Who it is for: night clerks, the on-floor supervisor, and the morning handover desk. Guests never see it. Why now: overtime on the night shift is already billed to “reconciling lists,” and a first slice can replace the chat thread without touching daytime WMS.',
    ].join('\n\n'),
    icon: 'lucide:Moon',
    importance: 'high',
    scale: 'medium',
    maturity: 'defining',
    targetKind: 'new-package',
    frontOffice: [
      'This is a staff floor tool. There is no public site, no guest login, and no customer tracking page.',
      'The only guest-facing effect is faster morning dispatch: orders that cleared overnight leave the dock on time because the night crew did not lose the list.',
    ].join('\n\n'),
    backOffice: [
      'Night clerk opens the board at shift start and sees open picks grouped by aisle, age, and owner.',
      '- Claims a pick so the rest of the floor knows it is taken',
      '- Flags a short-pick with a reason the supervisor can act on',
      '- Hands a blocked line to the next aisle without rewriting the paper list',
      '',
      'Supervisor filters by blocker type, reassigns a stalled pick, and writes the morning note the day crew will read. Handover desk prints or exports only the lines that did not close.',
    ].join('\n'),
  },
  {
    title: 'Field service dispatch',
    description: [
      'Field technicians still receive jobs over chat: an address, a photo of a broken unit, and a hope that the van has the part. Dispatchers spend the morning asking who is nearest, who has the SKU, and who can take a second call after lunch. Customers call twice because nobody can say when the tech will arrive.',
      'The idea is a dispatch map that assigns nearby techs, shows parts on each van, and closes the visit with a photo and a parts list written back to stock. First slice: assign, check in, close. Later: routing, SLA clocks, and contract jobs.',
      'Who it is for: dispatchers, techs in the field, and the customer waiting at the door. Why now: missed first-time-fix and no-shows are already a weekly complaint, and chat is not an audit trail when a part is missing.',
    ].join('\n\n'),
    icon: 'lucide:Truck',
    importance: 'critical',
    scale: 'large',
    maturity: 'cooking-idea',
    targetKind: 'new-package',
    frontOffice: [
      'Customer opens a simple status page from the booking SMS: assigned, on the way, on site, done.',
      '- Confirms or declines the offered slot without calling the desk',
      '- Sees a narrow arrival window once the tech is en route',
      '- Signs the visit close on a phone and keeps a copy of the work note',
      '',
      'No map of every van in the city. The guest only sees their own job. If they reschedule, the slot returns to the dispatcher queue.',
    ].join('\n'),
    backOffice: [
      'Dispatcher sees open jobs on a map, each van’s next free window, and which parts are tagged to that van.',
      '- Assigns a job to the nearest tech who has the part, or flags a parts run',
      '- Watches check-in and overdue jobs without pinging the group chat',
      '',
      'Tech checks in on site, logs parts used, attaches a close photo, and marks the visit done. Stock is written back so the next dispatcher does not send a van that is empty. Supervisor reviews first-time-fix and repeats.',
    ].join('\n'),
  },
  {
    title: 'Loyalty wallet',
    description: [
      'Member points still live in a spreadsheet that one operator updates after closing. Earn rules live in someone’s head. Redeem at till means the cashier asks for a phone number, waits, and hopes the row is right. Members cannot see a balance without calling, so they stop asking.',
      'A wallet package would let members see balance, earn on checkout, and redeem at till without a second login. The same ledger is what cashiers and finance trust. This is a new vertical, not a CMS plugin: identity, earn, burn, and till must stay in one product.',
      'Who it is for: members at checkout and in an account page, cashiers, and the operator who adjusts mistakes. Why now: a competitor already shows a live balance, and the spreadsheet cannot survive a second store.',
    ].join('\n\n'),
    icon: 'lucide:Wallet',
    importance: 'high',
    scale: 'epic',
    maturity: 'in-production',
    targetKind: 'new-package',
    frontOffice: [
      'Member opens the wallet from the account or from a QR at till.',
      '- Sees current points, pending earn from today’s basket, and what a reward costs',
      '- Applies a reward at checkout; the till shows the same number',
      '- Reads a short history of earn and redeem without a separate loyalty site',
      '',
      'Guest checkout still works. Wallet is for identified members. Earn posts after payment, not when the basket is still open.',
    ].join('\n'),
    backOffice: [
      'Operator reviews earn rules (percent, SKU, campaign window) and publishes a change that cashiers will see on the next basket.',
      '- Adjusts a balance with a reason that finance can audit',
      '- Voids a mistaken redeem and restores points',
      '- Looks up a member by till receipt when the phone number was mistyped',
      '',
      'Finance exports the ledger for a day. Store manager sees redeem volume by till, not a dump of the spreadsheet.',
    ].join('\n'),
  },
  {
    title: 'Vendor onboarding portal',
    description: [
      'New suppliers still email PDFs: tax forms, catalog extracts, bank details, and a first purchase order in four different threads. Buyers chase missing pages. Compliance cannot say whether a vendor is allowed to ship. The first PO is typed again into the ERP by hand.',
      'A portal would collect tax docs, catalog SKUs, and the first purchase order in one path, with a status the buyer and the vendor both see. Activation is a decision, not an inbox search.',
      'Who it is for: new vendors, buyers, and compliance. Why now: onboarding time is measured in weeks, and every delayed SKU is a stock-out the sales team already promised.',
    ].join('\n\n'),
    icon: 'lucide:Building2',
    importance: 'medium',
    scale: 'large',
    maturity: 'ready-to-use',
    targetKind: 'new-package',
    frontOffice: [
      'Vendor creates an account with a token from the buyer, not an open public signup.',
      '- Uploads the required pack (tax, bank, catalog file) and sees which files are still missing',
      '- Answers a short questionnaire the buyer configured for this category',
      '- Tracks approval: received, questions, approved, live',
      '- Downloads the first PO once the buyer issues it, instead of waiting on email',
      '',
      'The public site does not list vendors. This portal is for invited suppliers only.',
    ].join('\n'),
    backOffice: [
      'Buyer opens the pack, marks a file accepted or asks for a replacement with a note the vendor sees.',
      '- Routes tax docs to compliance without forwarding the whole mailbox',
      '- Activates the vendor so catalog SKUs can be ordered',
      '- Issues the first PO from the same record, not a side spreadsheet',
      '',
      'Compliance records the review date. Purchasing sees only vendors that are live. A rejected pack stays in history so the next attempt is not a blank form.',
    ].join('\n'),
  },
  {
    title: 'Knowledge desk',
    description: [
      'Support still answers the same how-to questions in chat because the written answers live in personal notes. New agents copy old threads. Customers open tickets for steps that already exist in a PDF nobody can find.',
      'A searchable desk of operator-owned articles would sit next to tickets: the customer searches first, the agent pins the article that actually closed the case, and editors publish a how-to without waiting on a developer.',
      'Who it is for: customers before they ticket, agents on the line, and the small editor group that owns the desk. Why now: ticket volume on “how do I…” is the cheapest work to cut, and the CMS is the wrong home if the desk must sit beside the ticket.',
    ].join('\n\n'),
    icon: 'lucide:BookOpen',
    importance: 'medium',
    scale: 'small',
    maturity: 'defining',
    targetKind: 'new-package',
    frontOffice: [
      'Customer searches help from the account or from a link in the ticket form, before they submit.',
      '- Opens an article in the public language of the site',
      '- Marks whether it solved the problem; that signal goes back to editors',
      '- Continues to a ticket if nothing matches, with the query attached so the agent sees what they already tried',
      '',
      'No comment wall on articles in the first slice. Search and read only.',
    ].join('\n'),
    backOffice: [
      'Editor drafts a how-to, links related articles, and publishes without a code release.',
      '- Agent pins an article onto an open ticket so the next person does not re-explain',
      '- Desk owner sees which articles are opened from tickets and which never close a case',
      '- Retired articles stay in history for agents but drop out of public search',
      '',
      'The desk is not a second CMS. Articles are short, owned, and meant to sit next to work, not a magazine.',
    ].join('\n'),
  },
  {
    title: 'Returns desk',
    description: [
      'Returns at the counter are still a paper form: order number, reason, exchange or refund, and a label written by hand. Shoppers who bought online cannot start the return from the order page. Clerks guess restock versus dump. Finance reconciles refunds a day later from a stack of slips.',
      'The idea is a desk that scans the order, offers exchange or refund under the same policy the site already promised, and prints a label. Inspection is a step, not a side conversation.',
      'Who it is for: shoppers starting a return, counter clerks, and the warehouse that receives the parcel. Why now: return volume is already a cost line, and paper cannot show the same policy the website advertised.',
    ].join('\n\n'),
    icon: 'lucide:Undo2',
    importance: 'high',
    scale: 'medium',
    maturity: 'cooking-idea',
    targetKind: 'new-package',
    frontOffice: [
      'Shopper starts a return from the order page after login, or from a QR on the receipt at the counter.',
      '- Chooses pickup, drop-off, or bring-to-store',
      '- Picks exchange (same SKU, new size) or refund to the original tender when the policy allows it',
      '- Prints or shows a label; the carrier scan is the proof the desk will later match',
      '',
      'Guest (no account) can start from order number plus email, with a cap on how many open returns that address may hold.',
    ].join('\n'),
    backOffice: [
      'Clerk inspects the item against the order line, photos damage if needed, and chooses restock, repair, or dump.',
      '- Closes as refund, exchange, or store credit under the published policy — not a free-text exception without a reason code',
      '- Prints the inbound label when the shopper did not',
      '',
      'Warehouse scans the inbound parcel onto the case. Finance sees refunds that actually received goods. Supervisor reviews exceptions that bypassed the policy.',
    ].join('\n'),
  },
  {
    title: 'Editorial calendar',
    description: [
      'CMS stories still ship without a shared week. Editors hear the publish time in standup. Reviewers find drafts in personal folders. Two stories land on the same slot and one is pulled after it is already public. Marketing cannot see what is coming without pinging the desk.',
      'Editors need a week view of drafts, reviews, and publish slots that is the plan of record — drag a draft onto a slot, see collisions, and mark ready without leaving the CMS package.',
      'Who it is for: editors, reviewers, and the person who owns the homepage slot. Readers never see the calendar. Why now: missed slots and last-minute swaps are already a weekly incident, and a spreadsheet next to CMS is a second source of truth.',
    ].join('\n\n'),
    icon: 'lucide:CalendarDays',
    importance: 'medium',
    scale: 'small',
    maturity: 'defining',
    targetKind: 'existing-package',
    packageHint: 'cms',
    frontOffice: [
      'Readers only see published stories on the public site. The calendar, draft titles, and slot owners are not public and are not indexed.',
      'The only guest-facing change is that the homepage and section fronts update when a slot actually publishes, not when someone remembered to hit publish after the meeting.',
    ].join('\n\n'),
    backOffice: [
      'Editor opens a week view of the CMS package: each day shows slots, draft titles, and who owns review.',
      '- Drags a draft onto a publish slot; a collision is visible before save',
      '- Reviewer marks the story ready or sends it back with a note on the same record',
      '- Slot owner locks a homepage slot so a late draft cannot silently replace it',
      '',
      'The calendar does not replace the story editor. It is the schedule next to Contents, using the same records.',
    ].join('\n'),
  },
  {
    title: 'Content moderation queue',
    description: [
      'UGC comments still land live. A slur or a spam dump is public until someone happens to scroll. Moderators work from email alerts with no parent story, no author history, and no way to hide a thread without deleting the whole page.',
      'A moderation queue would hold new comments, show the parent story and nearby comments, and let staff approve, hide, or escalate. First-time posters can sit in a stricter lane without blocking trusted members.',
      'Who it is for: readers who comment, and the small staff who keep the site readable. Why now: a single unmoderated hour already produced a takedown request, and live-by-default is not a policy the legal team will sign.',
    ].join('\n\n'),
    icon: 'lucide:Shield',
    importance: 'critical',
    scale: 'medium',
    maturity: 'cooking-idea',
    targetKind: 'existing-package',
    packageHint: 'cms',
    frontOffice: [
      'Reader posts a comment that stays pending until staff act, with a clear “waiting for review” state on their own comment.',
      '- Trusted members (policy still TBD) may publish immediately; everyone else waits',
      '- The public story shows only approved comments; hidden ones never appear in the thread',
      '- Author can edit within a short window; edits re-enter the queue if the policy says so',
      '',
      'No public “report” backlog in the first slice — report can land in the same queue as new posts.',
    ].join('\n'),
    backOffice: [
      'Moderator opens the queue sorted by age, story, and first-time poster.',
      '- Reads the parent story and two comments of context without leaving the row',
      '- Approves, hides, or escalates with a reason code',
      '- Applies a mute or a block on the identity that CMS already stores for the commenter',
      '',
      'Editor of the story can jump to the queue filtered to that story. Audit keeps who hid what. The queue is a CMS section, not a separate product.',
    ].join('\n'),
  },
  {
    title: 'Story preview for authors',
    description: [
      'Authors still cannot see the public layout until the story is published. Spacing, related modules, and the section chrome are a surprise. Reviewers approve from the editor canvas and then ask for a rollback when the live page looks different.',
      'A preview surface in CMS would render the story in the site shell, watermarked, not indexed, with a private link the reviewer can open without a Studio seat.',
      'Who it is for: authors and reviewers. Why now: layout bugs after publish are cheap to prevent and expensive to explain. This is a thin slice on the existing editor, not a new package.',
    ].join('\n\n'),
    icon: 'lucide:Eye',
    importance: 'low',
    scale: 'spark',
    maturity: 'in-production',
    targetKind: 'existing-package',
    packageHint: 'cms',
    frontOffice: [
      'Preview uses the public template and the current theme, with a watermark and `noindex`. It is not the live URL.',
      '- A private link opens the preview for a reviewer who is not in Studio',
      '- The link expires; it is not a permanent public path',
      '- Draft widgets that are unpublished stay unpublished on the real site',
      '',
      'Search engines and anonymous visitors never receive the preview document.',
    ].join('\n'),
    backOffice: [
      'Author opens Preview from the CMS editor. The same draft the editor holds is what the shell renders.',
      '- Shares a private link with the reviewer; revoke is one action',
      '- Reviewer comments stay on the story record, not in a side chat',
      '- Publish is still the editor’s publish — preview never publishes by itself',
      '',
      'First slice is one template. Locale and A/B shells can wait.',
    ].join('\n'),
  },
  {
    title: 'CMS tag taxonomy',
    description: [
      'Tags are still free text. “Q3”, “q3”, and “Quarter 3” are three pages. Authors invent tags per story. Tag pages on the public site are thin and duplicated. Merging later is a content incident.',
      'A controlled taxonomy would let editors pick from a tree, block unknown tags at publish, and merge duplicates into a canonical name so public tag pages stay one URL.',
      'Who it is for: editors attaching tags, and readers who browse by topic. Why now: the tag cloud is already noise, and SEO is counting split pages as separate topics.',
    ].join('\n\n'),
    icon: 'lucide:Tags',
    importance: 'medium',
    scale: 'small',
    maturity: 'ready-to-use',
    targetKind: 'existing-package',
    packageHint: 'cms',
    frontOffice: [
      'Tag pages list stories under the canonical name only. Redirects from merged aliases keep old URLs alive.',
      '- Section navigation can show the tree’s top terms, not every stray string an author typed',
      '- Empty tags (no published stories) do not appear on the public site',
      '',
      'Readers do not edit the taxonomy. They follow links the CMS already resolved.',
    ].join('\n'),
    backOffice: [
      'Editor attaches tags from the tree in the story editor; typeahead does not create a new term unless they have the right.',
      '- Taxonomy owner adds a child term, renames, or merges a duplicate into a parent',
      '- Merge rewrites attached stories and writes a redirect for the public alias',
      '- A report lists tags used once, so the tree can be pruned',
      '',
      'This stays inside CMS vocab, not a new package. Free-text tags are closed once the tree is live.',
    ].join('\n'),
  },
  {
    title: 'Pipeline health board',
    description: [
      'Sales still tracks deals in chat and a personal spreadsheet. Managers hear about stalled stages in standup. Next action is a message someone forgot. When a rep is out, the pipeline is a screenshot.',
      'A board on the CRM package would show stalled stages, owner, and next action as the working surface — not a report exported on Friday. Reps move a deal; managers filter by age and owner without asking the room.',
      'Who it is for: reps and sales managers. Prospects never see it. Why now: forecast reviews are already fiction, and CRM without a health board is a contact list.',
    ].join('\n\n'),
    icon: 'lucide:Kanban',
    importance: 'high',
    scale: 'large',
    maturity: 'cooking-idea',
    targetKind: 'existing-package',
    packageHint: 'crm',
    frontOffice: [
      'Prospects never see the board, the stall age, or the next-action notes. Public forms and the customer portal stay as they are.',
      'The only outside effect is that a rep who works the board actually follows up, so the prospect hears from a person instead of silence.',
    ].join('\n\n'),
    backOffice: [
      'Rep opens the CRM board: columns are stages the package already uses, cards are deals they own or their team owns.',
      '- Moves a deal, must enter a next step and a date before the card rests in the new column',
      '- Filters to stalled (no activity past the team’s threshold) without a custom report',
      '',
      'Manager filters by owner, region, and stalled age. A deal with no next action is visible as empty, not hidden. Activity on the card is the CRM timeline, not a parallel chat. Won/lost follow the package’s existing confirm path.',
    ].join('\n'),
  },
  {
    title: 'Appointment reminders',
    description: [
      'No-shows are high because reminders are still a person sending messages the afternoon before. Guests forget the slot. Staff find empty chairs and a full waitlist they cannot use. Reschedule happens on a phone call that nobody logs.',
      'The calendar package should send a confirm link the day before, record the answer, and free the slot when the guest declines — without a new product.',
      'Who it is for: guests who booked, and the desk that lives in the empty hour. Why now: no-show rate is already a weekly metric, and the calendar already has the slot; it does not need another app to speak.',
    ].join('\n\n'),
    icon: 'lucide:Bell',
    importance: 'high',
    scale: 'small',
    maturity: 'in-production',
    targetKind: 'existing-package',
    packageHint: 'calendar',
    frontOffice: [
      'Guest receives a reminder on the channel they booked with (email or SMS) the day before the slot.',
      '- Confirms, or reschedules into an open slot the link offers',
      '- If they decline, they see that the slot is released; they are not left wondering',
      '- Same link does not work after the appointment has started',
      '',
      'No public calendar of every staff member. The guest only acts on their booking.',
    ].join('\n'),
    backOffice: [
      'Staff see, on the day’s list, who confirmed, who is pending, and which slots opened when someone declined.',
      '- Manual reminder is still possible for a guest with no working channel',
      '- Waitlist (if the package already has one) can be offered the freed slot; first slice may be notify-only',
      '- No-show after confirm is marked so the next reminder copy can change',
      '',
      'Templates live with the calendar package, not in a side mail tool. Quiet hours and locale follow the booking.',
    ].join('\n'),
  },
  {
    title: 'Forum digest for moderators',
    description: [
      'Moderators miss overnight reports. Flags sit in the forum until morning. First-time posters in a hot thread are not reviewed until someone is already angry. There is no single place that says “what happened while you slept.”',
      'A daily digest of new threads, flags, and first-time posters would sit on the forum package: open it, jump to the flagged thread, mark reviewed. Members keep posting as they do today.',
      'Who it is for: moderators, not members. Why now: overnight volume already exceeds what a volunteer can scroll, and email-per-flag is noise they ignore.',
    ].join('\n\n'),
    icon: 'lucide:MessagesSquare',
    importance: 'low',
    scale: 'spark',
    maturity: 'defining',
    targetKind: 'existing-package',
    packageHint: 'forum',
    frontOffice: [
      'Members keep posting as today. The digest is not a public page, not an email to the whole forum, and not a change to how threads appear.',
      'The only member-facing effect is faster action on flags: a hidden post comes down in the morning instead of at noon.',
    ].join('\n\n'),
    backOffice: [
      'Moderator opens the digest for the last night (or last 24 hours): new threads, flags, first-time posters, and posts that hit a simple keyword list if one exists.',
      '- Jumps to a flagged thread in the existing forum UI',
      '- Marks the digest row reviewed so the next moderator does not repeat the work',
      '- Optional: a scheduled send of the same summary to the moderator group, still linking back to this page',
      '',
      'This is not a second moderation product. It is a morning view on the forum package. Live queue tools can wait.',
    ].join('\n'),
  },
  {
    title: 'HR leave balance card',
    description: [
      'People still ask HR for remaining days in chat. HR looks it up in a spreadsheet, answers, and the number is already wrong after a half-day that nobody posted. Managers approve in email. Payroll discovers the leave when someone is missing.',
      'A card on the HR package would show balances the employee can trust and a request button that starts the same path the manager already uses. Corrections stay with HR, not in the chat log.',
      'Who it is for: employees, managers, HR, and payroll as a reader of the balance. Why now: the chat lookup is unpaid HR time, and a wrong balance is already a grievance.',
    ].join('\n\n'),
    icon: 'lucide:Sun',
    importance: 'medium',
    scale: 'small',
    maturity: 'ready-to-use',
    targetKind: 'existing-package',
    packageHint: 'hr',
    frontOffice: [
      'Employee opens the HR package (self-service) and sees remaining days by leave type, pending requests, and blackout dates the policy already defined.',
      '- Submits a request with dates and a type; they see it as pending, not as a chat they hope someone saw',
      '- Cancels a pending request before it is approved',
      '- Does not see other people’s balances',
      '',
      'There is no public careers-site widget. This card is for people who already have an identity in the tenant.',
    ].join('\n'),
    backOffice: [
      'Manager sees requests for their team, approves or declines with a note, and the balance updates when the policy says it should (on approve, or on the day).',
      '- HR adjusts a correction (payroll error, carry-over) with a reason the employee can see as an adjustment, not as silence',
      '- Payroll reads the balance and the approved dates; it does not re-key from email',
      '',
      'Policy (accrual, types) stays where HR already configured it. The card does not invent a second leave engine.',
    ].join('\n'),
  },
];

const FALLBACK_MODEL: IdeaTeamModel = { id: 'workshop-model', name: 'Workshop model' };

const loadActorIds = async (): Promise<number[]> => {
  const rows = await getControlPlaneSequelize().query<{ id: number | string }>(
    'SELECT id FROM base_users ORDER BY id ASC',
    { type: QueryTypes.SELECT },
  );
  return rows
    .map((row) => Number(row.id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 3);
};

const loadSeedModels = (): IdeaTeamModel[] => {
  try {
    const settings = getAiSettings(SETTINGS_PATH);
    const models = settings.models
      .filter((model) => model.enabled && isAiModelChatCapable(model))
      .map((model) => ({ id: model.id, name: model.name.trim() || model.id }))
      .filter((model) => model.id && model.name)
      .slice(0, 3);
    return models.length > 0 ? models : [FALLBACK_MODEL];
  } catch {
    return [FALLBACK_MODEL];
  }
};

const resolveHome = (
  spec: SeedSpec,
  homes: IdeaPackageHome[],
): IdeaPackageHome | null => {
  if (spec.targetKind !== 'existing-package' || homes.length === 0) {
    return null;
  }
  const hint = spec.packageHint?.trim().toLowerCase();
  if (hint) {
    const match = homes.find((home) => home.packageId.trim().toLowerCase() === hint)
      ?? homes.find((home) => home.displayName.trim().toLowerCase() === hint);
    if (match) return match;
  }
  return homes[0] ?? null;
};

export async function seedProductIdeasSampleBoard(): Promise<{ count: number; wiped: boolean }> {
  await ensureProductIdeaTable();
  const actorIds = await loadActorIds();
  if (actorIds.length === 0) {
    throw new Error('No users in base_users. Sign in once, then seed Idea Foundry.');
  }
  const people = await loadIdeaTeamPeopleByIds(actorIds);
  const decisionMaker = people.get(actorIds[0]);
  if (!decisionMaker) {
    throw new Error('Could not load the first user as decision maker.');
  }
  const collaborators: IdeaTeamPerson[] = actorIds.slice(1)
    .map((id) => people.get(id))
    .filter((person): person is IdeaTeamPerson => Boolean(person));
  const models = loadSeedModels();
  const homes = listIdeaPackageHomes();

  const rows = SEED_SPECS.map((spec, index) => {
    const home = resolveHome(spec, homes);
    const existing = Boolean(home);
    const teamModels = models.slice(0, (index % models.length) + 1);
    const teamCollaborators = index % 2 === 0 ? collaborators : collaborators.slice(0, 1);
    return {
      title: spec.title,
      description: spec.description,
      icon: existing ? (home?.icon ?? spec.icon) : spec.icon,
      importance: spec.importance,
      scale: spec.scale,
      maturity: spec.maturity,
      targetKind: existing ? 'existing-package' as const : 'new-package' as const,
      packageId: existing ? home?.packageId ?? null : null,
      packageTitle: existing ? home?.displayName ?? null : null,
      sectionKey: existing ? IDEA_WHOLE_PACKAGE_SECTION_KEY : null,
      sectionTitle: existing ? 'Whole package' : null,
      frontOffice: spec.frontOffice,
      backOffice: spec.backOffice,
      note: null,
      decisionMaker,
      collaborators: teamCollaborators,
      models: teamModels,
      actorUserId: decisionMaker.userId,
    };
  });

  const count = await replaceAllProductIdeas(rows);
  return { count, wiped: true };
}
