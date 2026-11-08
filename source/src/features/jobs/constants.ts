import type { EnqueueJobPayload } from '../../shared/api/contracts/jobs/types';

export { DEFAULT_GRID_PAGE_SIZE as DEFAULT_PAGE_SIZE } from '../../shared/lib/gridPagingConstants';

export const EMPTY_ENQUEUE_FORM: EnqueueJobPayload & { payloadText: string } = {
  functionId: '',
  title: '',
  payload: {},
  payloadText: '{}',
};
