import React from 'react';
import { MessageSquareReply, MessageSquareShare } from 'lucide-react';
import { cn } from '../../lib/utils';

export type PersonalInboxCorrespondenceIconProps = {
  className?: string;
  strokeWidth?: number;
};

/** Inbox reply — message bubble with return arrow (paired with forward). */
export const PersonalInboxReplyIcon: React.FC<PersonalInboxCorrespondenceIconProps> = ({
  className,
  strokeWidth = 1.75,
}) => (
  <MessageSquareReply
    className={cn('h-4 w-4 shrink-0', className)}
    strokeWidth={strokeWidth}
    aria-hidden
  />
);

/** Inbox forward — message bubble with share/send-to-other (paired with reply). */
export const PersonalInboxForwardIcon: React.FC<PersonalInboxCorrespondenceIconProps> = ({
  className,
  strokeWidth = 1.75,
}) => (
  <MessageSquareShare
    className={cn('h-4 w-4 shrink-0', className)}
    strokeWidth={strokeWidth}
    aria-hidden
  />
);
