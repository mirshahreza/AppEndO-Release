import { listDesignerDrafts, getDesignerDraft } from '../../domain/component-designer/draftIo';
import { listManagedFunctions } from '../../domain/functions/functionRepository';
import { listWorkflowDefinitions } from '../../domain/workflow/workflowDefinitionRepository';
import { isPackageServerFunction } from '../../../shared/api/contracts/server-functions/packageFunctions';
import { isCatalogHiddenServerFunction } from '../../../shared/api/contracts/server-functions/reservedFunctions';
import type { UnusedServerFunctionEntry } from '../../../shared/api/contracts/server-functions/unused';
import { lookupComponentUsageLastHits } from '../component-usage/componentUsagePersistence.service';

const buildDesignerReferenceCorpus = (): string => {
  const chunks: string[] = [];
  for (const draft of listDesignerDrafts()) {
    const record = getDesignerDraft(draft.id);
    if (!record) {
      continue;
    }
    chunks.push(JSON.stringify(record.document));
    chunks.push(JSON.stringify(record.bindingDefinitions ?? {}));
  }
  return chunks.join('\n');
};

const buildWorkflowReferenceCorpus = async (): Promise<string> => {
  const definitions = await listWorkflowDefinitions();
  return definitions.map((definition) => definition.draftDefinitionJson).join('\n');
};

const isServerFunctionReferenced = (
  fn: { id: string; path: string },
  corpus: string,
): boolean => {
  if (corpus.includes(fn.id)) {
    return true;
  }
  const trimmedPath = fn.path?.trim() ?? '';
  return trimmedPath.length > 0 && corpus.includes(trimmedPath);
};

/** Custom managed functions with no static reference in Designer drafts or workflow definitions. */
export async function listUnusedServerFunctions(): Promise<UnusedServerFunctionEntry[]> {
  const corpus = `${buildDesignerReferenceCorpus()}\n${await buildWorkflowReferenceCorpus()}`;
  const entries: UnusedServerFunctionEntry[] = [];

  for (const row of await listManagedFunctions()) {
    const fn = row as { id: string; name: string; path: string; folder?: string | null };
    const folder = fn.folder ?? 'general';
    if (isPackageServerFunction({ id: fn.id, folder })) {
      continue;
    }
    if (isCatalogHiddenServerFunction({ id: fn.id })) {
      continue;
    }
    if (isServerFunctionReferenced(fn, corpus)) {
      continue;
    }
    entries.push({
      id: fn.id,
      name: fn.name,
      path: fn.path,
      lastHitAt: null,
    });
  }

  const sorted = entries.sort((left, right) => (
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  ));

  let lastHits = new Map<string, string | null>();
  try {
    lastHits = await lookupComponentUsageLastHits(sorted.map((entry) => entry.id), 'server-function');
  } catch {
    lastHits = new Map();
  }

  return sorted.map((entry) => ({
    ...entry,
    lastHitAt: lastHits.get(entry.id) ?? null,
  }));
}
