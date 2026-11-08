import React from 'react';
import { Pencil } from 'lucide-react';
import { AppButton } from '../AppButton';
import { useCanEditVocabContext } from '../../lib/useCanEditVocabContext';
import { useIsEuaCapabilityEnabled } from './useEuaCapability';

export type SemanticValidationGuidanceBannerProps = {
  guidance: string;
  onEditGuidance?: () => void;
  className?: string;
};

export const SemanticValidationGuidanceBanner: React.FC<SemanticValidationGuidanceBannerProps> = ({
  guidance,
  onEditGuidance,
  className = '',
}) => {
  const trimmed = guidance.trim();
  const canAuthor = useCanEditVocabContext();
  const authoringEnabled = useIsEuaCapabilityEnabled('eua.vocabContextAuthoring');
  const showEdit = Boolean(onEditGuidance && canAuthor && authoringEnabled);

  if (!trimmed && !showEdit) {
    return null;
  }

  return (
    <div
      className={`mb-3 flex items-start gap-2 rounded-md border border-amber-200/90 bg-amber-50 px-2.5 py-2 text-xs font-semibold leading-relaxed text-amber-950 ${className}`.trim()}
      role="status"
    >
      <div className="min-w-0 flex-1">{trimmed || 'No guidance configured for this option.'}</div>
      {showEdit ? (
        <AppButton
          intent="utility"
          size="sm"
          className="shrink-0"
          ariaLabel="Edit guidance and validation rubric"
          onClick={onEditGuidance}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </AppButton>
      ) : null}
    </div>
  );
};
