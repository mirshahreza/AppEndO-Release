import * as React from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AppButton } from '../AppButton';

export type ShellBackToTopProps = {
  scrollOwner?: HTMLElement | Window | null;
  label?: string;
  threshold?: number | 'viewport';
  visible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  className?: string;
};

export const ShellBackToTop: React.FC<ShellBackToTopProps> = ({
  scrollOwner,
  label = 'Back to top',
  threshold = 'viewport',
  visible,
  onVisibilityChange,
  className,
}) => {
  const [observedVisible, setObservedVisible] = React.useState(false);
  const isVisible = visible ?? observedVisible;

  React.useEffect(() => {
    const owner = scrollOwner ?? window;
    const readOffset = () => owner instanceof Window ? owner.scrollY : owner.scrollTop;
    const readViewport = () => owner instanceof Window ? owner.innerHeight : owner.clientHeight;
    const update = () => {
      const next = readOffset() >= (threshold === 'viewport' ? readViewport() : threshold);
      setObservedVisible(next);
      onVisibilityChange?.(next);
    };
    update();
    owner.addEventListener('scroll', update, { passive: true });
    return () => owner.removeEventListener('scroll', update);
  }, [onVisibilityChange, scrollOwner, threshold]);

  if (!isVisible) return null;
  return (
    <AppButton
      aria-label={label}
      onClick={() => {
        const owner = scrollOwner ?? window;
        const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
        owner.scrollTo({ top: 0, behavior });
      }}
      className={cn(
        'fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] end-[calc(1rem+env(safe-area-inset-right))] z-40 inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        className,
      )}
      data-shell-back-to-top=""
    >
      <ArrowUp aria-hidden className="h-3.5 w-3.5" />
    </AppButton>
  );
};
