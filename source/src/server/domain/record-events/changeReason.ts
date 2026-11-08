import type { Request } from 'express';
import {
  CHANGE_REASON_CODE_BODY_KEY,
  CHANGE_REASON_CODE_HEADER,
  CHANGE_REASON_TEXT_BODY_KEY,
  CHANGE_REASON_TEXT_HEADER,
} from '../../../shared/api/contracts/client-context';
import {
  RECORD_CHANGE_REASON_GENERAL,
  RECORD_CHANGE_REASON_REVERTED,
  catalogAllowedReasonCodes,
  reasonIncludeGeneralEnabled,
  resolveReasonVocabNodeId,
} from '../../../shared/api/contracts/record-events';
import type { ChangeReasonPolicy } from '../../../shared/api/contracts/record-events';
import { HttpError } from '../../errors/HttpError';
import { prisma } from '../users/prismaHelpers';
import { getRecordEventRequestScope } from '../client-context/requestAls';

export type ChangeReason = {
  code: string | null;
  text: string | null;
};

const readHeader = (req: Pick<Request, 'headers'> | undefined, name: string): string | undefined => {
  if (!req) return undefined;
  const value = req.headers[name.toLowerCase()] ?? req.headers[name];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
};

export const parseChangeReason = (
  req?: Pick<Request, 'headers' | 'body'>,
  explicit?: { code?: string | null; text?: string | null },
): ChangeReason => {
  if (explicit && (explicit.code || explicit.text)) {
    return {
      code: explicit.code?.trim() || null,
      text: explicit.text?.trim() || null,
    };
  }
  const scopeReq = req ?? getRecordEventRequestScope()?.req;
  const headerCode = readHeader(scopeReq, CHANGE_REASON_CODE_HEADER)?.trim() || null;
  const headerText = readHeader(scopeReq, CHANGE_REASON_TEXT_HEADER)?.trim() || null;
  const body = scopeReq?.body && typeof scopeReq.body === 'object' && !Array.isArray(scopeReq.body)
    ? scopeReq.body as Record<string, unknown>
    : {};
  const bodyCode = typeof body[CHANGE_REASON_CODE_BODY_KEY] === 'string'
    ? String(body[CHANGE_REASON_CODE_BODY_KEY]).trim() || null
    : null;
  const bodyText = typeof body[CHANGE_REASON_TEXT_BODY_KEY] === 'string'
    ? String(body[CHANGE_REASON_TEXT_BODY_KEY]).trim() || null
    : null;
  return {
    code: headerCode || bodyCode,
    text: headerText || bodyText,
  };
};

const listActiveLeafChildIds = async (parentId: string): Promise<string[]> => {
  const children = await prisma().baseInfo.findMany({
    where: { parentId, isActive: true },
    select: { id: true },
  });
  if (children.length === 0) return [];
  const nested = await prisma().baseInfo.findMany({
    where: { parentId: { in: children.map((row) => row.id) } },
    select: { parentId: true },
  });
  const folders = new Set(
    nested
      .map((row) => row.parentId)
      .filter((id): id is string => Boolean(id)),
  );
  return children.filter((row) => !folders.has(row.id)).map((row) => row.id);
};

export const loadAllowedReasonCodes = async (
  vocabNodeId?: string | null,
  includeGeneral?: boolean,
): Promise<Set<string>> => {
  const situational = resolveReasonVocabNodeId(vocabNodeId);
  const allowed = new Set<string>(catalogAllowedReasonCodes(vocabNodeId, includeGeneral));
  const situationalLeaves = await listActiveLeafChildIds(situational);
  for (const id of situationalLeaves) allowed.add(id);
  if (reasonIncludeGeneralEnabled(includeGeneral) && situational !== RECORD_CHANGE_REASON_GENERAL) {
    for (const id of await listActiveLeafChildIds(RECORD_CHANGE_REASON_GENERAL)) {
      allowed.add(id);
    }
  }
  return allowed;
};

export const assertChangeReason = async (input: {
  policy?: ChangeReasonPolicy | null;
  reason: ChangeReason;
  allowedCodes?: ReadonlySet<string>;
}): Promise<void> => {
  const ask = input.policy?.reasonAsk ?? 'off';
  if (ask === 'off') {
    return;
  }
  const capture = input.policy?.reasonCapture ?? 'both';
  const needCode = capture === 'code' || capture === 'both';
  const needText = capture === 'text' || capture === 'both';
  const hasCode = Boolean(input.reason.code);
  const hasText = Boolean(input.reason.text);

  if (ask === 'required') {
    if (needCode && !hasCode) {
      throw new HttpError(400, 'A change reason code is required.');
    }
    if (needText && !hasText) {
      throw new HttpError(400, 'A change reason is required.');
    }
  }

  if (!hasCode || !input.reason.code) {
    return;
  }

  if (input.reason.code === RECORD_CHANGE_REASON_REVERTED) {
    return;
  }

  const allowed = input.allowedCodes ?? await loadAllowedReasonCodes(
    input.policy?.reasonVocabNodeId,
    input.policy?.reasonIncludeGeneral,
  );
  if (!allowed.has(input.reason.code)) {
    throw new HttpError(400, 'Change reason code is not in the allowed vocabulary.');
  }
};
