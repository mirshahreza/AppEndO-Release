import type { HomeWidgetDefinition } from './definition';
import { homeWidgetsSchema } from './schema';

export function parseHomeWidgetsField(value: unknown): HomeWidgetDefinition[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = homeWidgetsSchema.safeParse(value);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean).join(', ');
    throw new Error(detail ? `Invalid homeWidgets: ${detail}` : 'Invalid homeWidgets.');
  }
  return parsed.data;
}
