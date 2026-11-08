import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AppButton } from './AppButton';

export type UiSnippetProps = {
  code: string;
  language?: string;
  showCopy?: boolean;
  className?: string;
};

/** Read-only code or command chrome with an optional copy control. */
export const UiSnippet: React.FC<UiSnippetProps> = ({
  code,
  language,
  showCopy = true,
  className,
}) => {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!code || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 1500);
    } catch {
      // Clipboard access may be blocked; fail silently.
    }
  }, [code]);

  return (
    <div
      dir="ltr"
      className={cn(
        'flex min-w-0 max-w-xl items-stretch overflow-hidden rounded-lg border border-slate-200 bg-slate-50',
        className,
      )}
    >
      <div className="min-w-0 flex-1 overflow-x-auto px-3 py-2">
        {language ? (
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-cyan-700">{language}</p>
        ) : null}
        <pre className="font-mono text-[12px] leading-5 text-slate-800">{code}</pre>
      </div>
      {showCopy ? (
        <AppButton
          type="button"
          intent="utility"
          size="sm"
          className="m-1 shrink-0 self-start"
          aria-label={copied ? 'Copied' : 'Copy'}
          onClick={() => {
            void handleCopy();
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </AppButton>
      ) : null}
    </div>
  );
};
