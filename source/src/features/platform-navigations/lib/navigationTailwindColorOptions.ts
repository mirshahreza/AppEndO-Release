export type NavigationTailwindColorOption = {
  value: string;
  label: string;
};

export const NAV_TAILWIND_COLOR_OPTIONS: NavigationTailwindColorOption[] = [
  { value: 'text-text-nav', label: 'Nav text' },
  { value: 'text-text-nav-icon', label: 'Nav icon' },
  { value: 'text-slate-500', label: 'Slate' },
  { value: 'text-indigo-500', label: 'Indigo' },
  { value: 'text-emerald-500', label: 'Emerald' },
  { value: 'text-blue-500', label: 'Blue' },
  { value: 'text-cyan-500', label: 'Cyan' },
  { value: 'text-cyan-600', label: 'Cyan dark' },
  { value: 'text-violet-500', label: 'Violet' },
  { value: 'text-purple-500', label: 'Purple' },
  { value: 'text-amber-500', label: 'Amber' },
  { value: 'text-rose-500', label: 'Rose' },
];

export const normalizeNavColor = (
  raw: string,
  defaultColor: string,
): string | undefined => {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === defaultColor) {
    return undefined;
  }
  return trimmed;
};

export const resolveNavColor = (
  value: string | undefined | null,
  defaultColor: string,
): string => String(value ?? '').trim() || defaultColor;

export const resolveNavigationColorLabel = (value: string): string => {
  const match = NAV_TAILWIND_COLOR_OPTIONS.find((option) => option.value === value);
  if (match) {
    return match.label;
  }
  return value.replace(/^text-/, '');
};

export const resolveNavigationColorOptions = (
  currentValue: string,
): NavigationTailwindColorOption[] => {
  if (NAV_TAILWIND_COLOR_OPTIONS.some((option) => option.value === currentValue)) {
    return NAV_TAILWIND_COLOR_OPTIONS;
  }

  return [
    { value: currentValue, label: resolveNavigationColorLabel(currentValue) },
    ...NAV_TAILWIND_COLOR_OPTIONS,
  ];
};
