import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeAiIndexArtifacts } from '../src/shared/lib/aiIndexCodegen.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const graph = writeAiIndexArtifacts(rootDir);
console.log(`[codegen:ai-index] wrote ${graph.nodes.length} nodes → docs/ai/`);
