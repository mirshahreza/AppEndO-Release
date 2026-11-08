import React from 'react';
import { AppButton, QueryErrorPanel } from '../../../shared/ui';
import {
  IDEA_MATURITY_VALUES,
  type ProductIdeaListItem,
} from '../../../shared/api/contracts/idea-foundry/types';
import { IDEA_MATURITY_CHROME, IDEA_MATURITY_LABEL } from '../ideaFoundryCatalog';
import { IdeaFoundryCard } from './IdeaFoundryCard';

type IdeaFoundryBoardProps = {
  items: ProductIdeaListItem[];
  isLoading: boolean;
  loadError: string | null;
  onRetry: () => void;
  isRetrying: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
};

export const IdeaFoundryBoard: React.FC<IdeaFoundryBoardProps> = ({
  items,
  isLoading,
  loadError,
  onRetry,
  isRetrying,
  onCreate,
  onOpen,
  onScroll,
}) => (
  <div className="min-h-0 flex-1 overflow-auto" data-testid="idea-foundry-board" onScroll={onScroll}>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 px-5 py-2">
      <p className="text-[11px] font-normal text-slate-400">
        Hue follows stage
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {IDEA_MATURITY_VALUES.map((maturity) => (
          <span key={maturity} className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <span className={`h-2 w-2 rounded-sm ${IDEA_MATURITY_CHROME[maturity].barClass}`} aria-hidden />
            {IDEA_MATURITY_LABEL[maturity]}
          </span>
        ))}
      </div>
    </div>

    {isLoading ? (
      <div className="flex h-40 items-center justify-center text-sm font-normal text-slate-400">
        Loading ideas…
      </div>
    ) : loadError ? (
      <QueryErrorPanel
        message="Failed to load ideas."
        detail={loadError}
        onRetry={onRetry}
        isRetrying={isRetrying}
      />
    ) : items.length === 0 ? (
      <div className="flex h-56 flex-col items-center justify-center gap-2 px-5 text-center">
        <p className="text-sm font-normal text-slate-400">No ideas on the floor yet.</p>
        <p className="max-w-md text-xs font-normal text-slate-500">
          Register a spark. The board tints tiles by stage.
        </p>
        <AppButton intent="create" size="sm" className="mt-1" onClick={onCreate}>
          Register the first idea
        </AppButton>
      </div>
    ) : (
      <div className="grid grid-cols-1 grid-flow-dense items-stretch gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <IdeaFoundryCard key={item.id} item={item} onOpen={onOpen} />
        ))}
      </div>
    )}
  </div>
);
