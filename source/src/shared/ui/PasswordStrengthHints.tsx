import React, { useMemo } from 'react';
import { Check, Circle } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  evaluatePasswordStrength,
  passwordStrengthBarClass,
  passwordStrengthTextClass,
} from '../lib/passwordStrength';

export type PasswordStrengthHintsProps = {
  password: string;
};

export const PasswordStrengthHints: React.FC<PasswordStrengthHintsProps> = ({ password }) => {
  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);
  const fillPercent = Math.round((strength.score / strength.maxScore) * 100);

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 ps-[4px] text-[10px] leading-none">
      <span className="shrink-0 font-semibold uppercase tracking-wider text-slate-500">Strength</span>
      <div className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn('h-full rounded-full transition-all duration-200', passwordStrengthBarClass(strength.label))}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      <span className={cn('shrink-0 font-semibold', passwordStrengthTextClass(strength.label))}>
        {strength.label}
      </span>
      <div className="flex flex-wrap items-center gap-2.5">
        {strength.criteria.map((criterion) => (
          <span
            key={criterion.id}
            title={criterion.label}
            className="inline-flex items-center gap-0.5"
          >
            {criterion.met ? (
              <Check className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <Circle className="h-3 w-3 shrink-0 text-slate-300" aria-hidden />
            )}
            <span className={criterion.met ? 'font-medium text-slate-600' : 'text-slate-400'}>
              {criterion.shortLabel}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};
