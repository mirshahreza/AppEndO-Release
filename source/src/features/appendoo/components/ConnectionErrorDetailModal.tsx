import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { AppButton, AppDialogShell, DialogBody, DialogPrimaryHeader } from '../../../shared/ui';
import type { ClassifiedConnectionError } from '../../../shared/lib/appendoo/classifyConnectionError';

type ConnectionErrorDetailModalProps = {
  error: ClassifiedConnectionError;
  onClose: () => void;
};

export const ConnectionErrorDetailModal: React.FC<ConnectionErrorDetailModalProps> = ({ error, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(error.detail);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access may be blocked; fail silently.
    }
  };

  return (
    <AppDialogShell size="maximized" onClose={onClose} onBackdropClick={onClose} ariaLabel="Connection error detail">
      <DialogPrimaryHeader
        title="Connection error detail"
        onClose={onClose}
        titleClassName="text-sm"
        headerExtra={(
          <AppButton size="icon-sm" onClick={() => { void handleCopy(); }} title="Copy error detail">
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </AppButton>
        )}
      />
      <DialogBody
        gradient
        outerClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        innerClassName="flex min-h-0 flex-1 flex-col overflow-hidden !p-3"
      >
        <div className="mb-2 text-sm text-slate-700">{error.friendlyMessage}</div>
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800">
          {error.detail}
        </pre>
      </DialogBody>
    </AppDialogShell>
  );
};
