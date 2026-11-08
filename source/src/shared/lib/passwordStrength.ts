export type PasswordStrengthLabel = 'Weak' | 'Fair' | 'Good' | 'Strong';

export type PasswordCriterion = {
  id: string;
  label: string;
  shortLabel: string;
  met: boolean;
};

export type PasswordStrength = {
  score: number;
  maxScore: number;
  label: PasswordStrengthLabel;
  criteria: PasswordCriterion[];
};

const CRITERIA_DEFS = [
  { id: 'length', label: 'At least 8 characters', shortLabel: '8+', test: (value: string) => value.length >= 8 },
  { id: 'lower', label: 'Lowercase letter (a–z)', shortLabel: 'a-z', test: (value: string) => /[a-z]/.test(value) },
  { id: 'upper', label: 'Uppercase letter (A–Z)', shortLabel: 'A-Z', test: (value: string) => /[A-Z]/.test(value) },
  { id: 'digit', label: 'Number (0–9)', shortLabel: '0-9', test: (value: string) => /\d/.test(value) },
  { id: 'symbol', label: 'Symbol (!@#$…)', shortLabel: '#', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

const labelForScore = (score: number): PasswordStrengthLabel => {
  if (score <= 1) return 'Weak';
  if (score <= 2) return 'Fair';
  if (score <= 4) return 'Good';
  return 'Strong';
};

export const evaluatePasswordStrength = (password: string): PasswordStrength => {
  const criteria = CRITERIA_DEFS.map((item) => ({
    id: item.id,
    label: item.label,
    shortLabel: item.shortLabel,
    met: item.test(password),
  }));
  const score = criteria.filter((item) => item.met).length;

  return {
    score,
    maxScore: criteria.length,
    label: labelForScore(score),
    criteria,
  };
};

export const isPasswordStrong = (password: string): boolean =>
  evaluatePasswordStrength(password).label === 'Strong';

export const passwordStrengthBarClass = (label: PasswordStrengthLabel): string => {
  switch (label) {
    case 'Weak':
      return 'bg-rose-500';
    case 'Fair':
      return 'bg-amber-500';
    case 'Good':
      return 'bg-emerald-500';
    case 'Strong':
      return 'bg-emerald-600';
    default:
      return 'bg-slate-300';
  }
};

export const passwordStrengthTextClass = (label: PasswordStrengthLabel): string => {
  switch (label) {
    case 'Weak':
      return 'text-rose-700';
    case 'Fair':
      return 'text-amber-700';
    case 'Good':
      return 'text-emerald-700';
    case 'Strong':
      return 'text-emerald-800';
    default:
      return 'text-slate-600';
  }
};
