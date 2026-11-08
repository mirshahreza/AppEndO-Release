import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { atomicWriteText } from '../../runtime/RuntimeFileStore';
import { MIN_COMPRESSIBLE_TOOL_CHARS } from './toolObservationCompact';

/**
 * V5 Phase P09 §15 "Large Output Defense must be runtime-level" — the phase doc's literal
 * `ToolOutputArtifact` contract, made real. Before this phase, `SessionToolObservationStore`
 * (`toolObservationCompact.ts`) already capped what the model sees inline and handed back a `ref`
 * — but nothing ever persisted the full payload to disk or let the model retrieve it: the `ref`
 * was emitted into context and then went nowhere (confirmed by grep — no tool consumed it before
 * this phase). This file closes that: any observation large enough to be compacted is also
 * durably persisted here, keyed by the SAME `ref` the model already sees, so `artifact_read_range`
 * /`artifact_tail`/`artifact_search`/`artifact_list_errors` (`toolOutputArtifactTools.ts`) can
 * retrieve it without inventing a second identifier scheme.
 */
export type ToolOutputArtifact = {
  artifactId: string;
  toolCallId: string;
  toolName: string;
  contentType: 'text' | 'json';
  byteLength: number;
  lineCount?: number;
  digest: string;
  queryCapabilities: string[];
  createdAt: string;
};

const ARTIFACTS_ROOT = 'workspace/appendoo/tool-output-artifacts';
const ARTIFACTS_TMP_DIR = `${ARTIFACTS_ROOT}/.tmp`;
const resolveArtifactsRoot = (): string => path.join(process.cwd(), ARTIFACTS_ROOT);
const sanitizeId = (id: string): string => id.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);

const artifactFilePath = (artifactId: string): string => (
  path.join(resolveArtifactsRoot(), `${sanitizeId(artifactId)}.json`)
);

const toStorableText = (payload: unknown): { text: string; contentType: 'text' | 'json' } => (
  typeof payload === 'string'
    ? { text: payload, contentType: 'text' }
    : { text: JSON.stringify(payload, null, 2), contentType: 'json' }
);

const ERROR_LIKE_PATTERN = /error|fail|exception|traceback|✗|✖/i;

const resolveQueryCapabilities = (text: string): string[] => {
  const capabilities = ['read_range', 'tail', 'search'];
  if (ERROR_LIKE_PATTERN.test(text)) {
    capabilities.push('list_errors');
  }
  return capabilities;
};

/**
 * Persists `payload` as a durable artifact IF it's large enough to have been worth compacting in
 * the first place (same threshold `toolObservationCompact.ts` uses to decide whether to compact
 * at all) — small observations never needed an artifact and don't get one. Returns `undefined`
 * for anything under that threshold.
 */
export const persistToolOutputArtifactIfLarge = (
  artifactId: string,
  payload: unknown,
  meta: { toolCallId: string; toolName: string },
): ToolOutputArtifact | undefined => {
  const { text, contentType } = toStorableText(payload);
  if (text.length < MIN_COMPRESSIBLE_TOOL_CHARS) {
    return undefined;
  }

  const artifact: ToolOutputArtifact = {
    artifactId,
    toolCallId: meta.toolCallId,
    toolName: meta.toolName,
    contentType,
    byteLength: Buffer.byteLength(text, 'utf8'),
    lineCount: contentType === 'text' ? text.split('\n').length : undefined,
    digest: createHash('sha256').update(text).digest('hex'),
    queryCapabilities: resolveQueryCapabilities(text),
    createdAt: new Date().toISOString(),
  };

  const filePath = artifactFilePath(artifactId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  atomicWriteText(
    filePath,
    JSON.stringify({ meta: artifact, content: text }, null, 2),
    path.join(process.cwd(), ARTIFACTS_TMP_DIR),
  );

  return artifact;
};

export const loadToolOutputArtifact = (
  artifactId: string,
): { meta: ToolOutputArtifact; content: string } | undefined => {
  const filePath = artifactFilePath(artifactId);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as { meta: ToolOutputArtifact; content: string };
  } catch {
    return undefined;
  }
};
