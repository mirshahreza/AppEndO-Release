/**
 * CRM Phase 2 — Edge domain-action managed function source builders.
 * v2: customer = base_users + base_user_profiles + `crm_customers` extension.
 *
 * Each `code` string runs in the edge-domain-action VM with globals:
 * `req`, `res`, `resolvePublishedEdgeModel`, `Op`, `QueryTypes`.
 * Must define `async function handler(): Promise<void>`.
 *
 * Concurrency contract (plan §فاز ۲ سناریوهای پذیرش):
 * - `customers-merge` locks both `crm_customers` rows (`FOR UPDATE`, ordered by userId to
 *   avoid deadlock) before moving any FK, and every customer-scoped "create child record"
 *   action (`tickets-create`) locks the same customer row first — whichever transaction
 *   wins the row lock establishes a clean happens-before order, so a ticket created
 *   concurrently with a merge is never orphaned.
 * - `opportunities-change-stage` locks the opportunity row (`FOR UPDATE`) and reads
 *   `stageCode` from the LOCKED row (never from a pre-transaction variable or the client
 *   payload), so two concurrent change-stage calls on the same opportunity cannot produce
 *   a lost update or an inconsistent history row.
 */

export type CrmDomainIds = {
  customersModelId: string;
  customerTagsModelId: string;
  usersModelId: string;
  profilesModelId: string;
  baseInfoModelId: string;
  opportunitiesModelId: string;
  stageHistoryModelId: string;
  activitiesModelId: string;
  ticketsModelId: string;
  messagesModelId: string;
  // Base Info category id (for enumerating Pipeline Stages in view-order for the Kanban board)
  pipelineStagesCategoryId: string;
  // Base Info item ids (base_info.id strings)
  lifecycleLeadId: string;
  lifecycleLostId: string;
  pipelineNewId: string;
  pipelineWonId: string;
  pipelineLostId: string;
  ticketStatusNewId: string;
  ticketStatusOpenId: string;
  ticketStatusResolvedId: string;
  ticketStatusClosedId: string;
};

export type CrmDomainAction = {
  name: string;
  method: string;
  path: string;
  code: string;
};

const q = (value: string): string => JSON.stringify(value);

/**
 * List is a domain action, not DATA_API, because search needs to reach joined
 * `base_users`/`base_user_profiles` columns (name/email/phone) — DATA_API's generic
 * search only matches the model's OWN columns, and `crm_customers` itself carries none
 * of those (identity lives on the profile). Plan §صفحهٔ لیست Customers requires exactly
 * this cross-table search.
 */
const customersList = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const query = (req.query || {}) as Record<string, unknown>;
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(query.pageSize ?? '50'), 10) || 50));
  const offset = (page - 1) * pageSize;

  const { Model: Customers, sequelize } = await resolvePublishedEdgeModel(${q(ids.customersModelId)});

  const where: Record<string, unknown> = {};
  if (typeof query.lifecycleStageCode === 'string' && query.lifecycleStageCode) where.lifecycleStageCode = query.lifecycleStageCode;
  if (typeof query.sourceCode === 'string' && query.sourceCode) where.sourceCode = query.sourceCode;
  if (query.mine === 'true' || query.mine === '1') {
    where.ownerId = req.auth?.userId ?? -1;
  } else if (typeof query.ownerId === 'string' && query.ownerId) {
    where.ownerId = query.ownerId;
  }

  if (typeof query.tagCode === 'string' && query.tagCode) {
    const { Model: CustomerTags } = await resolvePublishedEdgeModel(${q(ids.customerTagsModelId)});
    const tagRows = await CustomerTags.findAll({ where: { tagCode: query.tagCode }, attributes: ['userId'] });
    const taggedUserIds = tagRows.map((row: any) => row.get('userId'));
    where.userId = { [Op.in]: taggedUserIds.length > 0 ? taggedUserIds : [-1] };
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const searchWhere = search
    ? {
      [Op.or]: [
        { '$user.username$': { [Op.iLike]: \`%\${search}%\` } },
        { '$user.email$': { [Op.iLike]: \`%\${search}%\` } },
        { '$user.mobile$': { [Op.iLike]: \`%\${search}%\` } },
        { '$profile.firstname$': { [Op.iLike]: \`%\${search}%\` } },
        { '$profile.lastname$': { [Op.iLike]: \`%\${search}%\` } },
        { '$profile.nickname$': { [Op.iLike]: \`%\${search}%\` } },
        { '$profile.company_name$': { [Op.iLike]: \`%\${search}%\` } },
      ],
    }
    : {};

  const sortableFields: Record<string, string> = { updatedAt: 'updatedAt', createdAt: 'createdAt' };
  const sortByRaw = typeof query.sortBy === 'string' ? query.sortBy : 'updatedAt';
  const sortBy = sortableFields[sortByRaw] || 'updatedAt';
  const sortDir = String(query.sortDir ?? '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const result = await Customers.findAndCountAll({
    where: { ...where, ...searchWhere },
    include: [
      { association: 'user' },
      { association: 'profile' },
      { association: 'lifecycle_stage' },
      { association: 'source' },
      { association: 'owner' },
    ],
    limit: pageSize,
    offset,
    order: [[sortBy, sortDir]],
    subQuery: false,
    distinct: true,
  });

  const rows = result.rows.map((row: any) => {
    const plain = row.get({ plain: true });
    const displayName = (plain.profile?.nickname && String(plain.profile.nickname).trim())
      || [plain.profile?.firstname, plain.profile?.lastname].filter(Boolean).join(' ').trim()
      || (plain.profile?.companyName && String(plain.profile.companyName).trim())
      || plain.user?.username
      || \`User #\${plain.userId}\`;
    return {
      id: plain.id,
      userId: plain.userId,
      displayName,
      username: plain.user?.username ?? null,
      email: plain.user?.email ?? null,
      mobile: plain.user?.mobile ?? null,
      firstname: plain.profile?.firstname ?? null,
      lastname: plain.profile?.lastname ?? null,
      nickname: plain.profile?.nickname ?? null,
      companyName: plain.profile?.companyName ?? null,
      personTypeCode: plain.profile?.personTypeCode ?? null,
      lifecycleStageCode: plain.lifecycleStageCode,
      lifecycleStageCodeTitle: plain.lifecycle_stage?.title ?? null,
      lifecycleStageCodeUiColor: plain.lifecycle_stage?.ui_color ?? null,
      sourceCode: plain.sourceCode,
      sourceCodeTitle: plain.source?.title ?? null,
      ownerId: plain.ownerId,
      ownerUsername: plain.owner?.username ?? null,
      note: plain.note,
      updatedAt: plain.updatedAt,
    };
  });

  res.json({ success: true, data: rows, count: result.count });
}
`.trim();

const customersCreate = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const body = (req.body || {}) as Record<string, unknown>;
  const userId = body.userId;
  if (userId == null || userId === '') {
    res.status(400).json({ success: false, error: 'userId is required (create the platform user first via POST /api/users)' });
    return;
  }
  const { Model: Users } = await resolvePublishedEdgeModel(${q(ids.usersModelId)});
  const user = await Users.findByPk(userId);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  const { Model: Customers } = await resolvePublishedEdgeModel(${q(ids.customersModelId)});
  const existing = await Customers.findOne({ where: { userId } });
  if (existing) {
    res.status(409).json({ success: false, error: 'This user already has a CRM customer extension' });
    return;
  }
  const actorId = req.auth?.userId ?? null;
  const now = new Date();
  const row = await Customers.create({
    userId,
    lifecycleStageCode: body.lifecycleStageCode || ${q(ids.lifecycleLeadId)},
    sourceCode: body.sourceCode ?? null,
    ownerId: body.ownerId ?? null,
    note: body.note ?? null,
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: now,
    updatedAt: now,
  });
  res.status(201).json({ success: true, data: row.get({ plain: true }) });
}
`.trim();

const customersGet = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const userId = req.params.userId;
  const { Model: Customers } = await resolvePublishedEdgeModel(${q(ids.customersModelId)});
  const row = await Customers.findOne({
    where: { userId },
    include: [
      { association: 'user' },
      { association: 'profile' },
      { association: 'lifecycle_stage' },
      { association: 'source' },
      { association: 'owner' },
      { association: 'createdByUser' },
      { association: 'updatedByUser' },
      { association: 'tags', include: [{ association: 'tag' }] },
    ],
  });
  if (!row) {
    res.status(404).json({ success: false, error: 'Customer not found' });
    return;
  }
  const plain = row.get({ plain: true }) as any;
  const displayName = (plain.profile?.nickname && String(plain.profile.nickname).trim())
    || [plain.profile?.firstname, plain.profile?.lastname].filter(Boolean).join(' ').trim()
    || (plain.profile?.companyName && String(plain.profile.companyName).trim())
    || plain.user?.username
    || \`User #\${plain.userId}\`;
  // Flat shape, matching customersList's convention exactly — the Designer editor's
  // regionColumn bindings resolve single flat property names, not nested/dotted paths (a
  // dotted string like 'profile.firstname' compiles to a literal bracket-key lookup, never
  // populated by a real nested object). Found via a user screenshot report: every Profile/
  // Identity/Audit field in the editor rendered blank because this endpoint returned the raw,
  // unflattened Sequelize include tree instead. See crmCustomersScaffold.ts's
  // CUSTOMERS_DETAIL_DATA_SOURCE.fields comment for the client-side half of this fix.
  res.json({
    success: true,
    data: {
      id: plain.id,
      userId: plain.userId,
      displayName,
      username: plain.user?.username ?? null,
      email: plain.user?.email ?? null,
      mobile: plain.user?.mobile ?? null,
      firstname: plain.profile?.firstname ?? null,
      lastname: plain.profile?.lastname ?? null,
      nickname: plain.profile?.nickname ?? null,
      companyName: plain.profile?.companyName ?? null,
      registrationNumber: plain.profile?.registrationNumber ?? null,
      website: plain.profile?.website ?? null,
      personTypeCode: plain.profile?.personTypeCode ?? null,
      lifecycleStageCode: plain.lifecycleStageCode,
      lifecycleStageCodeTitle: plain.lifecycle_stage?.title ?? null,
      lifecycleStageCodeUiColor: plain.lifecycle_stage?.ui_color ?? null,
      sourceCode: plain.sourceCode,
      sourceCodeTitle: plain.source?.title ?? null,
      ownerId: plain.ownerId,
      ownerUsername: plain.owner?.username ?? null,
      note: plain.note,
      createdAt: plain.createdAt,
      createdBy: plain.createdBy,
      createdByUsername: plain.createdByUser?.username ?? null,
      updatedAt: plain.updatedAt,
      updatedBy: plain.updatedBy,
      updatedByUsername: plain.updatedByUser?.username ?? null,
      tagCodes: Array.isArray(plain.tags) ? plain.tags.map((t: any) => t.tagCode) : [],
    },
  });
}
`.trim();

const CUSTOMER_PROFILE_PATCH_FIELDS = [
  'firstname', 'lastname', 'fathername', 'grandfathername', 'nationalCode',
  'birthYear', 'birthMonth', 'birthDay', 'genderCode',
  'companyName', 'registrationNumber', 'website', 'organizationUserId',
  'phone', 'nickname',
];

const customersPatch = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const userId = req.params.userId;
  const body = (req.body || {}) as Record<string, unknown>;
  if (body.personTypeCode !== undefined) {
    res.status(400).json({ success: false, error: 'person_type_code is locked after create' });
    return;
  }
  const { Model: Customers, sequelize } = await resolvePublishedEdgeModel(${q(ids.customersModelId)});
  const row = await Customers.findOne({ where: { userId } });
  if (!row) {
    res.status(404).json({ success: false, error: 'Customer not found' });
    return;
  }
  const actorId = req.auth?.userId ?? null;
  const now = new Date();
  const extensionPatch: Record<string, unknown> = {};
  for (const key of ['lifecycleStageCode', 'sourceCode', 'ownerId', 'note']) {
    if (body[key] !== undefined) extensionPatch[key] = body[key];
  }
  const profileFields = ${JSON.stringify(CUSTOMER_PROFILE_PATCH_FIELDS)};
  const profilePatch: Record<string, unknown> = {};
  for (const key of profileFields) {
    if (body[key] !== undefined) profilePatch[key] = body[key];
  }
  await sequelize.transaction(async (t: any) => {
    if (Object.keys(extensionPatch).length > 0) {
      extensionPatch.updatedBy = actorId;
      extensionPatch.updatedAt = now;
      await row.update(extensionPatch, { transaction: t });
    }
    if (Object.keys(profilePatch).length > 0) {
      const { Model: Profiles } = await resolvePublishedEdgeModel(${q(ids.profilesModelId)});
      profilePatch.updatedBy = actorId;
      profilePatch.updatedAt = now;
      await Profiles.update(profilePatch, { where: { userId }, transaction: t });
    }
  });
  res.json({ success: true, data: row.get({ plain: true }) });
}
`.trim();

const customersRelatedCounts = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const userId = req.params.userId;
  const { Model: Customers } = await resolvePublishedEdgeModel(${q(ids.customersModelId)});
  const customer = await Customers.findOne({ where: { userId } });
  if (!customer) {
    res.status(404).json({ success: false, error: 'Customer not found' });
    return;
  }
  const { Model: Opportunities } = await resolvePublishedEdgeModel(${q(ids.opportunitiesModelId)});
  const { Model: Activities } = await resolvePublishedEdgeModel(${q(ids.activitiesModelId)});
  const { Model: Tickets } = await resolvePublishedEdgeModel(${q(ids.ticketsModelId)});
  const { Model: Profiles } = await resolvePublishedEdgeModel(${q(ids.profilesModelId)});
  const [opportunities, activities, tickets, individuals] = await Promise.all([
    Opportunities.count({ where: { customerUserId: userId } }),
    Activities.count({ where: { customerUserId: userId } }),
    Tickets.count({ where: { customerUserId: userId } }),
    Profiles.count({ where: { organizationUserId: userId } }),
  ]);
  res.json({ success: true, data: { opportunities, activities, tickets, individuals } });
}
`.trim();

/** Lock both crm_customers rows in a fixed order (lower userId first) to avoid deadlock. */
const customersMerge = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const body = (req.body || {}) as Record<string, unknown>;
  const survivorUserId = body.survivorUserId;
  const loserUserId = body.loserUserId;
  if (survivorUserId == null || loserUserId == null || String(survivorUserId) === String(loserUserId)) {
    res.status(400).json({ success: false, error: 'survivorUserId and loserUserId are required and must differ' });
    return;
  }
  const { Model: Customers, sequelize } = await resolvePublishedEdgeModel(${q(ids.customersModelId)});
  const { Model: Opportunities } = await resolvePublishedEdgeModel(${q(ids.opportunitiesModelId)});
  const { Model: Activities } = await resolvePublishedEdgeModel(${q(ids.activitiesModelId)});
  const { Model: Tickets } = await resolvePublishedEdgeModel(${q(ids.ticketsModelId)});
  const { Model: CustomerTags } = await resolvePublishedEdgeModel(${q(ids.customerTagsModelId)});
  const lifecycleLostId = ${q(ids.lifecycleLostId)};
  const actorId = req.auth?.userId ?? null;
  const now = new Date();
  const [firstId, secondId] = [String(survivorUserId), String(loserUserId)].sort();

  let notFound = false;
  await sequelize.transaction(async (t: any) => {
    const first = await Customers.findOne({ where: { userId: firstId }, transaction: t, lock: t.LOCK.UPDATE });
    const second = await Customers.findOne({ where: { userId: secondId }, transaction: t, lock: t.LOCK.UPDATE });
    if (!first || !second) {
      notFound = true;
      return;
    }
    const loser = String(firstId) === String(loserUserId) ? first : second;

    await Opportunities.update({ customerUserId: survivorUserId }, { where: { customerUserId: loserUserId }, transaction: t });
    await Activities.update({ customerUserId: survivorUserId }, { where: { customerUserId: loserUserId }, transaction: t });
    await Tickets.update({ customerUserId: survivorUserId }, { where: { customerUserId: loserUserId }, transaction: t });

    const loserTags = await CustomerTags.findAll({ where: { userId: loserUserId }, transaction: t });
    for (const tagRow of loserTags) {
      const tagCode = tagRow.get('tagCode');
      const exists = await CustomerTags.findOne({ where: { userId: survivorUserId, tagCode }, transaction: t });
      if (!exists) {
        await CustomerTags.create({ userId: survivorUserId, tagCode }, { transaction: t });
      }
      await tagRow.destroy({ transaction: t });
    }

    await loser.update({ lifecycleStageCode: lifecycleLostId, updatedBy: actorId, updatedAt: now }, { transaction: t });
  });

  if (notFound) {
    res.status(404).json({ success: false, error: 'Customer not found' });
    return;
  }
  res.json({ success: true, data: { survivorUserId, loserUserId } });
}
`.trim();

const customersArchive = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const userId = req.params.userId;
  const { Model: Customers } = await resolvePublishedEdgeModel(${q(ids.customersModelId)});
  const row = await Customers.findOne({ where: { userId } });
  if (!row) {
    res.status(404).json({ success: false, error: 'Customer not found' });
    return;
  }
  await row.update({
    lifecycleStageCode: ${q(ids.lifecycleLostId)},
    updatedBy: req.auth?.userId ?? null,
    updatedAt: new Date(),
  });
  res.json({ success: true, data: row.get({ plain: true }) });
}
`.trim();

const customersTagsSync = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const userId = req.params.userId;
  const body = (req.body || {}) as Record<string, unknown>;
  const tagCodes = Array.isArray(body.tagCodes) ? body.tagCodes.map(String) : null;
  if (!tagCodes) {
    res.status(400).json({ success: false, error: 'tagCodes array is required' });
    return;
  }
  const { Model: Customers, sequelize } = await resolvePublishedEdgeModel(${q(ids.customersModelId)});
  const customer = await Customers.findOne({ where: { userId } });
  if (!customer) {
    res.status(404).json({ success: false, error: 'Customer not found' });
    return;
  }
  const { Model: CustomerTags } = await resolvePublishedEdgeModel(${q(ids.customerTagsModelId)});
  await sequelize.transaction(async (t: any) => {
    await CustomerTags.destroy({ where: { userId }, transaction: t });
    for (const tagCode of tagCodes) {
      await CustomerTags.create({ userId, tagCode }, { transaction: t });
    }
  });
  const rows = await CustomerTags.findAll({ where: { userId } });
  res.json({ success: true, data: rows.map((r: any) => r.get({ plain: true })) });
}
`.trim();

/** Lock the customer's crm_customers row before inserting a child record (merge race guard). */
const lockCustomerBeforeCreate = (ids: CrmDomainIds, customerUserIdExpr: string): string => `
  const { Model: Customers } = await resolvePublishedEdgeModel(${q(ids.customersModelId)});
  await Customers.findOne({ where: { userId: ${customerUserIdExpr} }, transaction: t, lock: t.LOCK.UPDATE });
`;

/**
 * Kanban board payload — columns pre-grouped by Pipeline Stage (view_order), cards carrying
 * the rich fields the plan's §کار پایه‌ای Base Components card needs (customer avatar · amount
 * badge · days-in-stage · close-date accent). A dedicated endpoint rather than relying on the
 * Designer's generic list→group transform, which was unproven for this shape.
 */
const opportunitiesBoard = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const query = (req.query || {}) as Record<string, unknown>;
  const { Model: BaseInfo } = await resolvePublishedEdgeModel(${q(ids.baseInfoModelId)});
  const { Model: Opportunities } = await resolvePublishedEdgeModel(${q(ids.opportunitiesModelId)});
  const { Model: StageHistory } = await resolvePublishedEdgeModel(${q(ids.stageHistoryModelId)});

  const stages = await BaseInfo.findAll({
    where: { parentId: ${q(ids.pipelineStagesCategoryId)}, isActive: true },
    order: [['viewOrder', 'ASC']],
  });

  const oppWhere: Record<string, unknown> = {};
  if (query.mine === 'true' || query.mine === '1') {
    oppWhere.ownerId = req.auth?.userId ?? -1;
  }

  const opportunities = await Opportunities.findAll({
    where: oppWhere,
    include: [
      { association: 'customer' },
      { association: 'customerProfile' },
    ],
    order: [['updatedAt', 'DESC']],
  });

  const oppIds = opportunities.map((row: any) => row.get('id'));
  const latestStageEnteredAt = new Map<string, Date>();
  if (oppIds.length > 0) {
    const historyRows = await StageHistory.findAll({
      where: { opportunityId: { [Op.in]: oppIds } },
      order: [['changedAt', 'DESC']],
    });
    for (const row of historyRows) {
      const plain = row.get({ plain: true }) as any;
      const key = String(plain.opportunityId);
      if (!latestStageEnteredAt.has(key)) {
        latestStageEnteredAt.set(key, new Date(plain.changedAt));
      }
    }
  }

  const now = Date.now();
  const wonId = ${q(ids.pipelineWonId)};
  const lostId = ${q(ids.pipelineLostId)};

  const cardsByStage = new Map<string, unknown[]>();
  for (const row of opportunities) {
    const plain = row.get({ plain: true }) as any;
    const stageCode = plain.stageCode == null ? '' : String(plain.stageCode);
    const customerName = (plain.customerProfile?.nickname && String(plain.customerProfile.nickname).trim())
      || [plain.customerProfile?.firstname, plain.customerProfile?.lastname].filter(Boolean).join(' ').trim()
      || (plain.customerProfile?.companyName && String(plain.customerProfile.companyName).trim())
      || plain.customer?.username
      || 'Unknown';

    const enteredAt = latestStageEnteredAt.get(String(plain.id));
    const daysInStage = enteredAt ? Math.max(0, Math.floor((now - enteredAt.getTime()) / 86400000)) : null;

    const badges: Array<{ label: string; tone?: string }> = [];
    if (daysInStage !== null) {
      badges.push({ label: daysInStage === 0 ? 'Today' : \`\${daysInStage}d in stage\`, tone: daysInStage >= 14 ? 'warning' : 'default' });
    }

    const isTerminal = stageCode === wonId || stageCode === lostId;
    const isOverdue = !isTerminal && plain.expectedCloseDate && new Date(plain.expectedCloseDate).getTime() < now;

    const metaParts: string[] = [];
    if (plain.amount != null) metaParts.push(\`$\${Number(plain.amount).toLocaleString()}\`);
    if (plain.expectedCloseDate) metaParts.push(\`Close \${plain.expectedCloseDate}\`);

    const card = {
      id: String(plain.id),
      title: plain.title,
      meta: metaParts.join(' · ') || undefined,
      avatar: { label: customerName },
      badges: badges.length > 0 ? badges : undefined,
      accent: isOverdue ? 'danger' : 'default',
    };

    const list = cardsByStage.get(stageCode) ?? [];
    list.push(card);
    cardsByStage.set(stageCode, list);
  }

  const columns = stages.map((stage: any) => {
    const stageId = String(stage.get('id'));
    return {
      id: stageId,
      title: stage.get('title'),
      cards: cardsByStage.get(stageId) ?? [],
    };
  });

  res.json({ success: true, data: { columns } });
}
`.trim();

const opportunitiesChangeStage = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const id = req.params.id;
  const body = (req.body || {}) as Record<string, unknown>;
  const toStageCode = body.toStageCode;
  if (toStageCode == null || toStageCode === '') {
    res.status(400).json({ success: false, error: 'toStageCode is required' });
    return;
  }
  const { Model: Opportunities, sequelize } = await resolvePublishedEdgeModel(${q(ids.opportunitiesModelId)});
  const { Model: StageHistory } = await resolvePublishedEdgeModel(${q(ids.stageHistoryModelId)});
  const wonId = ${q(ids.pipelineWonId)};
  const lostId = ${q(ids.pipelineLostId)};
  const actorId = req.auth?.userId ?? null;
  const now = new Date();

  let outcome: { status: number; body: Record<string, unknown> } | null = null;
  let data: unknown = null;

  await sequelize.transaction(async (t: any) => {
    const opp = await Opportunities.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!opp) {
      outcome = { status: 404, body: { success: false, error: 'Opportunity not found' } };
      return;
    }
    if (opp.get('closedAt')) {
      outcome = { status: 400, body: { success: false, error: 'closed opportunity cannot change stage' } };
      return;
    }
    const fromStageCode = opp.get('stageCode');
    const patch: Record<string, unknown> = {
      stageCode: toStageCode,
      updatedBy: actorId,
      updatedAt: now,
    };
    if (String(toStageCode) === wonId || String(toStageCode) === lostId) {
      patch.closedAt = now;
    }
    await StageHistory.create({
      opportunityId: id,
      fromStageCode: fromStageCode ?? null,
      toStageCode,
      changedBy: actorId,
      changedAt: now,
    }, { transaction: t });
    await opp.update(patch, { transaction: t });
    data = opp.get({ plain: true });
  });

  if (outcome) {
    res.status(outcome.status).json(outcome.body);
    return;
  }
  res.json({ success: true, data });
}
`.trim();

const opportunitiesReopen = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const id = req.params.id;
  const { Model: Opportunities, sequelize } = await resolvePublishedEdgeModel(${q(ids.opportunitiesModelId)});
  const { Model: StageHistory } = await resolvePublishedEdgeModel(${q(ids.stageHistoryModelId)});
  const wonId = ${q(ids.pipelineWonId)};
  const lostId = ${q(ids.pipelineLostId)};
  const newId = ${q(ids.pipelineNewId)};
  const actorId = req.auth?.userId ?? null;

  let outcome: { status: number; body: Record<string, unknown> } | null = null;
  let data: unknown = null;

  await sequelize.transaction(async (t: any) => {
    const opp = await Opportunities.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!opp) {
      outcome = { status: 404, body: { success: false, error: 'Opportunity not found' } };
      return;
    }
    const history = await StageHistory.findAll({
      where: { opportunityId: id },
      order: [['changedAt', 'DESC']],
      transaction: t,
    });
    let restoreStage = newId;
    for (const h of history) {
      const from = h.get('fromStageCode');
      if (from != null && String(from) !== wonId && String(from) !== lostId) {
        restoreStage = from;
        break;
      }
    }
    const now = new Date();
    await opp.update({
      closedAt: null,
      stageCode: restoreStage,
      updatedBy: actorId,
      updatedAt: now,
    }, { transaction: t });
    data = opp.get({ plain: true });
  });

  if (outcome) {
    res.status(outcome.status).json(outcome.body);
    return;
  }
  res.json({ success: true, data });
}
`.trim();

const ticketsCreate = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const body = (req.body || {}) as Record<string, unknown>;
  if (body.customerUserId == null || body.subject == null || body.subject === '') {
    res.status(400).json({ success: false, error: 'customerUserId and subject are required' });
    return;
  }
  const { Model: Tickets, sequelize } = await resolvePublishedEdgeModel(${q(ids.ticketsModelId)});
  const actorId = req.auth?.userId ?? null;
  const now = new Date();
  let data: unknown = null;
  await sequelize.transaction(async (t: any) => {
${lockCustomerBeforeCreate(ids, 'body.customerUserId')}
    const row = await Tickets.create({
      customerUserId: body.customerUserId,
      subject: body.subject,
      statusCode: body.statusCode || ${q(ids.ticketStatusNewId)},
      priorityCode: body.priorityCode ?? null,
      channelCode: body.channelCode ?? null,
      assignedTo: body.assignedTo ?? null,
      openedAt: now,
      closedAt: null,
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: now,
      updatedAt: now,
    }, { transaction: t });
    data = row.get({ plain: true });
  });
  res.status(201).json({ success: true, data });
}
`.trim();

const ticketsAssign = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const id = req.params.id;
  const body = (req.body || {}) as Record<string, unknown>;
  if (body.assignedTo === undefined) {
    res.status(400).json({ success: false, error: 'assignedTo is required' });
    return;
  }
  const { Model: Tickets, sequelize } = await resolvePublishedEdgeModel(${q(ids.ticketsModelId)});
  let data: unknown = null;
  let notFound = false;
  await sequelize.transaction(async (t: any) => {
    const row = await Tickets.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!row) { notFound = true; return; }
    await row.update({
      assignedTo: body.assignedTo,
      updatedBy: req.auth?.userId ?? null,
      updatedAt: new Date(),
    }, { transaction: t });
    data = row.get({ plain: true });
  });
  if (notFound) {
    res.status(404).json({ success: false, error: 'Ticket not found' });
    return;
  }
  res.json({ success: true, data });
}
`.trim();

const ticketsResolve = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const id = req.params.id;
  const { Model: Tickets, sequelize } = await resolvePublishedEdgeModel(${q(ids.ticketsModelId)});
  let data: unknown = null;
  let notFound = false;
  await sequelize.transaction(async (t: any) => {
    const row = await Tickets.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!row) { notFound = true; return; }
    await row.update({
      statusCode: ${q(ids.ticketStatusResolvedId)},
      updatedBy: req.auth?.userId ?? null,
      updatedAt: new Date(),
    }, { transaction: t });
    data = row.get({ plain: true });
  });
  if (notFound) {
    res.status(404).json({ success: false, error: 'Ticket not found' });
    return;
  }
  res.json({ success: true, data });
}
`.trim();

const ticketsClose = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const id = req.params.id;
  const { Model: Tickets, sequelize } = await resolvePublishedEdgeModel(${q(ids.ticketsModelId)});
  let data: unknown = null;
  let notFound = false;
  await sequelize.transaction(async (t: any) => {
    const row = await Tickets.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!row) { notFound = true; return; }
    const now = new Date();
    await row.update({
      statusCode: ${q(ids.ticketStatusClosedId)},
      closedAt: now,
      updatedBy: req.auth?.userId ?? null,
      updatedAt: now,
    }, { transaction: t });
    data = row.get({ plain: true });
  });
  if (notFound) {
    res.status(404).json({ success: false, error: 'Ticket not found' });
    return;
  }
  res.json({ success: true, data });
}
`.trim();

const ticketsReopen = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const id = req.params.id;
  const { Model: Tickets, sequelize } = await resolvePublishedEdgeModel(${q(ids.ticketsModelId)});
  let data: unknown = null;
  let notFound = false;
  await sequelize.transaction(async (t: any) => {
    const row = await Tickets.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!row) { notFound = true; return; }
    await row.update({
      statusCode: ${q(ids.ticketStatusOpenId)},
      closedAt: null,
      updatedBy: req.auth?.userId ?? null,
      updatedAt: new Date(),
    }, { transaction: t });
    data = row.get({ plain: true });
  });
  if (notFound) {
    res.status(404).json({ success: false, error: 'Ticket not found' });
    return;
  }
  res.json({ success: true, data });
}
`.trim();

const ticketsMessagesList = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const id = req.params.id;
  const { Model: Messages } = await resolvePublishedEdgeModel(${q(ids.messagesModelId)});
  const rows = await Messages.findAll({
    where: { ticketId: id },
    order: [['createdAt', 'ASC']],
  });
  res.json({
    success: true,
    data: rows.map((row: { get: (opts: { plain: boolean }) => unknown }) => row.get({ plain: true })),
  });
}
`.trim();

/**
 * v1 Studio UI only posts AGENT replies (author_id = current user) — never null/customer.
 * Auto-reopen-on-message is documented as a rule for the future customer/inbound path,
 * not this endpoint (see crm_ticket_messages Story in seedCrmStudioMeta.ts); an agent
 * adding a follow-up note must never silently flip a Resolved ticket back to Open.
 */
const ticketsMessagesCreate = (ids: CrmDomainIds): string => `
async function handler(): Promise<void> {
  const id = req.params.id;
  const body = (req.body || {}) as Record<string, unknown>;
  if (body.body == null || body.body === '') {
    res.status(400).json({ success: false, error: 'body is required' });
    return;
  }
  const { Model: Tickets, sequelize } = await resolvePublishedEdgeModel(${q(ids.ticketsModelId)});
  const { Model: Messages } = await resolvePublishedEdgeModel(${q(ids.messagesModelId)});
  const actorId = req.auth?.userId ?? null;
  const now = new Date();
  let data: unknown = null;
  let notFound = false;
  await sequelize.transaction(async (t: any) => {
    const ticket = await Tickets.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!ticket) { notFound = true; return; }
    const message = await Messages.create({
      ticketId: id,
      authorId: actorId,
      body: body.body,
      createdAt: now,
    }, { transaction: t });
    data = message.get({ plain: true });
  });
  if (notFound) {
    res.status(404).json({ success: false, error: 'Ticket not found' });
    return;
  }
  res.status(201).json({ success: true, data });
}
`.trim();

export const buildCrmDomainActions = (ids: CrmDomainIds): CrmDomainAction[] => [
  { name: 'customers-list', method: 'GET', path: '/api/crm/customers', code: customersList(ids) },
  { name: 'customers-create', method: 'POST', path: '/api/crm/customers', code: customersCreate(ids) },
  { name: 'customers-get', method: 'GET', path: '/api/crm/customers/:userId', code: customersGet(ids) },
  { name: 'customers-patch', method: 'PATCH', path: '/api/crm/customers/:userId', code: customersPatch(ids) },
  { name: 'customers-related-counts', method: 'GET', path: '/api/crm/customers/:userId/related-counts', code: customersRelatedCounts(ids) },
  { name: 'customers-merge', method: 'POST', path: '/api/crm/customers/merge', code: customersMerge(ids) },
  { name: 'customers-archive', method: 'POST', path: '/api/crm/customers/:userId/archive', code: customersArchive(ids) },
  { name: 'customers-tags-sync', method: 'PUT', path: '/api/crm/customers/:userId/tags', code: customersTagsSync(ids) },
  { name: 'opportunities-board', method: 'GET', path: '/api/crm/opportunities/board', code: opportunitiesBoard(ids) },
  { name: 'opportunities-change-stage', method: 'POST', path: '/api/crm/opportunities/:id/change-stage', code: opportunitiesChangeStage(ids) },
  { name: 'opportunities-reopen', method: 'POST', path: '/api/crm/opportunities/:id/reopen', code: opportunitiesReopen(ids) },
  { name: 'tickets-create', method: 'POST', path: '/api/crm/tickets', code: ticketsCreate(ids) },
  { name: 'tickets-assign', method: 'POST', path: '/api/crm/tickets/:id/assign', code: ticketsAssign(ids) },
  { name: 'tickets-resolve', method: 'POST', path: '/api/crm/tickets/:id/resolve', code: ticketsResolve(ids) },
  { name: 'tickets-close', method: 'POST', path: '/api/crm/tickets/:id/close', code: ticketsClose(ids) },
  { name: 'tickets-reopen', method: 'POST', path: '/api/crm/tickets/:id/reopen', code: ticketsReopen(ids) },
  { name: 'tickets-messages-list', method: 'GET', path: '/api/crm/tickets/:id/messages', code: ticketsMessagesList(ids) },
  { name: 'tickets-messages-create', method: 'POST', path: '/api/crm/tickets/:id/messages', code: ticketsMessagesCreate(ids) },
];
