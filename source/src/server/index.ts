import { startServer } from './bootstrap';

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error('[AppEndO] Server failed to start:', message);
  process.exit(1);
});
