import type { ComponentUsageHitBody } from './contracts/component-usage/hit';
import { apiPost } from './client';

/** Fire-and-forget runtime hit for published designer / package / shell pages. */
export function postComponentUsageHit(body: ComponentUsageHitBody): void {
  void apiPost('/api/component-usage/hit', body).catch(() => undefined);
}
