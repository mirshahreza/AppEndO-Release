import { clearAppEndooDockDocumentInsets } from '../appendooDock';
import { closePersistedAppEndooOpen } from './usePersistedAppEndooOpen';

/** Tear down AppEndoo chrome when auth ends or user enters a public surface. */
export const resetAppEndooSessionSurface = (): void => {
  closePersistedAppEndooOpen();
  clearAppEndooDockDocumentInsets();
};
