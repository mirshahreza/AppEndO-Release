import React from 'react';
import { cn } from '../../lib/utils';
import {
  isCommandHighlightLanguage,
  tokenizeCommandCode,
  type CommandHighlightTokenType,
} from './highlightCommandCode';

const TOKEN_CLASS: Record<CommandHighlightTokenType, string> = {
  command: 'font-semibold text-cyan-700',
  flag: 'text-violet-700',
  string: 'text-emerald-700',
  comment: 'italic text-slate-400',
  operator: 'font-semibold text-amber-600',
  path: 'text-sky-700',
  text: 'text-slate-800',
};

type HighlightedCommandCodeProps = {
  code: string;
  language?: string;
  className?: string;
};

export const HighlightedCommandCode: React.FC<HighlightedCommandCodeProps> = ({
  code,
  language = '',
  className,
}) => {
  if (!isCommandHighlightLanguage(language)) {
    return <code className={className}>{code}</code>;
  }

  const tokens = tokenizeCommandCode(code);
  return (
    <code className={className}>
      {tokens.map((token, index) => (
        <span key={`${token.type}-${index}`} className={TOKEN_CLASS[token.type]}>
          {token.value}
        </span>
      ))}
    </code>
  );
};
