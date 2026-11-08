export const isHwyElectoralMaktabPathSegment = (segment: string): boolean =>
  /^مدرسة\s+/u.test(segment.trim());

export const isHwyElectoralCirclePathSegment = (segment: string): boolean =>
  /^دائرة\s+/u.test(segment.trim());
