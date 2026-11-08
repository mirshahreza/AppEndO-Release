import React, { useMemo, useState } from 'react';
import { ChatImageLightbox } from '../../../shared/ui/ChatImageLightbox';
import { SiteWindowFrame, SiteWindowPlaceholder } from './SiteWindowFrame';

export type SiteSlide = {
  index: string;
  title: string;
  copy: string;
  imageUrl?: string | null;
};

type SiteSlidesProps = {
  slides: readonly SiteSlide[];
};

/**
 * The hero's flagship screenshot: a segmented tab switcher over one large
 * window-frame panel, instead of an autoplaying carousel. This gives each
 * real Studio screenshot room to actually be legible.
 */
export const SiteSlides: React.FC<SiteSlidesProps> = ({ slides }) => {
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const count = slides.length;
  const gallery = useMemo(
    () => slides
      .filter((slide) => Boolean(slide.imageUrl))
      .map((slide) => ({ src: slide.imageUrl as string, alt: slide.title })),
    [slides],
  );

  if (count === 0) {
    return null;
  }

  const current = slides[Math.min(active, count - 1)];
  const lightboxIndex = Math.max(0, gallery.findIndex((item) => item.src === current.imageUrl));

  return (
    <div className="site-slides">
      <div className="site-slides-viewport" aria-label="Featured slides">
        {current.imageUrl ? (
          <SiteWindowFrame
            src={current.imageUrl}
            alt={current.title}
            label="appendo.local/us/studio"
            onOpen={() => setLightboxOpen(true)}
          />
        ) : (
          <SiteWindowPlaceholder label="Capture pending" />
        )}
      </div>
      {count > 1 ? (
        <div className="site-slides-tabs" role="tablist" aria-label="Slide position">
          {slides.map((slide, index) => (
            <button
              key={`${slide.title}-${index}`}
              type="button"
              role="tab"
              className="site-slides-tab"
              aria-selected={index === active}
              data-active={index === active ? 'true' : 'false'}
              onClick={() => setActive(index)}
            >
              {slide.index}
            </button>
          ))}
        </div>
      ) : null}
      <div className="site-slides-caption">
        <h3>{current.title}</h3>
        <p>{current.copy}</p>
      </div>
      {lightboxOpen && gallery.length > 0 ? (
        <ChatImageLightbox
          images={gallery}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </div>
  );
};
