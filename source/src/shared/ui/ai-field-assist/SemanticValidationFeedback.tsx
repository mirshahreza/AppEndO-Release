import React from 'react';

export type SemanticValidationFeedbackProps = {
  reasons: string[];
  validating?: boolean;
  className?: string;
};

export const SemanticValidationFeedback: React.FC<SemanticValidationFeedbackProps> = ({
  reasons,
  validating = false,
  className = '',
}) => {
  if (validating) {
    return (
      <p className={`text-xs text-slate-500 ${className}`.trim()} role="status">
        Checking text…
      </p>
    );
  }

  if (!reasons.length) {
    return null;
  }

  return (
    <div
      className={`rounded-md border border-rose-200/90 bg-rose-50 px-2.5 py-2 text-xs font-medium leading-relaxed text-rose-950 ${className}`.trim()}
      role="alert"
    >
      <ul className="list-disc space-y-1 ps-4">
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  );
};
