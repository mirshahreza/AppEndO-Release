import type { ChatMessage } from '../../../core/ai/IAiProvider';
import { aiManager } from '../../../core/ai/AiManager';
import {
  type EuaFieldAssistAutocompleteRequest,
  type EuaFieldAssistContextSuggestRequest,
  type EuaFieldAssistExtractRequest,
  type EuaFieldAssistFillRequest,
  type EuaFieldAssistAltTextRequest,
  type EuaFieldAssistOcrRequest,
  type EuaFieldAssistTransformRequest,
  type EuaFieldMapEntry,
  type EuaTransformAction,
} from '../../../shared/api/contracts/ai/euaFieldAssist';
import type { EuaFieldAssistSemanticValidateRequest } from '../../../shared/api/contracts/ai/euaSemanticValidation';
import {
  buildSemanticValidationSystemPrompt,
  buildSemanticValidationUserPrompt,
  parseSemanticValidationModelJson,
} from '../../../shared/ui/ai-field-assist/buildSemanticValidationPrompt';
import { normalizeEuaAssistSettings, type EuaAssistSettings } from '../../../shared/api/contracts/ai/euaAssistSettings';
import { HttpError } from '../../errors/HttpError';
import {
  EUA_AUTOCOMPLETE_MIN_CHARS,
  EUA_AUTOCOMPLETE_SYSTEM_PROMPT,
  buildAutocompleteUserPrompt,
  normalizeAutocompleteCompletion,
} from '../../../shared/ui/ai-field-assist/buildAutocompletePrompt';
import {
  buildContextSuggestUserPrompt,
  EUA_CONTEXT_SUGGEST_SYSTEM_PROMPT,
  normalizeContextSuggestion,
} from '../../../shared/ui/ai-field-assist/buildContextSuggestPrompt';
import {
  buildStructuredExtractUserPrompt,
  EUA_STRUCTURED_EXTRACT_SYSTEM_PROMPT,
  extractStructuredFieldValues,
  parseLabeledSourceText,
} from '../../../shared/ui/ai-field-assist/buildStructuredExtractPrompt';
import {
  buildNarrativeFillUserPrompt,
  EUA_NARRATIVE_FILL_SYSTEM_PROMPT,
  filterEuaFieldsBySection,
} from '../../../shared/ui/ai-field-assist/buildFillFormPrompt';
import { SETTINGS_PATH } from '../../config/settingsFile';
import { getAiSettings, saveAiSettingsToFile } from '../../db/aiSettingsStore';
import { hydrateAiSettingsSecrets } from '../../domain/security/credentialVault/platformSettingsSecrets';
import { resolveEuaCapabilities } from './euaSettingsResolver';
import { EuaVisionService } from './euaVision.service';
import { getEuaUsageLogService } from './euaUsageLog.service';
import path from 'node:path';
import {
  buildTransformSystemPrompt,
  mergeSelectionTransform,
  stripAiResponseWrapping,
} from '../../../shared/ui/ai-field-assist/buildTransformPrompt';
import {
  isFieldAssistReady,
  resolveFieldAssistChatModelId,
} from './fieldAssistModelResolver';

const VALID_ACTIONS = new Set<EuaTransformAction>([
  'expand',
  'summarize',
  'formal',
  'casual',
  'spell-grammar',
  'markdown-format',
  'translate',
  'custom',
]);

const assertAiSettings = () => {
  const settings = aiManager.getSettings();
  if (!settings?.enabled) {
    throw new HttpError(503, 'AI is disabled in platform settings.');
  }
  return settings;
};

export class FieldAssistService {
  constructor(private readonly visionService = new EuaVisionService()) {}

  private logUsage(entry: {
    userId: string;
    action: string;
    capability?: import('../../../shared/api/contracts/ai/euaFieldAssist').EuaCapabilityKey;
    modelId?: string;
    formId?: string;
    surface?: 'admin' | 'published';
    ok: boolean;
    error?: string;
  }): void {
    getEuaUsageLogService(path.dirname(SETTINGS_PATH)).append(entry);
  }

  getStatus() {
    const settings = aiManager.getSettings();
    const ready = isFieldAssistReady(settings);
    const defaultModelId = settings && ready
      ? resolveFieldAssistChatModelId(settings) ?? undefined
      : undefined;

    return {
      aiEnabled: ready,
      defaultModelId,
      capabilities: resolveEuaCapabilities(settings, ready),
      euaSettings: normalizeEuaAssistSettings(settings?.eua),
    };
  }

  getEuaSettings(): EuaAssistSettings {
    return normalizeEuaAssistSettings(getAiSettings(SETTINGS_PATH).eua);
  }

  async updateEuaSettings(next: unknown): Promise<EuaAssistSettings> {
    const settings = assertAiSettings();
    const normalized = normalizeEuaAssistSettings(next);
    const saved = saveAiSettingsToFile(SETTINGS_PATH, {
      ...settings,
      eua: normalized,
    });
    aiManager.reloadFromSettings(await hydrateAiSettingsSecrets(saved));
    return normalized;
  }

  private normalizeFieldDefinitions(requestFields: unknown): EuaFieldMapEntry[] {
    if (!Array.isArray(requestFields) || requestFields.length === 0) {
      throw new HttpError(400, 'At least one field definition is required.');
    }

    const fields = requestFields.filter((field) => (
      field
      && typeof field === 'object'
      && typeof field.name === 'string'
      && field.name.trim()
      && typeof field.label === 'string'
      && typeof field.type === 'string'
    )) as EuaFieldMapEntry[];

    if (fields.length === 0) {
      throw new HttpError(400, 'Valid field definitions are required.');
    }

    return fields;
  }

  async transformText(body: unknown) {
    const settings = assertAiSettings();

    if (!body || typeof body !== 'object') {
      throw new HttpError(400, 'Request body is required.');
    }

    const request = body as EuaFieldAssistTransformRequest;
    const action = request.action;
    if (!action || !VALID_ACTIONS.has(action)) {
      throw new HttpError(400, 'A valid transform action is required.');
    }

    const text = typeof request.text === 'string' ? request.text : '';
    const selection = typeof request.selection === 'string' ? request.selection : undefined;
    const sourceText = selection?.trim() ? selection : text;

    if (!sourceText.trim()) {
      throw new HttpError(400, 'Text to transform is required.');
    }

    if (action === 'custom' && !request.customPrompt?.trim()) {
      throw new HttpError(400, 'customPrompt is required for custom action.');
    }

    const requestedModelId = typeof request.modelId === 'string' ? request.modelId : undefined;
    const resolvedModelId = resolveFieldAssistChatModelId(settings, requestedModelId);
    if (!resolvedModelId) {
      throw new HttpError(
        503,
        'No chat-capable AI model is configured. Enable a chat model in Settings → AI Models.',
      );
    }

    const systemPrompt = buildTransformSystemPrompt(action, {
      customPrompt: request.customPrompt,
      targetLanguage: request.targetLanguage,
      fieldLabel: request.fieldLabel,
      fieldKind: request.fieldKind,
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: sourceText },
    ];

    try {
      const raw = await aiManager.processChat(messages, resolvedModelId);
      const transformed = stripAiResponseWrapping(raw);

      let resultText = transformed;
      if (
        selection
        && typeof request.selectionStart === 'number'
        && typeof request.selectionEnd === 'number'
        && request.selectionStart >= 0
        && request.selectionEnd >= request.selectionStart
        && request.selectionEnd <= text.length
      ) {
        resultText = mergeSelectionTransform(
          text,
          request.selectionStart,
          request.selectionEnd,
          transformed,
        );
      } else if (selection && selection !== text) {
        const start = text.indexOf(selection);
        if (start >= 0) {
          resultText = mergeSelectionTransform(text, start, start + selection.length, transformed);
        } else {
          resultText = transformed;
        }
      }

      return {
        text: resultText,
        modelId: resolvedModelId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI transform failed.';
      if (/does not support chat/i.test(message)) {
        throw new HttpError(400, message);
      }
      if (/not configured|disabled|not found/i.test(message)) {
        throw new HttpError(503, message);
      }
      throw error;
    }
  }

  async autocompleteText(body: unknown) {
    const settings = assertAiSettings();

    if (!body || typeof body !== 'object') {
      throw new HttpError(400, 'Request body is required.');
    }

    const request = body as EuaFieldAssistAutocompleteRequest;
    const text = typeof request.text === 'string' ? request.text : '';
    const cursorPosition = typeof request.cursorPosition === 'number'
      ? Math.max(0, Math.min(request.cursorPosition, text.length))
      : text.length;

    const textBeforeCursor = text.slice(0, cursorPosition);
    if (textBeforeCursor.trim().length < EUA_AUTOCOMPLETE_MIN_CHARS) {
      throw new HttpError(400, 'More text is required before autocomplete can run.');
    }

    if (cursorPosition < text.length) {
      throw new HttpError(400, 'Autocomplete is only available when the cursor is at the end of the text.');
    }

    const requestedModelId = typeof request.modelId === 'string' ? request.modelId : undefined;
    const resolvedModelId = resolveFieldAssistChatModelId(settings, requestedModelId);
    if (!resolvedModelId) {
      throw new HttpError(
        503,
        'No chat-capable AI model is configured. Enable a chat model in Settings → AI Models.',
      );
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: EUA_AUTOCOMPLETE_SYSTEM_PROMPT },
      { role: 'user', content: buildAutocompleteUserPrompt(textBeforeCursor, request.fieldLabel) },
    ];

    try {
      const raw = await aiManager.processChat(messages, resolvedModelId);
      const completion = normalizeAutocompleteCompletion(textBeforeCursor, stripAiResponseWrapping(raw));

      return {
        completion,
        modelId: resolvedModelId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI autocomplete failed.';
      if (/does not support chat/i.test(message)) {
        throw new HttpError(400, message);
      }
      if (/not configured|disabled|not found/i.test(message)) {
        throw new HttpError(503, message);
      }
      throw error;
    }
  }

  async contextSuggest(body: unknown) {
    const settings = assertAiSettings();

    if (!body || typeof body !== 'object') {
      throw new HttpError(400, 'Request body is required.');
    }

    const request = body as EuaFieldAssistContextSuggestRequest;
    const mode = request.mode;
    if (mode !== 'placeholder' && mode !== 'content') {
      throw new HttpError(400, 'A valid context suggest mode is required.');
    }

    if (!request.fieldLabel?.trim() && !request.sectionDescription?.trim()) {
      throw new HttpError(400, 'Field label or section description is required for context suggest.');
    }

    const requestedModelId = typeof request.modelId === 'string' ? request.modelId : undefined;
    const resolvedModelId = resolveFieldAssistChatModelId(settings, requestedModelId);
    if (!resolvedModelId) {
      throw new HttpError(
        503,
        'No chat-capable AI model is configured. Enable a chat model in Settings → AI Models.',
      );
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: EUA_CONTEXT_SUGGEST_SYSTEM_PROMPT },
      { role: 'user', content: buildContextSuggestUserPrompt(request) },
    ];

    try {
      const raw = await aiManager.processChat(messages, resolvedModelId);
      const suggestion = normalizeContextSuggestion(
        stripAiResponseWrapping(raw),
        mode,
        request.fieldKind,
      );

      if (!suggestion) {
        throw new HttpError(502, 'AI returned an empty context suggestion.');
      }

      return {
        suggestion,
        modelId: resolvedModelId,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'AI context suggest failed.';
      if (/does not support chat/i.test(message)) {
        throw new HttpError(400, message);
      }
      if (/not configured|disabled|not found/i.test(message)) {
        throw new HttpError(503, message);
      }
      throw error;
    }
  }

  async extractFields(body: unknown) {
    const settings = assertAiSettings();

    if (!body || typeof body !== 'object') {
      throw new HttpError(400, 'Request body is required.');
    }

    const request = body as EuaFieldAssistExtractRequest;
    const text = typeof request.text === 'string' ? request.text.trim() : '';
    if (!text) {
      throw new HttpError(400, 'Source text is required for structured extract.');
    }

    if (!Array.isArray(request.fields) || request.fields.length === 0) {
      throw new HttpError(400, 'At least one field definition is required.');
    }

    const fields = request.fields.filter((field) => (
      field
      && typeof field === 'object'
      && typeof field.name === 'string'
      && field.name.trim()
      && typeof field.label === 'string'
      && typeof field.type === 'string'
    ));

    if (fields.length === 0) {
      throw new HttpError(400, 'Valid field definitions are required.');
    }

    const requestedModelId = typeof request.modelId === 'string' ? request.modelId : undefined;
    const resolvedModelId = resolveFieldAssistChatModelId(settings, requestedModelId);
    if (!resolvedModelId) {
      throw new HttpError(
        503,
        'No chat-capable AI model is configured. Enable a chat model in Settings → AI Models.',
      );
    }

    const labeledExtract = parseLabeledSourceText(text, fields);
    if (labeledExtract.length > 0) {
      return {
        fields: labeledExtract,
        modelId: resolvedModelId,
      };
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: EUA_STRUCTURED_EXTRACT_SYSTEM_PROMPT },
      { role: 'user', content: buildStructuredExtractUserPrompt({ ...request, text, fields }) },
    ];

    try {
      const raw = await aiManager.processChat(messages, resolvedModelId);
      const extracted = extractStructuredFieldValues(
        stripAiResponseWrapping(raw),
        text,
        fields,
      );

      if (extracted.length === 0) {
        throw new HttpError(502, 'AI could not extract any field values from the text.');
      }

      return {
        fields: extracted,
        modelId: resolvedModelId,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'AI structured extract failed.';
      if (/invalid JSON/i.test(message)) {
        throw new HttpError(502, message);
      }
      if (/does not support chat/i.test(message)) {
        throw new HttpError(400, message);
      }
      if (/not configured|disabled|not found/i.test(message)) {
        throw new HttpError(503, message);
      }
      throw error;
    }
  }

  async fillFromText(body: unknown, userId = 'unknown') {
    const settings = assertAiSettings();

    if (!body || typeof body !== 'object') {
      throw new HttpError(400, 'Request body is required.');
    }

    const request = body as EuaFieldAssistFillRequest;
    const text = typeof request.text === 'string' ? request.text.trim() : '';
    if (!text) {
      throw new HttpError(400, 'Source text is required for form fill.');
    }

    const fields = filterEuaFieldsBySection(
      this.normalizeFieldDefinitions(request.fields),
      request.sectionId,
    );

    const mode = request.mode === 'narrative' ? 'narrative' : 'extract';
    const capability = mode === 'narrative' ? 'eua.textToForm' : 'eua.structuredExtract';

    const requestedModelId = typeof request.modelId === 'string' ? request.modelId : undefined;
    const resolvedModelId = resolveFieldAssistChatModelId(settings, requestedModelId);
    if (!resolvedModelId) {
      throw new HttpError(503, 'No chat-capable AI model is configured.');
    }

    try {
      if (mode === 'extract') {
        const labeledExtract = parseLabeledSourceText(text, fields);
        if (labeledExtract.length > 0) {
          this.logUsage({
            userId,
            action: 'fill-from-text',
            capability,
            modelId: resolvedModelId,
            formId: request.formId,
            surface: request.surface,
            ok: true,
          });
          return { fields: labeledExtract, modelId: resolvedModelId, transcript: text };
        }
      }

      const messages: ChatMessage[] = mode === 'narrative'
        ? [
          { role: 'system', content: EUA_NARRATIVE_FILL_SYSTEM_PROMPT },
          { role: 'user', content: buildNarrativeFillUserPrompt({ ...request, text, fields }) },
        ]
        : [
          { role: 'system', content: EUA_STRUCTURED_EXTRACT_SYSTEM_PROMPT },
          { role: 'user', content: buildStructuredExtractUserPrompt({ ...request, text, fields }) },
        ];

      const raw = await aiManager.processChat(messages, resolvedModelId);
      const extracted = extractStructuredFieldValues(
        stripAiResponseWrapping(raw),
        text,
        fields,
      );

      if (extracted.length === 0) {
        throw new HttpError(502, 'AI could not extract any field values from the text.');
      }

      this.logUsage({
        userId,
        action: 'fill-from-text',
        capability,
        modelId: resolvedModelId,
        formId: request.formId,
        surface: request.surface,
        ok: true,
      });

      return {
        fields: extracted,
        modelId: resolvedModelId,
        transcript: text,
      };
    } catch (error) {
      this.logUsage({
        userId,
        action: 'fill-from-text',
        capability,
        formId: request.formId,
        surface: request.surface,
        ok: false,
        error: error instanceof Error ? error.message : 'fill failed',
      });
      if (error instanceof HttpError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'AI form fill failed.';
      if (/invalid JSON/i.test(message)) {
        throw new HttpError(502, message);
      }
      throw error;
    }
  }

  async ocrImage(body: unknown, userId = 'unknown') {
    if (!body || typeof body !== 'object') {
      throw new HttpError(400, 'Request body is required.');
    }

    const request = body as EuaFieldAssistOcrRequest;
    const imageDataUrl = typeof request.imageDataUrl === 'string' ? request.imageDataUrl.trim() : '';
    if (!imageDataUrl) {
      throw new HttpError(400, 'imageDataUrl is required.');
    }

    try {
      const result = await this.visionService.runImageTask({
        imageDataUrl,
        modelId: request.modelId,
        systemPrompt: 'Extract all readable text from the image.',
        userPrompt: request.targetFieldLabel?.trim()
          ? `Return plain text suitable for the form field "${request.targetFieldLabel.trim()}". No markdown.`
          : 'Return plain text only. Preserve line breaks where helpful. No markdown.',
      });

      this.logUsage({
        userId,
        action: 'ocr-image',
        capability: 'eua.imageOcr',
        modelId: result.modelId,
        surface: request.surface,
        ok: true,
      });

      return { text: result.text, modelId: result.modelId };
    } catch (error) {
      this.logUsage({
        userId,
        action: 'ocr-image',
        capability: 'eua.imageOcr',
        surface: request.surface,
        ok: false,
        error: error instanceof Error ? error.message : 'ocr failed',
      });
      throw error;
    }
  }

  async generateAltText(body: unknown, userId = 'unknown') {
    if (!body || typeof body !== 'object') {
      throw new HttpError(400, 'Request body is required.');
    }

    const request = body as EuaFieldAssistAltTextRequest;
    const imageDataUrl = typeof request.imageDataUrl === 'string' ? request.imageDataUrl.trim() : '';
    if (!imageDataUrl) {
      throw new HttpError(400, 'imageDataUrl is required.');
    }

    try {
      const result = await this.visionService.runImageTask({
        imageDataUrl,
        modelId: request.modelId,
        systemPrompt: 'Write concise, accessible alt text for the image.',
        userPrompt: request.contextHint?.trim()
          ? `Context: ${request.contextHint.trim()}\nReturn one or two sentences. No quotes.`
          : 'Return one or two sentences describing the image for screen readers. No quotes.',
      });

      this.logUsage({
        userId,
        action: 'image-alt-text',
        capability: 'eua.imageAltText',
        modelId: result.modelId,
        surface: request.surface,
        ok: true,
      });

      return { altText: result.text.replace(/^["']|["']$/g, '').trim(), modelId: result.modelId };
    } catch (error) {
      this.logUsage({
        userId,
        action: 'image-alt-text',
        capability: 'eua.imageAltText',
        surface: request.surface,
        ok: false,
        error: error instanceof Error ? error.message : 'alt text failed',
      });
      throw error;
    }
  }

  async semanticValidateText(body: unknown, userId = 'unknown') {
    const settings = assertAiSettings();

    if (!body || typeof body !== 'object') {
      throw new HttpError(400, 'Request body is required.');
    }

    const request = body as EuaFieldAssistSemanticValidateRequest;
    const text = typeof request.text === 'string' ? request.text : '';
    const rubric = typeof request.rubric === 'string' ? request.rubric.trim() : '';

    if (!text.trim()) {
      throw new HttpError(400, 'Text to validate is required.');
    }
    if (!rubric) {
      throw new HttpError(400, 'Validation rubric is required.');
    }

    const requestedModelId = typeof request.modelId === 'string' ? request.modelId : undefined;
    const resolvedModelId = resolveFieldAssistChatModelId(settings, requestedModelId);
    if (!resolvedModelId) {
      throw new HttpError(
        503,
        'No chat-capable AI model is configured. Enable a chat model in Settings → AI Models.',
      );
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: buildSemanticValidationSystemPrompt(request.reasonsLanguage),
      },
      {
        role: 'user',
        content: buildSemanticValidationUserPrompt(rubric, text, request.fieldLabel),
      },
    ];

    try {
      const raw = await aiManager.processChat(messages, resolvedModelId);
      const parsed = parseSemanticValidationModelJson(stripAiResponseWrapping(raw));

      this.logUsage({
        userId,
        action: 'semantic-validate',
        capability: 'eua.semanticValidation',
        modelId: resolvedModelId,
        ok: true,
      });

      return {
        valid: parsed.valid,
        reasons: parsed.reasons,
        modelId: resolvedModelId,
      };
    } catch (error) {
      this.logUsage({
        userId,
        action: 'semantic-validate',
        capability: 'eua.semanticValidation',
        ok: false,
        error: error instanceof Error ? error.message : 'semantic validation failed',
      });
      const message = error instanceof Error ? error.message : 'Semantic validation failed.';
      if (/does not support chat/i.test(message)) {
        throw new HttpError(400, message);
      }
      if (/not configured|disabled|not found/i.test(message)) {
        throw new HttpError(503, message);
      }
      throw error;
    }
  }
}
