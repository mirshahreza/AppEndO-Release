import { getAiProviderLabel } from '../../../../shared/api/contracts/ai/constants';
import type { AiModelPublicEntry, AiProviderKind, AiProviderPublicConfig } from '../../../../shared/api/contracts/ai/types';
import type { BaseTreeGridRow } from '../../../../components/ui/BaseTreeGrid';

export type AiModelsTreeRowKind = 'provider' | 'model';

export type AiModelsTreeRow = BaseTreeGridRow & {
  kind: AiModelsTreeRowKind;
  provider?: AiProviderPublicConfig;
  model?: AiModelPublicEntry;
};

export const providerTreeRowId = (provider: AiProviderKind) => `provider:${provider}`;

export const parseProviderTreeRowId = (rowId: string): AiProviderKind | null => (
  rowId.startsWith('provider:') ? rowId.slice('provider:'.length) as AiProviderKind : null
);

export const buildAiModelsTreeRows = (
  providers: AiProviderPublicConfig[],
  models: AiModelPublicEntry[],
  expandedById: Record<string, boolean>,
): AiModelsTreeRow[] => {
  const providerByKind = new Map(providers.map((provider) => [provider.provider, provider]));
  const providerKinds = [...new Set([
    ...providers.map((provider) => provider.provider),
    ...models.map((model) => model.provider),
  ])];

  const sortedProviders = providerKinds
    .map((kind) => providerByKind.get(kind) ?? {
      provider: kind,
      hasApiKey: false,
    })
    .sort((left, right) => getAiProviderLabel(left.provider, left.providerLabel)
      .localeCompare(getAiProviderLabel(right.provider, right.providerLabel)));

  const rows: AiModelsTreeRow[] = [];

  sortedProviders.forEach((provider) => {
    const rowId = providerTreeRowId(provider.provider);
    const childModels = models
      .filter((model) => model.provider === provider.provider)
      .sort((left, right) => left.modelId.localeCompare(right.modelId));

    rows.push({
      id: rowId,
      parentId: null,
      depth: 0,
      hasChildren: childModels.length > 0,
      kind: 'provider',
      provider,
    });

    if (expandedById[rowId] ?? true) {
      childModels.forEach((model) => {
        rows.push({
          id: model.id,
          parentId: rowId,
          depth: 1,
          kind: 'model',
          model,
        });
      });
    }
  });

  return rows;
};

export const buildDefaultExpandedById = (models: AiModelPublicEntry[]): Record<string, boolean> => {
  const next: Record<string, boolean> = {};
  [...new Set(models.map((model) => model.provider))].forEach((provider) => {
    next[providerTreeRowId(provider)] = true;
  });
  return next;
};
