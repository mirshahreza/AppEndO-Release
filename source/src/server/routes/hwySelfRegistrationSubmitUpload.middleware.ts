import type { NextFunction, Request, Response } from 'express';
import multer, { type File as MulterFile } from 'multer';

import {
  HWY_SELF_REGISTRATION_ATTACHMENT_FIELD_NAMES,
  resolveHwySelfRegistrationAttachmentKindSlug,
  type HwySelfRegistrationSubmitAttachment,
} from '../../domain/hwy/selfRegistration/hwySelfRegistrationAttachmentFields';

const selfRegistrationSubmitUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}).fields(
  HWY_SELF_REGISTRATION_ATTACHMENT_FIELD_NAMES.map((name) => ({ name, maxCount: 1 })),
);

export const parseHwySelfRegistrationSubmitAttachments = (req: Request): HwySelfRegistrationSubmitAttachment[] => {
  const raw = req.files as Record<string, MulterFile[]> | undefined;
  if (!raw) {
    return [];
  }
  const attachments: HwySelfRegistrationSubmitAttachment[] = [];
  for (const field of HWY_SELF_REGISTRATION_ATTACHMENT_FIELD_NAMES) {
    const file = raw[field]?.[0];
    if (!file?.buffer?.length) {
      continue;
    }
    const kindSlug = resolveHwySelfRegistrationAttachmentKindSlug(field);
    if (!kindSlug) {
      continue;
    }
    attachments.push({
      kindSlug,
      fileName: file.originalname || `${field}.bin`,
      mime: file.mimetype || 'application/octet-stream',
      body: file.buffer,
    });
  }
  return attachments;
};

export const runHwySelfRegistrationSubmitUpload = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const contentType = String(req.headers['content-type'] ?? '');
  if (!contentType.includes('multipart/form-data')) {
    next();
    return;
  }
  selfRegistrationSubmitUpload(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : 'Invalid registration upload.';
      res.status(400).json({ success: false, message });
      return;
    }
    next();
  });
};
