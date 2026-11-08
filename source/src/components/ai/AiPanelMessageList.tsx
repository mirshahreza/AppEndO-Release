import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  CHAT_MESSAGE_ESTIMATE_PX,
  CHAT_MESSAGE_VIRTUALIZE_THRESHOLD,
  GRID_VIRTUAL_OVERSCAN,
} from '../../shared/lib/gridVirtualizationConstants';

type AiPanelMessageListProps = {
  messageCount: number;
  className?: string;
  renderMessage: (index: number) => React.ReactNode;
  children?: React.ReactNode;
};

const AiPanelMessageListPlain: React.FC<AiPanelMessageListProps> = ({
  messageCount,
  className,
  renderMessage,
  children,
}) => (
  <div className={className}>
    {Array.from({ length: messageCount }, (_, index) => (
      <div key={index} className={index < messageCount - 1 ? 'mb-4' : undefined}>
        {renderMessage(index)}
      </div>
    ))}
    {children}
  </div>
);

const AiPanelMessageListVirtual: React.FC<AiPanelMessageListProps> = ({
  messageCount,
  className,
  renderMessage,
  children,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: messageCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CHAT_MESSAGE_ESTIMATE_PX,
    overscan: GRID_VIRTUAL_OVERSCAN,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0
    ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
    : 0;

  return (
    <div ref={scrollRef} className={className}>
      <div style={{ paddingTop, paddingBottom }}>
        {virtualRows.map((virtualRow) => (
          <div
            key={virtualRow.key}
            ref={rowVirtualizer.measureElement}
            data-index={virtualRow.index}
            className="mb-4"
          >
            {renderMessage(virtualRow.index)}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
};

export const AiPanelMessageList: React.FC<AiPanelMessageListProps> = (props) => (
  props.messageCount >= CHAT_MESSAGE_VIRTUALIZE_THRESHOLD
    ? <AiPanelMessageListVirtual {...props} />
    : <AiPanelMessageListPlain {...props} />
);
