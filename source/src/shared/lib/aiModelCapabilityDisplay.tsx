import React from 'react';
import {
  Eye,
  Image,
  MessageSquare,
  Mic,
  Volume2,
  Wrench,
} from 'lucide-react';
import {
  AI_CAPABILITY_GROUPS,
  AI_CAPABILITY_SEPARATOR_CLASS,
  AI_MODEL_EMBEDDING_ONLY_DISPLAY_LABEL,
  isAiModelEmbeddingOnly,
} from '../api/contracts/ai/constants';
import type { AiModelCapabilities } from '../api/contracts/ai/types';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { lookupEmbeddedEnglish } from '../../core/culture/embeddedTranslationBundles';
import { cn } from '../../lib/utils';

const CAPABILITY_ICON_CLASS = 'h-3.5 w-3.5';

export const AI_MODEL_EMBEDDING_ONLY_LABEL_CLASS =
  'inline-flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-600';

type DisplayCapabilityKey = (typeof AI_CAPABILITY_GROUPS)[number][number];

const AI_CAPABILITY_ICONS: Record<DisplayCapabilityKey, React.ReactNode> = {
  chat: <MessageSquare className={CAPABILITY_ICON_CLASS} />,
  vision: <Eye className={CAPABILITY_ICON_CLASS} />,
  imageGeneration: <Image className={CAPABILITY_ICON_CLASS} />,
  speechToText: <Mic className={CAPABILITY_ICON_CLASS} />,
  textToSpeech: <Volume2 className={CAPABILITY_ICON_CLASS} />,
  tools: <Wrench className={CAPABILITY_ICON_CLASS} />,
};

export const AiCapabilityGroupSeparator = ({
  className,
}: {
  className?: string;
}) => (
  <span className={cn(AI_CAPABILITY_SEPARATOR_CLASS, className)} aria-hidden />
);

export const renderAiModelEmbeddingOnlyLabel = () => (
  <span className={AI_MODEL_EMBEDDING_ONLY_LABEL_CLASS}>
    {AI_MODEL_EMBEDDING_ONLY_DISPLAY_LABEL}
  </span>
);

/** Grid cell: semantic icon per capability; embedding-only models show a text label instead. */
export const renderAiModelCapabilitiesCell = (
  capabilities: AiModelCapabilities,
  t?: TranslationFn,
) => {
  const labelFor = (key: DisplayCapabilityKey) => {
    const translationKey = `settings.ai.capability.${key}`;
    return t ? t(translationKey) : lookupEmbeddedEnglish(translationKey);
  };

  if (isAiModelEmbeddingOnly({ capabilities })) {
    return renderAiModelEmbeddingOnlyLabel();
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {AI_CAPABILITY_GROUPS.map((group, groupIndex) => (
        <React.Fragment key={group.join('-')}>
          {groupIndex > 0 ? <AiCapabilityGroupSeparator /> : null}
          {group.map((key) => {
            const enabled = capabilities[key];
            const label = labelFor(key);
            const notSupported = t
              ? t('settings.ai.capability.notSupported').replace('{label}', label)
              : `${label} (not supported)`;
            const notSupportedAria = t
              ? t('settings.ai.capability.notSupportedAria').replace('{label}', label)
              : `${label} not supported`;

            return (
              <span
                key={key}
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center',
                  enabled ? 'text-emerald-600' : 'text-slate-300',
                )}
                title={enabled ? label : notSupported}
                aria-label={enabled ? label : notSupportedAria}
              >
                {AI_CAPABILITY_ICONS[key]}
              </span>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};
