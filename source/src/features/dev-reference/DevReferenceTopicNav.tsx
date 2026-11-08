import React from 'react';
import {
  DEV_REFERENCE_SUBSECTION_LABEL_CLASS,
} from './devReferenceLayout';
import { cn } from '../../lib/utils';
import { useViewportTier } from '../../shared/lib/useViewportTier';
import {
  WORKSPACE_SECTION_NAV_LINK_ACTIVE_CLASS,
  WORKSPACE_SECTION_NAV_LINK_BASE_CLASS,
} from '../../shared/ui';
import { UiSelect } from '../../shared/ui/HeroFieldControls';
import {
  SERVER_UTILITY_TOPIC_GROUPS,
  SERVER_UTILITY_TOPICS,
  type ServerUtilityTopicId,
} from './devReferenceTopics';

type DevReferenceTopicNavProps = {
  activeTopic: ServerUtilityTopicId;
  onSelect: (topic: ServerUtilityTopicId) => void;
};

/** Neutral active row. */
const TOPIC_ACTIVE_CLASS = 'text-slate-900';

export const DevReferenceTopicNav: React.FC<DevReferenceTopicNavProps> = ({
  activeTopic,
  onSelect,
}) => {
  const viewportTier = useViewportTier();
  const isPhone = viewportTier === 'phone';

  if (isPhone) {
    return (
      <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2.5">
        <label className="flex flex-col gap-[2px] ps-[4px]">
          <span className={DEV_REFERENCE_SUBSECTION_LABEL_CLASS}>Topic</span>
          <UiSelect
            size="sm"
            value={activeTopic}
            onChange={(event) => onSelect(event.target.value as ServerUtilityTopicId)}
            className="w-full"
            ariaLabel="Server utility topic"
          >
            {SERVER_UTILITY_TOPICS.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.label}
              </option>
            ))}
          </UiSelect>
        </label>
      </div>
    );
  }

  return (
    <nav
      className="min-h-0 shrink-0 overflow-y-auto border-e border-slate-200 bg-slate-50 p-3 lg:w-[13rem] xl:w-[15rem]"
      aria-label="Server utility topics"
    >
      <div className="flex flex-col gap-3">
        {SERVER_UTILITY_TOPIC_GROUPS.map((group) => {
          const topics = SERVER_UTILITY_TOPICS.filter((topic) => topic.group === group.id);
          if (topics.length === 0) return null;

          return (
            <div key={group.id}>
              <p className={cn("mb-1", DEV_REFERENCE_SUBSECTION_LABEL_CLASS)}>
                {group.label}
              </p>
              <div className="space-y-0.5">
                {topics.map((topic) => {
                  const isActive = activeTopic === topic.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => onSelect(topic.id)}
                      className={cn(
                        WORKSPACE_SECTION_NAV_LINK_BASE_CLASS,
                        'w-full text-start',
                        isActive
                          ? cn(WORKSPACE_SECTION_NAV_LINK_ACTIVE_CLASS, TOPIC_ACTIVE_CLASS)
                          : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="truncate text-xs">{topic.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
};
