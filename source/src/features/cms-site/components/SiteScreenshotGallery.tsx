import React, { useState } from 'react';
import { ChatImageLightbox } from '../../../shared/ui/ChatImageLightbox';
import { SiteWindowFrame } from './SiteWindowFrame';

type SiteScreenshotGalleryProps = {
  urls: readonly string[];
  alt?: string;
  variant?: 'lg' | 'sm';
  ratio?: string;
  label?: string;
  className?: string;
};

export const SiteScreenshotGallery: React.FC<SiteScreenshotGalleryProps> = ({
  urls,
  alt = 'Screenshot',
  variant = 'lg',
  ratio,
  label,
  className,
}) => {
  const images = urls.filter((src) => src.trim().length > 0);
  const [openAt, setOpenAt] = useState<number | null>(null);
  if (images.length === 0) {
    return null;
  }

  const resolvedRatio = ratio ?? (images.length > 1 ? '16 / 10' : '16 / 9');
  const galleryClass = className
    ?? (images.length > 1 ? 'site-story-gallery' : 'site-story-cover');

  return (
    <>
      <div className={galleryClass}>
        {images.map((src, index) => (
          <SiteWindowFrame
            key={`${src}-${index}`}
            src={src}
            alt={alt}
            label={label}
            variant={variant}
            ratio={resolvedRatio}
            onOpen={() => setOpenAt(index)}
          />
        ))}
      </div>
      {openAt !== null ? (
        <ChatImageLightbox
          images={images.map((src) => ({ src, alt }))}
          initialIndex={openAt}
          onClose={() => setOpenAt(null)}
        />
      ) : null}
    </>
  );
};
