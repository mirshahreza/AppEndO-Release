import type { AuthRequestContext } from '../../middleware/auth.middleware';
import { getPlatformFeedbackConfig, savePlatformFeedbackConfig } from '../../db/feedbackSettingsStore';
import { getPrismaControlPlane } from '../../db/prismaControlPlane';
import type {
  AssignFeedbackRequest,
  FeedbackAnonymousContact,
  FeedbackBootPolicy,
  FeedbackInboxBucket,
  FeedbackMessageDto,
  FeedbackMetadata,
  FeedbackMineListQuery,
  FeedbackTicketDetailDto,
  FeedbackTicketDto,
  PlatformFeedbackConfig,
  PostFeedbackMessageRequest,
  SubmitFeedbackRequest,
  UpdateFeedbackStatusRequest,
} from '../../../shared/api/contracts/feedback/types';
import { FEEDBACK_STATUSES } from '../../../shared/api/contracts/feedback/constants';
import { invalidatePersonalInboxProjection } from '../personal-inbox/personalInboxProjectionInvalidate';
import { patchPersonalInboxProjectionAttention } from '../personal-inbox/personalInboxProjectionSync';
import { applyRoutingTarget, resolveFeedbackRouting } from './feedbackRouting.service';
import {
  assertFeedbackSubjectCode,
  buildFeedbackLabelMap,
  listFeedbackSubjectOptions,
} from './feedbackBaseInfo.service';
import {
  FeedbackAttachmentError,
  linkAttachmentsToMessage,
  mapAttachmentRows,
  stageFeedbackAttachments,
} from './feedbackAttachment.service';
import {
  notifyFeedbackMessagePosted,
  notifyNewFeedbackTicket,
  runFeedbackNotification,
} from './feedbackNotification.service';

export class FeedbackServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'FeedbackServiceError';
  }
}

const CLOSED_STATUSES = new Set(['RESOLVED', 'WONT_FIX', 'DUPLICATE']);

const MINE_LIST_MAX_PAGE_SIZE = 100;

const buildMineListWhere = (
  auth: AuthRequestContext,
  query: FeedbackMineListQuery,
  matchingSubjectIds: string[] = [],
): Record<string, unknown> => {
  const where: Record<string, unknown> = {
    submitterUserId: BigInt(auth.userId),
  };

  if (query.status && FEEDBACK_STATUSES.includes(query.status)) {
    where.status = query.status;
  }

  if (query.subjectId?.trim()) {
    where.type = query.subjectId.trim();
  }

  const search = query.search?.trim();
  if (search) {
    const or: Record<string, unknown>[] = [
      { title: { contains: search } },
      { type: { contains: search } },
    ];
    const upper = search.toUpperCase();
    if (FEEDBACK_STATUSES.includes(upper as (typeof FEEDBACK_STATUSES)[number])) {
      or.push({ status: upper });
    }
    if (matchingSubjectIds.length > 0) {
      or.push({ type: { in: matchingSubjectIds } });
    }
    where.AND = [{ OR: or }];
  }

  return where;
};

const mineListInclude = (userId: number) => ({
  submitterUser: { select: { username: true } },
  assigneeUser: { select: { username: true } },
  messages: {
    where: { kind: { not: 'INTERNAL' } },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { body: true, kind: true },
  },
  readCursors: {
    where: { userId: BigInt(userId) },
    take: 1,
  },
});

const resolveLastMessagePreview = (
  messages?: Array<{ body: string; kind?: string }>,
): string | null => {
  if (!messages?.length) return null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.kind === 'INTERNAL') continue;
    const body = message.body?.trim();
    if (body) return body;
  }
  return null;
};

const prisma = () => getPrismaControlPlane();

const isPrismaFkViolation = (error: unknown): boolean => (
  Boolean(error)
  && typeof error === 'object'
  && 'code' in error
  && (error as { code?: string }).code === 'P2003'
);

const assertUserExists = async (
  userId: number,
  error: { code: string; status: number; message: string },
): Promise<void> => {
  const user = await prisma().baseUser.findUnique({
    where: { id: BigInt(userId) },
    select: { id: true },
  });
  if (!user) {
    throw new FeedbackServiceError(error.code, error.status, error.message);
  }
};

const toIso = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

const parseJson = <T>(raw: string | null | undefined): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const isAdmin = (auth: AuthRequestContext | undefined): boolean =>
  Boolean(auth?.roles?.includes('ADMIN') || auth?.role === 'ADMIN');

const userRoles = (auth: AuthRequestContext | undefined): string[] =>
  auth?.roles?.length ? auth.roles : auth?.role ? [auth.role] : [];

export class FeedbackService {
  constructor(private readonly settingsPath: string) {}

  getConfig(): PlatformFeedbackConfig {
    return getPlatformFeedbackConfig(this.settingsPath);
  }

  saveConfig(config: PlatformFeedbackConfig, actorId: number | null): PlatformFeedbackConfig {
    return savePlatformFeedbackConfig(this.settingsPath, config);
  }

  async getBootPolicy(): Promise<FeedbackBootPolicy> {
    const config = this.getConfig();
    const { policy } = config;
    const subjects = await listFeedbackSubjectOptions();
    return {
      enabled: policy.enabled,
      allowAuthenticated: policy.allowAuthenticated,
      allowAnonymous: policy.allowAnonymous,
      showContactFieldsForAnonymous: policy.showContactFieldsForAnonymous,
      requireSubject: policy.requireSubject,
      allowAttachments: policy.allowAttachments,
      widgetPlacement: policy.widgetPlacement,
      showOnDashboard: policy.showOnDashboard,
      pageKeyDenylist: policy.pageKeyDenylist,
      subjects,
    };
  }

  async listSubjects() {
    return listFeedbackSubjectOptions();
  }

  async submitFeedback(
    input: SubmitFeedbackRequest,
    auth: AuthRequestContext | undefined,
    stagedSessionKey: string,
    clientIp?: string,
  ): Promise<{ ticket: FeedbackTicketDetailDto }> {
    const config = this.getConfig();
    const { policy } = config;

    if (!policy.enabled) {
      throw new FeedbackServiceError('FEEDBACK_DISABLED', 403, 'Feedback is disabled.');
    }
    if (input.honeypot) {
      throw new FeedbackServiceError('FEEDBACK_REJECTED', 400, 'Submission rejected.');
    }

    const isAuthenticated = Boolean(auth?.userId);
    if (isAuthenticated && !policy.allowAuthenticated) {
      throw new FeedbackServiceError('FEEDBACK_FORBIDDEN', 403, 'Authenticated feedback is disabled.');
    }
    if (!isAuthenticated && !policy.allowAnonymous) {
      throw new FeedbackServiceError('FEEDBACK_FORBIDDEN', 403, 'Anonymous feedback is disabled.');
    }

    if (policy.requireSubject && !input.subjectId?.trim()) {
      throw new FeedbackServiceError('FEEDBACK_VALIDATION', 400, 'Subject is required.');
    }
    if (policy.requireTitle && !input.title?.trim()) {
      throw new FeedbackServiceError('FEEDBACK_VALIDATION', 400, 'Title is required.');
    }
    if (!input.body?.trim() && !(input.attachmentIds?.length)) {
      throw new FeedbackServiceError('FEEDBACK_VALIDATION', 400, 'Message or attachment is required.');
    }

    try {
      await assertFeedbackSubjectCode(input.subjectId);
    } catch (error) {
      throw new FeedbackServiceError(
        'FEEDBACK_VALIDATION',
        400,
        error instanceof Error ? error.message : 'Invalid feedback subject.',
      );
    }

    const routing = resolveFeedbackRouting(config, {
      subjectId: input.subjectId,
      portalSlug: input.portalSlug ?? null,
    });
    const assignment = applyRoutingTarget(routing.target);

    if (isAuthenticated) {
      await assertUserExists(auth!.userId, {
        code: 'FEEDBACK_SESSION_INVALID',
        status: 401,
        message: 'Your session is no longer valid. Please sign in again.',
      });
    }
    if (assignment.assigneeUserId != null) {
      await assertUserExists(assignment.assigneeUserId, {
        code: 'FEEDBACK_ROUTING_INVALID',
        status: 400,
        message: 'Feedback routing is misconfigured. Please contact an administrator.',
      });
    }

    const metadata: FeedbackMetadata = {
      ...(input.metadata ?? {}),
      clientIpHash: clientIp ? Buffer.from(clientIp).toString('base64url').slice(0, 32) : undefined,
    };

    let ticket;
    try {
      ticket = await prisma().baseAppFeedback.create({
        data: {
          type: input.subjectId,
          title: input.title.trim(),
          submitterUserId: isAuthenticated ? BigInt(auth!.userId) : null,
          anonymousContactJson: !isAuthenticated && input.anonymousContact
            ? JSON.stringify(input.anonymousContact)
            : null,
          assigneeUserId: assignment.assigneeUserId ? BigInt(assignment.assigneeUserId) : null,
          assigneeRoleName: assignment.assigneeRoleName,
          routingRuleId: routing.routingRuleId,
          routedAt: new Date(),
          portalSlug: input.portalSlug ?? null,
          pageKey: input.pageKey ?? null,
          route: input.route ?? null,
          metadataJson: policy.captureContext ? JSON.stringify(metadata) : null,
          messageCount: 1,
          lastMessageAt: new Date(),
        },
      });
    } catch (error) {
      if (isPrismaFkViolation(error)) {
        throw new FeedbackServiceError(
          'FEEDBACK_REFERENCE_INVALID',
          400,
          'Feedback could not be saved. Please sign in again or contact support.',
        );
      }
      throw error;
    }

    const message = await prisma().baseAppFeedbackMessage.create({
      data: {
        feedbackId: ticket.id,
        kind: 'SUBMITTER',
        body: input.body.trim(),
        authorUserId: isAuthenticated ? BigInt(auth!.userId) : null,
      },
    });

    if (input.attachmentIds?.length) {
      await linkAttachmentsToMessage({
        attachmentIds: input.attachmentIds,
        feedbackId: ticket.id,
        messageId: message.id,
        stagedSessionKey,
        uploaderUserId: auth?.userId ?? null,
      });
    }

    runFeedbackNotification(
      () => notifyNewFeedbackTicket({
        config,
        routing,
        ticketId: Number(ticket.id),
        title: input.title.trim(),
        submitterUserId: isAuthenticated ? auth!.userId : null,
        assigneeUserId: assignment.assigneeUserId,
        assigneeRoleName: assignment.assigneeRoleName,
      }),
      'notifyNewFeedbackTicket',
    );

    return {
      ticket: await this.getTicketDetail(Number(ticket.id), auth, {
        skipViewAuth: !isAuthenticated,
      }),
    };
  }

  async stageAttachments(
    files: Array<{ fileName: string; mimeType: string; buffer: Buffer }>,
    auth: AuthRequestContext | undefined,
    stagedSessionKey: string,
  ) {
    const policy = this.getConfig().policy;
    if (!policy.enabled) {
      throw new FeedbackServiceError('FEEDBACK_DISABLED', 403, 'Feedback is disabled.');
    }
    try {
      return await stageFeedbackAttachments(files.map((file) => ({
        ...file,
        uploadedByUserId: auth?.userId ?? null,
        stagedSessionKey,
        policy,
      })));
    } catch (error) {
      if (error instanceof FeedbackAttachmentError) {
        throw new FeedbackServiceError(error.code, 400, error.message);
      }
      throw error;
    }
  }

  async listMine(
    auth: AuthRequestContext,
    query: FeedbackMineListQuery | number = {},
  ): Promise<{ items: FeedbackTicketDto[]; total: number; page: number; pageSize: number }> {
    const normalizedQuery: FeedbackMineListQuery = typeof query === 'number'
      ? { page: 1, pageSize: query }
      : query;
    const pageSize = Math.min(
      Math.max(normalizedQuery.pageSize ?? 20, 1),
      MINE_LIST_MAX_PAGE_SIZE,
    );
    const page = Math.max(normalizedQuery.page ?? 1, 1);
    const skip = (page - 1) * pageSize;
    const search = normalizedQuery.search?.trim().toLowerCase() ?? '';
    const subjects = search ? await listFeedbackSubjectOptions() : [];
    const matchingSubjectIds = subjects
      .filter((subject) => subject.label.toLowerCase().includes(search))
      .map((subject) => subject.id);
    const where = buildMineListWhere(auth, normalizedQuery, matchingSubjectIds);

    const [rows, total] = await Promise.all([
      prisma().baseAppFeedback.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        take: pageSize,
        skip,
        include: mineListInclude(auth.userId),
      }),
      prisma().baseAppFeedback.count({ where }),
    ]);

    const labelMap = await buildFeedbackLabelMap(rows.map((row) => row.type));
    const items = await Promise.all(rows.map((row) => this.mapTicketRow(row, auth, labelMap)));
    return { items, total, page, pageSize };
  }

  async listAdmin(
    auth: AuthRequestContext,
    bucket: FeedbackInboxBucket,
    limit = 50,
  ): Promise<{ items: FeedbackTicketDto[]; total: number }> {
    const roles = userRoles(auth);
    const admin = isAdmin(auth);
    let where: Record<string, unknown> = {};

    if (bucket === 'ALL' && admin) {
      where = {};
    } else if (bucket === 'UNASSIGNED' && admin) {
      where = { assigneeUserId: null, assigneeRoleName: null };
    } else if (bucket === 'ASSIGNED_TO_ME') {
      where = { assigneeUserId: BigInt(auth.userId) };
    } else if (bucket === 'MY_ROLE_QUEUE') {
      where = {
        assigneeRoleName: { in: roles },
        OR: [{ assigneeUserId: null }, { assigneeUserId: BigInt(auth.userId) }],
      };
    } else if (admin) {
      where = {};
    } else {
      throw new FeedbackServiceError('FEEDBACK_FORBIDDEN', 403, 'Inbox bucket not allowed.');
    }

    const rows = await prisma().baseAppFeedback.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      include: {
        submitterUser: { select: { username: true } },
        assigneeUser: { select: { username: true } },
        readCursors: { where: { userId: BigInt(auth.userId) }, take: 1 },
      },
    });
    const total = await prisma().baseAppFeedback.count({ where });
    const labelMap = await buildFeedbackLabelMap(rows.map((row) => row.type));
    const items = await Promise.all(rows.map((row) => this.mapTicketRow(row, auth, labelMap)));
    return { items, total };
  }

  async getTicketDetail(
    ticketId: number,
    auth?: AuthRequestContext,
    options?: { skipViewAuth?: boolean },
  ): Promise<FeedbackTicketDetailDto> {
    const row = await prisma().baseAppFeedback.findUnique({
      where: { id: BigInt(ticketId) },
      include: {
        submitterUser: { select: { username: true } },
        assigneeUser: { select: { username: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            authorUser: { select: { username: true } },
            attachments: true,
          },
        },
        readCursors: auth ? { where: { userId: BigInt(auth.userId) } } : undefined,
      },
    });
    if (!row) {
      throw new FeedbackServiceError('FEEDBACK_NOT_FOUND', 404, 'Feedback not found.');
    }
    if (!options?.skipViewAuth) {
      this.assertCanView(row, auth);
    }

    const includeInternal = isAdmin(auth) || this.canRespond(row, auth);
    const messages: FeedbackMessageDto[] = row.messages
      .filter((message) => includeInternal || message.kind !== 'INTERNAL')
      .map((message) => ({
        id: String(message.id),
        kind: message.kind as FeedbackMessageDto['kind'],
        body: message.body,
        authorUserId: message.authorUserId ? Number(message.authorUserId) : null,
        authorDisplayName: message.authorUser?.username ?? (message.kind === 'SUBMITTER' ? 'Submitter' : 'Staff'),
        attachments: mapAttachmentRows(message.attachments),
        createdAt: message.createdAt.toISOString(),
      }));

    const labelMap = await buildFeedbackLabelMap([row.type]);
    const ticket = await this.mapTicketRow(row, auth, labelMap);
    return { ...ticket, messages };
  }

  async postMessage(
    ticketId: number,
    input: PostFeedbackMessageRequest,
    auth: AuthRequestContext,
    stagedSessionKey: string,
  ): Promise<FeedbackTicketDetailDto> {
    const row = await prisma().baseAppFeedback.findUnique({ where: { id: BigInt(ticketId) } });
    if (!row) throw new FeedbackServiceError('FEEDBACK_NOT_FOUND', 404, 'Feedback not found.');

    const config = this.getConfig().policy;
    const kind = input.kind ?? (this.isSubmitter(row, auth) ? 'SUBMITTER' : 'STAFF');

    if (kind === 'INTERNAL' && !isAdmin(auth)) {
      throw new FeedbackServiceError('FEEDBACK_FORBIDDEN', 403, 'Internal notes require admin.');
    }
    if (kind === 'SUBMITTER') {
      if (!this.isSubmitter(row, auth)) {
        throw new FeedbackServiceError('FEEDBACK_FORBIDDEN', 403, 'Only the submitter can reply.');
      }
      if (!config.allowSubmitterReplies || CLOSED_STATUSES.has(row.status)) {
        throw new FeedbackServiceError('FEEDBACK_CLOSED', 400, 'This feedback thread is closed.');
      }
    } else if (!this.canRespond(row, auth) && !isAdmin(auth)) {
      throw new FeedbackServiceError('FEEDBACK_FORBIDDEN', 403, 'You cannot reply to this feedback.');
    }

    if (!input.body?.trim() && !(input.attachmentIds?.length)) {
      throw new FeedbackServiceError('FEEDBACK_VALIDATION', 400, 'Message or attachment is required.');
    }

    const message = await prisma().baseAppFeedbackMessage.create({
      data: {
        feedbackId: row.id,
        kind,
        body: input.body.trim(),
        authorUserId: BigInt(auth.userId),
      },
    });

    if (input.attachmentIds?.length) {
      await linkAttachmentsToMessage({
        attachmentIds: input.attachmentIds,
        feedbackId: row.id,
        messageId: message.id,
        stagedSessionKey,
        uploaderUserId: auth.userId,
      });
    }

    await prisma().baseAppFeedback.update({
      where: { id: row.id },
      data: {
        messageCount: { increment: 1 },
        lastMessageAt: new Date(),
        status: row.status === 'NEW' && kind === 'STAFF' ? 'IN_PROGRESS' : row.status,
      },
    });

    runFeedbackNotification(
      () => notifyFeedbackMessagePosted({
        ticketId,
        ticketTitle: row.title,
        kind,
        messageBody: input.body.trim(),
        authorUserId: auth.userId,
        submitterUserId: row.submitterUserId ? Number(row.submitterUserId) : null,
        assigneeUserId: row.assigneeUserId ? Number(row.assigneeUserId) : null,
        assigneeRoleName: row.assigneeRoleName,
      }),
      'notifyFeedbackMessagePosted',
    );

    return this.getTicketDetail(ticketId, auth);
  }

  async claimTicket(ticketId: number, auth: AuthRequestContext): Promise<FeedbackTicketDetailDto> {
    const row = await prisma().baseAppFeedback.findUnique({ where: { id: BigInt(ticketId) } });
    if (!row) throw new FeedbackServiceError('FEEDBACK_NOT_FOUND', 404, 'Feedback not found.');
    if (!row.assigneeRoleName || !userRoles(auth).includes(row.assigneeRoleName)) {
      throw new FeedbackServiceError('FEEDBACK_FORBIDDEN', 403, 'You cannot claim this feedback.');
    }
    if (row.assigneeUserId && row.assigneeUserId !== BigInt(auth.userId)) {
      throw new FeedbackServiceError('FEEDBACK_ALREADY_CLAIMED', 409, 'Feedback is already claimed.');
    }
    await prisma().baseAppFeedback.update({
      where: { id: row.id },
      data: {
        assigneeUserId: BigInt(auth.userId),
        claimedByUserId: BigInt(auth.userId),
        claimedAt: new Date(),
        status: row.status === 'NEW' ? 'TRIAGED' : row.status,
      },
    });
    return this.getTicketDetail(ticketId, auth);
  }

  async assignTicket(
    ticketId: number,
    input: AssignFeedbackRequest,
    auth: AuthRequestContext,
  ): Promise<FeedbackTicketDetailDto> {
    if (!isAdmin(auth)) {
      throw new FeedbackServiceError('FEEDBACK_FORBIDDEN', 403, 'Only admins can reassign feedback.');
    }
    await prisma().baseAppFeedback.update({
      where: { id: BigInt(ticketId) },
      data: {
        assigneeUserId: input.assigneeUserId ? BigInt(input.assigneeUserId) : null,
        assigneeRoleName: input.assigneeRoleName ?? null,
        manuallyAssignedByUserId: BigInt(auth.userId),
        routingRuleId: null,
      },
    });
    return this.getTicketDetail(ticketId, auth);
  }

  async updateStatus(
    ticketId: number,
    input: UpdateFeedbackStatusRequest,
    auth: AuthRequestContext,
  ): Promise<FeedbackTicketDetailDto> {
    if (!isAdmin(auth) && !this.canRespond(await prisma().baseAppFeedback.findUnique({ where: { id: BigInt(ticketId) } }), auth)) {
      throw new FeedbackServiceError('FEEDBACK_FORBIDDEN', 403, 'Cannot update status.');
    }
    await prisma().baseAppFeedback.update({
      where: { id: BigInt(ticketId) },
      data: {
        status: input.status,
        priority: input.priority,
        resolvedAt: CLOSED_STATUSES.has(input.status) ? new Date() : null,
        resolvedByUserId: CLOSED_STATUSES.has(input.status) ? BigInt(auth.userId) : null,
      },
    });
    return this.getTicketDetail(ticketId, auth);
  }

  async markRead(ticketId: number, auth: AuthRequestContext): Promise<void> {
    const row = await prisma().baseAppFeedback.findUnique({
      where: { id: BigInt(ticketId) },
    });
    if (!row) throw new FeedbackServiceError('FEEDBACK_NOT_FOUND', 404, 'Feedback not found.');
    this.assertCanView(row, auth);
    const unreadKinds: Array<'STAFF' | 'SUBMITTER'> = this.isSubmitter(row, auth)
      ? ['STAFF']
      : ['STAFF', 'SUBMITTER'];
    const lastUnreadRelevant = await prisma().baseAppFeedbackMessage.findFirst({
      where: { feedbackId: row.id, kind: { in: unreadKinds } },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    const lastMessageId = lastUnreadRelevant?.id ?? null;
    await prisma().baseAppFeedbackReadCursor.upsert({
      where: {
        feedbackId_userId: {
          feedbackId: row.id,
          userId: BigInt(auth.userId),
        },
      },
      create: {
        feedbackId: row.id,
        userId: BigInt(auth.userId),
        lastReadMessageId: lastMessageId,
      },
      update: {
        lastReadMessageId: lastMessageId,
        updatedAt: new Date(),
      },
    });
    await patchPersonalInboxProjectionAttention(auth.userId, `feedback:${ticketId}`, 'none');
    invalidatePersonalInboxProjection(auth.userId);
  }

  async markUnread(ticketId: number, auth: AuthRequestContext): Promise<void> {
    const row = await prisma().baseAppFeedback.findUnique({
      where: { id: BigInt(ticketId) },
    });
    if (!row) throw new FeedbackServiceError('FEEDBACK_NOT_FOUND', 404, 'Feedback not found.');
    this.assertCanView(row, auth);
    await prisma().baseAppFeedbackReadCursor.deleteMany({
      where: {
        feedbackId: row.id,
        userId: BigInt(auth.userId),
      },
    });
    await patchPersonalInboxProjectionAttention(auth.userId, `feedback:${ticketId}`, 'unread');
    invalidatePersonalInboxProjection(auth.userId);
  }

  private isSubmitter(
    row: { submitterUserId: bigint | null },
    auth?: AuthRequestContext,
  ): boolean {
    return Boolean(auth?.userId && row.submitterUserId === BigInt(auth.userId));
  }

  private canRespond(
    row: { assigneeUserId: bigint | null; assigneeRoleName: string | null } | null,
    auth?: AuthRequestContext,
  ): boolean {
    if (!row || !auth) return false;
    if (row.assigneeUserId && row.assigneeUserId === BigInt(auth.userId)) return true;
    if (row.assigneeRoleName && userRoles(auth).includes(row.assigneeRoleName)) return true;
    return false;
  }

  private assertCanView(
    row: {
      submitterUserId: bigint | null;
      assigneeUserId: bigint | null;
      assigneeRoleName: string | null;
    },
    auth?: AuthRequestContext,
  ) {
    if (!auth) throw new FeedbackServiceError('FEEDBACK_UNAUTHORIZED', 401, 'Authentication required.');
    if (isAdmin(auth)) return;
    if (this.isSubmitter(row, auth)) return;
    if (this.canRespond(row, auth)) return;
    throw new FeedbackServiceError('FEEDBACK_FORBIDDEN', 403, 'Access denied.');
  }

  private async mapTicketRow(
    row: {
      id: bigint;
      type: string;
      status: string;
      priority: string;
      title: string;
      submittedAt: Date;
      submitterUserId: bigint | null;
      anonymousContactJson: string | null;
      assigneeUserId: bigint | null;
      assigneeRoleName: string | null;
      routingRuleId: string | null;
      routedAt: Date | null;
      portalSlug: string | null;
      pageKey: string | null;
      route: string | null;
      metadataJson: string | null;
      messageCount: number;
      lastMessageAt: Date | null;
      createdAt: Date | null;
      updatedAt: Date | null;
      submitterUser?: { username: string } | null;
      assigneeUser?: { username: string } | null;
      readCursors?: Array<{ lastReadMessageId: bigint | null }>;
      messages?: Array<{ body: string; kind?: string }>;
    },
    auth: AuthRequestContext | undefined,
    labelMap: Map<string, string>,
  ): Promise<FeedbackTicketDto> {
    const unreadCount = auth
      ? await this.countUnread(row, auth, row.readCursors?.[0]?.lastReadMessageId ?? null)
      : 0;

    const anonymousContact = parseJson<FeedbackAnonymousContact>(row.anonymousContactJson);
    const submitterDisplayName = row.submitterUser?.username
      ?? anonymousContact?.name
      ?? (anonymousContact?.email || anonymousContact?.phone ? 'Anonymous' : 'Anonymous');

    return {
      id: String(row.id),
      subjectId: row.type,
      subjectLabel: labelMap.get(row.type) ?? null,
      status: row.status as FeedbackTicketDto['status'],
      priority: row.priority as FeedbackTicketDto['priority'],
      title: row.title,
      submittedAt: row.submittedAt.toISOString(),
      submitterUserId: row.submitterUserId ? Number(row.submitterUserId) : null,
      submitterDisplayName,
      anonymousContact,
      assigneeUserId: row.assigneeUserId ? Number(row.assigneeUserId) : null,
      assigneeDisplayName: row.assigneeUser?.username ?? null,
      assigneeRoleName: row.assigneeRoleName,
      routingRuleId: row.routingRuleId,
      routedAt: toIso(row.routedAt),
      portalSlug: row.portalSlug,
      pageKey: row.pageKey,
      route: row.route,
      metadata: parseJson<FeedbackMetadata>(row.metadataJson),
      messageCount: row.messageCount,
      lastMessageAt: toIso(row.lastMessageAt),
      lastMessagePreview: resolveLastMessagePreview(row.messages),
      unreadCount,
      createdAt: (row.createdAt ?? row.submittedAt).toISOString(),
      updatedAt: (row.updatedAt ?? row.submittedAt).toISOString(),
    };
  }

  private async countUnread(
    row: { id: bigint; submitterUserId: bigint | null },
    auth: AuthRequestContext,
    lastReadMessageId: bigint | null,
  ): Promise<number> {
    const kinds: Array<'STAFF' | 'SUBMITTER'> = this.isSubmitter(row, auth)
      ? ['STAFF']
      : ['STAFF', 'SUBMITTER'];
    return prisma().baseAppFeedbackMessage.count({
      where: {
        feedbackId: row.id,
        kind: { in: kinds },
        ...(lastReadMessageId ? { id: { gt: lastReadMessageId } } : {}),
      },
    });
  }
}
