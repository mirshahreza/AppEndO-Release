import React, { useState } from 'react';
import { BookOpen, Pencil } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  FormSection,
  MarkdownEditDialog,
  MarkdownPreview,
} from '../../../shared/ui';
import type { EdgeModelModelerModel } from '../hooks/useEdgeModelModeler';
import {
  MODELER_CAPTION_CLASS,
  MODELER_EMPTY_STATE_CLASS,
  MODELER_NEUTRAL_ICON_CLASS,
} from '../lib/modelerChipStyles';
import { isModelStoryEmpty } from '../../../shared/lib/edgeModelStory';

const STORY_SECTION_HINT =
  'Use this for business rules, descriptions, relationships to other entities, interactions, flows, and anything else about this entity. Later, the AI assistant will rely on it heavily to understand what responsibilities the application carries at this point.';

type EdgeModelModelerStorySectionProps = {
  modeler: EdgeModelModelerModel;
};

export const EdgeModelModelerStorySection: React.FC<EdgeModelModelerStorySectionProps> = ({
  modeler,
}) => {
  const draft = modeler.draft!;
  const [storyEditOpen, setStoryEditOpen] = useState(false);
  const storyMarkdown = draft.studio.story.trim();
  const storyEmpty = isModelStoryEmpty(storyMarkdown);

  return (
    <>
      <FormSection
        title="Story"
        ink="complement"
        divided
        hint={STORY_SECTION_HINT}
        headerExtra={(
          <AppButton
            intent="secondary"
            size="icon-sm"
            aria-label="Edit story"
            title="Edit story"
            onClick={() => setStoryEditOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </AppButton>
        )}
      >
        {storyEmpty ? (
          <button
            type="button"
            className={MODELER_EMPTY_STATE_CLASS}
            onClick={() => setStoryEditOpen(true)}
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
              <BookOpen className={cn('h-3.5 w-3.5', MODELER_NEUTRAL_ICON_CLASS)} aria-hidden="true" />
              No story yet
            </span>
            <span className={cn('ps-[4px]', MODELER_CAPTION_CLASS)}>
              Add a Markdown description for operators and builders.
            </span>
          </button>
        ) : (
          <MarkdownPreview content={storyMarkdown} />
        )}
      </FormSection>

      <MarkdownEditDialog
        open={storyEditOpen}
        title="Edit story"
        initialValue={draft.studio.story}
        onClose={() => setStoryEditOpen(false)}
        onSave={modeler.updateStudioStory}
        placeholder="Write the model story in Markdown…"
      />
    </>
  );
};
