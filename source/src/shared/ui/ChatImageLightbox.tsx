import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CreateEditModalShell } from './CreateEditModalShell';
import { AppButton } from './AppButton';
import { cn } from '../../lib/utils';
import {
  DIALOG_DEEP_NESTED_BACKDROP_Z_CLASS,
  ICON_ACTION_BUTTON_BASE_CLASS,
  ICON_ACTION_VIEW_CLASS,
} from './surfaceClasses';

export type ChatImageGalleryItem = {
  src: string;
  alt: string;
};

export type ChatImageLightboxProps = {
  images: ChatImageGalleryItem[];
  initialIndex?: number;
  onClose: () => void;
};

export const ChatImageLightbox: React.FC<ChatImageLightboxProps> = ({
  images,
  initialIndex = 0,
  onClose,
}) => {
  const safeImages = useMemo(
    () => images.filter((image) => Boolean(image.src)),
    [images],
  );
  const [activeIndex, setActiveIndex] = useState(() => {
    if (!safeImages.length) return 0;
    return Math.min(Math.max(initialIndex, 0), safeImages.length - 1);
  });

  useEffect(() => {
    if (!safeImages.length) return;
    const nextIndex = Math.min(Math.max(initialIndex, 0), safeImages.length - 1);
    setActiveIndex(nextIndex);
  }, [initialIndex, safeImages.length]);

  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < safeImages.length - 1;

  const goPrev = useCallback(() => {
    setActiveIndex((current) => (current > 0 ? current - 1 : current));
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((current) => (
      current < safeImages.length - 1 ? current + 1 : current
    ));
  }, [safeImages.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev]);

  const active = safeImages[activeIndex] ?? safeImages[0];
  if (!active) return null;

  return (
    <CreateEditModalShell
      size="maximized"
      title={active.alt || 'Image'}
      onClose={onClose}
      onBackdropClick={onClose}
      gradient={false}
      backdropClassName={`!${DIALOG_DEEP_NESTED_BACKDROP_Z_CLASS}`}
      bodyOuterClassName="flex min-h-0 flex-1 flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden !p-3"
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto">
        {canGoPrev ? (
          <AppButton
            type="button"
            size="icon-sm"
            className={cn(
              ICON_ACTION_BUTTON_BASE_CLASS,
              ICON_ACTION_VIEW_CLASS,
              'absolute start-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 bg-white/90 shadow-sm',
            )}
            aria-label="Previous image"
            title="Previous image"
            onClick={goPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </AppButton>
        ) : null}
        <img
          src={active.src}
          alt={active.alt || 'Image'}
          className="h-auto max-h-full w-auto max-w-full object-contain"
        />
        {canGoNext ? (
          <AppButton
            type="button"
            size="icon-sm"
            className={cn(
              ICON_ACTION_BUTTON_BASE_CLASS,
              ICON_ACTION_VIEW_CLASS,
              'absolute end-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 bg-white/90 shadow-sm',
            )}
            aria-label="Next image"
            title="Next image"
            onClick={goNext}
          >
            <ChevronRight className="h-4 w-4" />
          </AppButton>
        ) : null}
      </div>
      {safeImages.length > 1 ? (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-slate-200 pt-3">
          {safeImages.map((image, index) => (
            <button
              key={`${image.src.slice(0, 48)}-${index}`}
              type="button"
              className={cn(
                'h-[50px] overflow-hidden rounded-md border p-0 transition-shadow',
                index === activeIndex
                  ? 'border-primary-500 ring-2 ring-primary-500/30'
                  : 'border-slate-200/80 hover:border-slate-300',
              )}
              title={image.alt}
              aria-label={`Show ${image.alt || `image ${index + 1}`}`}
              aria-current={index === activeIndex ? 'true' : undefined}
              onClick={() => setActiveIndex(index)}
            >
              <img
                src={image.src}
                alt={image.alt}
                className="h-full w-auto max-w-none object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </CreateEditModalShell>
  );
};
