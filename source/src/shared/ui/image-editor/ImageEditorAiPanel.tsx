import React, { useMemo, useRef } from 'react';
import { apiFetch } from '../../api/client';
import { ensureDataUrlForAiEdit } from '../../lib/imageEditor';
import { tryLocalImageEditPrompt } from '../../lib/imageEditorLocalPrompt';
import { isAiModelImageEditorOutputCapable } from '../../api/contracts/ai/constants';
import { useAvailableAiModelsQuery } from '../../api/queries/aiModels';
import { UiContextChatPanel, type UiContextChatSendRequest } from '../UiContextChatPanel';
import { WORKSPACE_SPLIT_PANEL_KEYS } from '../workspaceSplitStorage';

type ImageEditorAiPanelProps = {
  currentDataUrl: string;
  onApplyImage: (dataUrl: string, label: string) => void;
};

const NO_IMAGE_RESPONSE_TEXT = 'No edited image was returned. Use GPT-5.5, gpt-image-1, or rotate/brighten/upscale phrasing for instant canvas edits.';

export const ImageEditorAiPanel: React.FC<ImageEditorAiPanelProps> = ({
  currentDataUrl,
  onApplyImage,
}) => {
  const modelsQuery = useAvailableAiModelsQuery();
  const currentDataUrlRef = useRef(currentDataUrl);
  currentDataUrlRef.current = currentDataUrl;
  const onApplyImageRef = useRef(onApplyImage);
  onApplyImageRef.current = onApplyImage;

  const outputModels = useMemo(
    () => (modelsQuery.data?.models ?? []).filter((model) => isAiModelImageEditorOutputCapable(model)),
    [modelsQuery.data?.models],
  );

  const handleSend = async ({ prompt, modelId, history }: UiContextChatSendRequest) => {
    const localEdit = await tryLocalImageEditPrompt(prompt, currentDataUrlRef.current);
    if (localEdit) {
      onApplyImageRef.current(localEdit.dataUrl, localEdit.label);
      return { text: `Applied to canvas: ${localEdit.label}.` };
    }

    const imageDataUrl = await ensureDataUrlForAiEdit(currentDataUrlRef.current);
    const response = await apiFetch('/api/ai/image/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        imageDataUrl,
        modelId,
        history,
      }),
    });

    const data = await response.json().catch(() => ({})) as {
      success?: boolean;
      text?: string;
      imageDataUrl?: string | null;
      canApply?: boolean;
      error?: string;
    };

    if (!response.ok || !data.success) {
      throw new Error(data.error || response.statusText || 'AI edit request failed.');
    }

    if (data.imageDataUrl) {
      onApplyImageRef.current(data.imageDataUrl, 'AI edit');
      return { text: 'Applied to canvas: AI edit.' };
    }

    const fallbackText = data.text?.trim();
    return {
      text: fallbackText && fallbackText !== NO_IMAGE_RESPONSE_TEXT
        ? `${NO_IMAGE_RESPONSE_TEXT}\n\n${fallbackText}`
        : NO_IMAGE_RESPONSE_TEXT,
    };
  };

  return (
    <UiContextChatPanel
      welcomeText="Describe a creative edit (remove background, professional headshot, etc.). The canvas image is sent to an image-generation model and the result is applied automatically. For rotate/brighten/upscale, just describe it."
      placeholder="Describe the edit you want..."
      sendingLabel="Generating edit..."
      promptAriaLabel="AI edit prompt"
      models={outputModels.map((model) => ({ id: model.id, name: model.name }))}
      defaultModelId={modelsQuery.data?.defaultModelId}
      modelsLoading={modelsQuery.isLoading}
      aiEnabled={modelsQuery.data?.enabled ?? false}
      emptyModelsBanner="Enable an image-editing model (for example GPT-5.5, gpt-image-1, or dall-e-2) in AI settings."
      panelKey={WORKSPACE_SPLIT_PANEL_KEYS.imageEditorAiPanel}
      sessionHistory={false}
      onSend={handleSend}
    />
  );
};
