import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import type { PersonalInboxKindFilter, PersonalInboxViewFilter } from '../../shared/api/contracts/personal-inbox/types';
import type { PersonalInboxService } from '../services/personal-inbox/personalInbox.service';
import type { PersonalInboxCorrespondenceService } from '../services/personal-inbox/personalInboxCorrespondence.service';
import type { PersonalInboxVocabService } from '../services/personal-inbox/personalInboxVocab.service';
import type { PersonalInboxEnvelopeService } from '../services/personal-inbox/personalInboxEnvelope.service';

const parseKind = (raw: unknown): PersonalInboxKindFilter | undefined => {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const value = raw.trim().toLowerCase();
  if (value === 'all') return 'all';
  if (
    value === 'work_item'
    || value === 'feedback'
    || value === 'alert'
    || value === 'message_dispatch'
    || value === 'direct_message'
  ) {
    return value;
  }
  return undefined;
};

const parseView = (raw: unknown): PersonalInboxViewFilter | undefined => {
  if (typeof raw !== 'string' || !raw.trim()) {
    return undefined;
  }
  const value = raw.trim().toLowerCase();
  if (value === 'archived') {
    return 'archived';
  }
  if (value === 'all') {
    return 'all';
  }
  if (value === 'active') {
    return 'active';
  }
  return undefined;
};

const parseFolder = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string' || !raw.trim()) {
    return undefined;
  }
  return raw.trim();
};

export class PersonalInboxController {
  constructor(
    private readonly service: PersonalInboxService,
    private readonly correspondence?: PersonalInboxCorrespondenceService,
    private readonly vocab?: PersonalInboxVocabService,
    private readonly envelope?: PersonalInboxEnvelopeService,
  ) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const take = req.query.take !== undefined ? Number(req.query.take) : undefined;
    const dispatchChannel = typeof req.query.dispatchChannel === 'string'
      ? req.query.dispatchChannel.trim()
      : undefined;
    const dispatchStatus = typeof req.query.dispatchStatus === 'string'
      ? req.query.dispatchStatus.trim()
      : undefined;
    const result = await this.service.list(req.auth!, {
      kind: parseKind(req.query.kind),
      folder: parseFolder(req.query.folder),
      view: parseView(req.query.view),
      take: Number.isFinite(take) ? take : undefined,
      dispatchChannel: dispatchChannel || undefined,
      dispatchStatus: dispatchStatus || undefined,
    });
    res.json({ success: true, ...result });
  }, 'Failed to load personal inbox.');

  summary = asyncHandler(async (req: Request, res: Response) => {
    const summary = await this.service.summary(req.auth!);
    res.json({ success: true, summary });
  }, 'Failed to load personal inbox summary.');

  listFolders = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.service.listFolders(req.auth!);
    res.json({ success: true, ...result });
  }, 'Failed to load inbox folders.');

  createFolder = asyncHandler(async (req: Request, res: Response) => {
    const name = typeof req.body?.name === 'string' ? req.body.name : '';
    const folder = await this.service.createFolder(req.auth!, name);
    res.json({ success: true, folder });
  }, 'Failed to create inbox folder.');

  renameFolder = asyncHandler(async (req: Request, res: Response) => {
    const folderId = Number(req.params.folderId);
    const name = typeof req.body?.name === 'string' ? req.body.name : '';
    if (!Number.isInteger(folderId) || folderId <= 0) {
      res.status(400).json({ success: false, error: 'Invalid folder id.' });
      return;
    }
    const folder = await this.service.renameFolder(req.auth!, folderId, name);
    if (!folder) {
      res.status(404).json({ success: false, error: 'Folder not found.' });
      return;
    }
    res.json({ success: true, folder });
  }, 'Failed to rename inbox folder.');

  deleteFolder = asyncHandler(async (req: Request, res: Response) => {
    const folderId = Number(req.params.folderId);
    if (!Number.isInteger(folderId) || folderId <= 0) {
      res.status(400).json({ success: false, error: 'Invalid folder id.' });
      return;
    }
    const result = await this.service.deleteFolder(req.auth!, folderId);
    res.json({ success: true, ...result });
  }, 'Failed to delete inbox folder.');

  setItemFolders = asyncHandler(async (req: Request, res: Response) => {
    const itemKey = typeof req.body?.itemKey === 'string' ? req.body.itemKey.trim() : '';
    const folderRefs = Array.isArray(req.body?.folderRefs)
      ? req.body.folderRefs.filter((ref: unknown) => typeof ref === 'string')
      : [];
    if (!itemKey) {
      res.status(400).json({ success: false, error: 'itemKey is required.' });
      return;
    }
    const result = await this.service.setItemFolderRefs(req.auth!, itemKey, folderRefs);
    const summary = await this.service.summary(req.auth!);
    res.json({ success: true, ...result, summary });
  }, 'Failed to update inbox item folders.');

  permanentDeleteItem = asyncHandler(async (req: Request, res: Response) => {
    const itemKey = typeof req.body?.itemKey === 'string' ? req.body.itemKey.trim() : '';
    if (!itemKey) {
      res.status(400).json({ success: false, error: 'itemKey is required.' });
      return;
    }
    const result = await this.service.permanentDeleteItem(req.auth!, itemKey);
    const summary = await this.service.summary(req.auth!);
    res.json({ success: true, ...result, summary });
  }, 'Failed to permanently delete inbox item.');

  dismissAttention = asyncHandler(async (req: Request, res: Response) => {
    const itemKey = typeof req.body?.itemKey === 'string' ? req.body.itemKey.trim() : '';
    if (!itemKey) {
      res.status(400).json({ success: false, error: 'itemKey is required.' });
      return;
    }
    const result = await this.service.dismissAttention(req.auth!, itemKey);
    const summary = await this.service.summary(req.auth!);
    res.json({ success: true, ...result, summary });
  }, 'Failed to dismiss inbox attention.');

  markUnread = asyncHandler(async (req: Request, res: Response) => {
    const itemKey = typeof req.body?.itemKey === 'string' ? req.body.itemKey.trim() : '';
    if (!itemKey) {
      res.status(400).json({ success: false, error: 'itemKey is required.' });
      return;
    }
    const result = await this.service.markUnread(req.auth!, itemKey);
    const summary = await this.service.summary(req.auth!);
    res.json({ success: true, ...result, summary });
  }, 'Failed to mark inbox item unread.');

  itemDetail = asyncHandler(async (req: Request, res: Response) => {
    if (!this.envelope) {
      res.status(503).json({ success: false, error: 'Inbox item detail is unavailable.' });
      return;
    }
    const itemKey = typeof req.query.itemKey === 'string' ? req.query.itemKey.trim() : '';
    if (!itemKey) {
      res.status(400).json({ success: false, error: 'itemKey is required.' });
      return;
    }
    const detail = await this.envelope.getItemDetail(req.auth!, itemKey);
    res.json({ success: true, detail });
  }, 'Failed to load inbox item detail.');

  correspondenceVocab = asyncHandler(async (_req: Request, res: Response) => {
    if (!this.vocab) {
      res.status(503).json({ success: false, error: 'Inbox vocabulary is unavailable.' });
      return;
    }
    const vocab = await this.vocab.listCorrespondenceVocab();
    res.json({ success: true, ...vocab });
  }, 'Failed to load inbox correspondence vocabulary.');

  replyToItem = asyncHandler(async (req: Request, res: Response) => {
    if (!this.correspondence) {
      res.status(503).json({ success: false, error: 'Inbox correspondence is unavailable.' });
      return;
    }
    const itemKey = typeof req.body?.itemKey === 'string' ? req.body.itemKey.trim() : '';
    const body = typeof req.body?.body === 'string' ? req.body.body : '';
    const stagedSessionKey = typeof req.body?.stagedSessionKey === 'string' ? req.body.stagedSessionKey : '';
    const attachmentIds = Array.isArray(req.body?.attachmentIds)
      ? req.body.attachmentIds.filter((id: unknown) => typeof id === 'string')
      : [];
    if (!itemKey) {
      res.status(400).json({ success: false, error: 'itemKey is required.' });
      return;
    }
    const result = await this.correspondence.reply(req.auth!, itemKey, body, stagedSessionKey, attachmentIds);
    const summary = await this.service.summary(req.auth!);
    res.json({ success: true, ...result, summary });
  }, 'Failed to reply to inbox item.');

  forwardItem = asyncHandler(async (req: Request, res: Response) => {
    if (!this.correspondence) {
      res.status(503).json({ success: false, error: 'Inbox correspondence is unavailable.' });
      return;
    }
    const itemKey = typeof req.body?.itemKey === 'string' ? req.body.itemKey.trim() : '';
    const recipientUserId = Number(req.body?.recipientUserId);
    const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
    const stagedSessionKey = typeof req.body?.stagedSessionKey === 'string' ? req.body.stagedSessionKey : '';
    const attachmentIds = Array.isArray(req.body?.attachmentIds)
      ? req.body.attachmentIds.filter((id: unknown) => typeof id === 'string')
      : [];
    if (!itemKey) {
      res.status(400).json({ success: false, error: 'itemKey is required.' });
      return;
    }
    if (!Number.isInteger(recipientUserId) || recipientUserId <= 0) {
      res.status(400).json({ success: false, error: 'recipientUserId is required.' });
      return;
    }
    const item = await this.service.findItemForUser(req.auth!, itemKey);
    if (!item) {
      res.status(404).json({ success: false, error: 'Inbox item not found.' });
      return;
    }
    const result = await this.correspondence.forward(
      req.auth!,
      itemKey,
      recipientUserId,
      item,
      note,
      stagedSessionKey,
      attachmentIds,
    );
    const summary = await this.service.summary(req.auth!);
    res.json({ success: true, ...result, summary });
  }, 'Failed to forward inbox item.');
}
