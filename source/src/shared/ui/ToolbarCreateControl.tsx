import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { AppButton } from './AppButton';
import { AppSplitButton, SplitButtonMenuItem } from './AppSplitButton';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';

export type ToolbarCreateItem = {
  id: string;
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  guideHint?: string;
};

export type ToolbarCreateControlProps = {
  items: readonly ToolbarCreateItem[];
  'data-testid'?: string;
  triggerAriaLabel?: string;
  menuAriaLabel?: string;
};

export const ToolbarCreateControl: React.FC<ToolbarCreateControlProps> = ({
  items,
  'data-testid': testId = 'toolbar-create',
  triggerAriaLabel,
  menuAriaLabel = 'Create options',
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  if (items.length === 0) {
    return null;
  }

  const resolvedTriggerLabel = triggerAriaLabel
    ?? (items.length > 1 ? 'Create' : (items[0]?.label ?? 'Create'));

  if (items.length === 1) {
    const item = items[0]!;
    const guideProps = item.guideHint
      ? pageGuideLocalProps(item.label, item.guideHint, 16)
      : pageGuideLocalProps(
        resolvedTriggerLabel,
        PAGE_GUIDE_EN['pageGuide.page.create.hint'],
        16,
      );

    return (
      <AppButton
        type="button"
        intent="secondary"
        size="icon-md"
        onClick={item.onClick}
        aria-label={item.label}
        title={item.label}
        data-testid={testId}
        {...guideProps}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </AppButton>
    );
  }

  return (
    <span data-testid={testId}>
      <AppSplitButton
        intent="secondary"
        size="sm"
        icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
        menuFixed
        menuAlign="end"
        isOpen={menuOpen}
        onOpenChange={setMenuOpen}
        triggerAriaLabel={resolvedTriggerLabel}
        menuAriaLabel={menuAriaLabel}
        {...pageGuideLocalProps(
          resolvedTriggerLabel,
          PAGE_GUIDE_EN['pageGuide.page.createMenu.hint'],
          16,
        )}
      >
        {items.map((item) => (
          <SplitButtonMenuItem
            key={item.id}
            icon={item.icon}
            onClick={() => {
              setMenuOpen(false);
              item.onClick();
            }}
          >
            {item.label}
          </SplitButtonMenuItem>
        ))}
      </AppSplitButton>
    </span>
  );
};
