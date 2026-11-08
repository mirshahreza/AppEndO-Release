import React, { useCallback, useState } from 'react';
import { FileText, Sparkles } from 'lucide-react';
import { generateImageAltText, ocrImageText } from '../../api/queries/euaFieldAssist';
import { useEuaDefaultModelId, useEuaFieldAssistReady, useIsEuaCapabilityEnabled } from './useEuaCapability';
import { AppButton } from '../AppButton';

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image.'));
    reader.readAsDataURL(file);
  });
}

export type AiImageFieldAssistActionsProps = {
  file: File | null;
  disabled?: boolean;
  targetFieldLabel?: string;
  onOcrText?: (text: string) => void;
  onAltText?: (altText: string) => void;
  className?: string;
};

export const AiImageFieldAssistActions: React.FC<AiImageFieldAssistActionsProps> = ({
  file,
  disabled = false,
  targetFieldLabel,
  onOcrText,
  onAltText,
  className,
}) => {
  const ready = useEuaFieldAssistReady();
  const modelId = useEuaDefaultModelId();
  const ocrEnabled = useIsEuaCapabilityEnabled('eua.imageOcr');
  const altEnabled = useIsEuaCapabilityEnabled('eua.imageAltText');
  const [isRunning, setIsRunning] = useState<'ocr' | 'alt' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRun = Boolean(file) && ready && Boolean(modelId) && !disabled;

  const runOcr = useCallback(async () => {
    if (!canRun || !file || !onOcrText) {
      return;
    }
    setIsRunning('ocr');
    setError(null);
    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const result = await ocrImageText({
        imageDataUrl,
        targetFieldLabel,
        modelId,
        surface: 'admin',
      });
      onOcrText(result.text);
    } catch (ocrError) {
      setError(ocrError instanceof Error ? ocrError.message : 'OCR failed.');
    } finally {
      setIsRunning(null);
    }
  }, [canRun, file, modelId, onOcrText, targetFieldLabel]);

  const runAlt = useCallback(async () => {
    if (!canRun || !file || !onAltText) {
      return;
    }
    setIsRunning('alt');
    setError(null);
    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const result = await generateImageAltText({
        imageDataUrl,
        contextHint: targetFieldLabel,
        modelId,
        surface: 'admin',
      });
      onAltText(result.altText);
    } catch (altError) {
      setError(altError instanceof Error ? altError.message : 'Alt text failed.');
    } finally {
      setIsRunning(null);
    }
  }, [canRun, file, modelId, onAltText, targetFieldLabel]);

  if (!ocrEnabled && !altEnabled) {
    return null;
  }

  return (
    <div className={className ?? 'flex flex-wrap items-center gap-2'}>
      {ocrEnabled && onOcrText ? (
        <AppButton intent="utility" size="sm" disabled={!canRun || isRunning !== null} onClick={() => { void runOcr(); }}>
          <FileText className="h-3.5 w-3.5" aria-hidden />
          {isRunning === 'ocr' ? 'Extracting…' : 'Extract text'}
        </AppButton>
      ) : null}
      {altEnabled && onAltText ? (
        <AppButton intent="utility" size="sm" disabled={!canRun || isRunning !== null} onClick={() => { void runAlt(); }}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {isRunning === 'alt' ? 'Generating…' : 'Suggest alt text'}
        </AppButton>
      ) : null}
      {error ? <p className="text-[11px] text-rose-600 ps-[4px]">{error}</p> : null}
    </div>
  );
};
