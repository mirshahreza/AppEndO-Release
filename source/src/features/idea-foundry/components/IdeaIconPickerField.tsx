import React, { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { NavigationIcon } from '../../../shared/lib/navigationIcons/NavigationIcon';
import { formatNavigationIconRefLabel } from '../../../shared/lib/navigationIcons/navigationIconRef';
import { AppButton, FormField, NavigationIconPickerDialog } from '../../../shared/ui';
import { DEFAULT_IDEA_ICON, resolveIdeaIconRef } from '../ideaFoundryCatalog';

type IdeaIconPickerFieldProps = {
  value: string | null;
  onChange: (icon: string) => void;
};

export const IdeaIconPickerField: React.FC<IdeaIconPickerFieldProps> = ({
  value,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const resolved = resolveIdeaIconRef(value);
  const chosen = Boolean(value?.trim());
  const label = chosen
    ? formatNavigationIconRefLabel(resolved)
    : `${formatNavigationIconRefLabel(DEFAULT_IDEA_ICON)} (default)`;

  return (
    <>
      <FormField
        label="Icon"
        layout="side"
        hint="Shown on the board tile. Optional — Lightbulb is used when none is chosen."
        className="min-w-0 w-full flex-1"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white">
            <NavigationIcon iconRef={resolved} className="h-4 w-4 text-slate-700" />
          </span>
          <AppButton
            type="button"
            size="sm"
            intent="secondary"
            className="flex min-w-0 flex-1 justify-start"
            aria-label="Choose idea icon"
            onClick={() => setOpen(true)}
          >
            <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate font-mono text-[11px] leading-none">{label}</span>
          </AppButton>
        </div>
      </FormField>
      <NavigationIconPickerDialog
        open={open}
        selectedIcon={value ?? undefined}
        onClose={() => setOpen(false)}
        onSelect={(icon) => {
          onChange(icon);
          setOpen(false);
        }}
      />
    </>
  );
};
