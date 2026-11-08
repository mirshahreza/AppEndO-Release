import { z } from 'zod';

/** Markdown story body in studio-meta.extensions. */
export const MODEL_STORY_EXTENSION_KEY = 'story';

const modelStoryExtensionSchema = z.string();

export const readModelStoryFromExtensions = (
  extensions: Record<string, unknown> | null | undefined,
): string => {
  if (!extensions) {
    return '';
  }
  const parsed = modelStoryExtensionSchema.safeParse(extensions[MODEL_STORY_EXTENSION_KEY]);
  if (!parsed.success) {
    return '';
  }
  return parsed.data.trim();
};

export const normalizeModelStoryForStorage = (story: string): string => story.trim();

/** True when story has no visible text. */
export const isModelStoryEmpty = (story: string): boolean => !story.trim();
