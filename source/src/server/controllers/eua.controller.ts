import type { Request, Response } from 'express';
import { FieldAssistService } from '../services/ai/fieldAssist.service';
import { EuaVocabContextService } from '../services/ai/euaVocabContext.service';
import { asyncHandler } from '../utils/asyncHandler';
import { isHttpError } from '../errors/HttpError';
import { logger } from '../../core/logging/Logger';

const resolveUserId = (req: Request): string => {
  const userId = req.auth?.userId;
  return userId === undefined || userId === null ? 'unknown' : String(userId);
};

const euaErrorHandler = (label: string) => (error: unknown, _req: Request, res: Response) => {
  logger.error('EUA', label, { error });
  if (isHttpError(error)) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return true;
  }
  const message = error instanceof Error ? error.message : label;
  const status = /not configured|disabled|not found/i.test(message) ? 503 : 500;
  res.status(status).json({ success: false, error: message });
  return true;
};

export class EuaController {
  constructor(
    private readonly fieldAssistService = new FieldAssistService(),
    private readonly vocabContextService = new EuaVocabContextService(),
  ) {}

  getStatus = asyncHandler(async (_req: Request, res: Response) => {
    const status = this.fieldAssistService.getStatus();
    res.json({ success: true, ...status });
  });

  getSettings = asyncHandler(async (_req: Request, res: Response) => {
    const settings = this.fieldAssistService.getEuaSettings();
    res.json({ success: true, settings });
  });

  updateSettings = asyncHandler(async (req: Request, res: Response) => {
    const settings = await this.fieldAssistService.updateEuaSettings(req.body);
    res.json({ success: true, settings });
  });

  transformText = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.fieldAssistService.transformText(req.body);
    res.json({ success: true, ...result });
  }, 'Failed to transform text.', { onError: euaErrorHandler('Field assist transform failed') });

  autocompleteText = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.fieldAssistService.autocompleteText(req.body);
    res.json({ success: true, ...result });
  }, 'Failed to autocomplete text.', { onError: euaErrorHandler('Field assist autocomplete failed') });

  contextSuggest = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.fieldAssistService.contextSuggest(req.body);
    res.json({ success: true, ...result });
  }, 'Failed to suggest field context.', { onError: euaErrorHandler('Field assist context suggest failed') });

  extractFields = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.fieldAssistService.extractFields(req.body);
    res.json({ success: true, ...result });
  }, 'Failed to extract fields.', { onError: euaErrorHandler('Field assist structured extract failed') });

  fillFromText = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.fieldAssistService.fillFromText(req.body, resolveUserId(req));
    res.json({ success: true, ...result });
  }, 'Failed to fill form from text.', { onError: euaErrorHandler('Field assist fill from text failed') });

  ocrImage = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.fieldAssistService.ocrImage(req.body, resolveUserId(req));
    res.json({ success: true, ...result });
  }, 'Failed to OCR image.', { onError: euaErrorHandler('Field assist OCR failed') });

  generateAltText = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.fieldAssistService.generateAltText(req.body, resolveUserId(req));
    res.json({ success: true, ...result });
  }, 'Failed to generate alt text.', { onError: euaErrorHandler('Field assist alt text failed') });

  semanticValidate = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.fieldAssistService.semanticValidateText(req.body, resolveUserId(req));
    res.json({ success: true, ...result });
  }, 'Failed to validate text.', { onError: euaErrorHandler('Semantic validation failed') });

  getVocabSemanticContext = asyncHandler(async (req: Request, res: Response) => {
    const record = await this.vocabContextService.getRecord(String(req.params.id || ''));
    res.json({ success: true, record });
  }, 'Failed to load vocabulary context.', { onError: euaErrorHandler('Vocab context load failed') });

  patchVocabSemanticContext = asyncHandler(async (req: Request, res: Response) => {
    const actorId = req.auth?.userId === undefined ? null : Number(req.auth.userId) || null;
    const record = await this.vocabContextService.patchSemanticContext(
      String(req.params.id || ''),
      req.body ?? {},
      actorId,
    );
    res.json({ success: true, record });
  }, 'Failed to save vocabulary context.', { onError: euaErrorHandler('Vocab context save failed') });
}
