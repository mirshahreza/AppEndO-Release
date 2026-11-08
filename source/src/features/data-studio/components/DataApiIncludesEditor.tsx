import React from 'react';
import { AppButton, FormField, UiCheckbox, UiInput } from '../../../shared/ui';
import type { EdgeModelAssociation } from '../../../shared/api/contracts/data-api';
import {
  associationKindLabel,
  isBelongsToManyAssociation,
} from '../lib/edgeModelAssociations';
import type { ConfigureDataApiIncludeConfig } from '../lib/configureDataApiTypes';

const isCollectionAssociationKind = (kind: EdgeModelAssociation['kind']): boolean => (
  kind === 'hasMany' || kind === 'belongsToMany'
);

const associationMetaLine = (association: EdgeModelAssociation): string => {
  if (isBelongsToManyAssociation(association)) {
    return `${associationKindLabel(association.kind)} · through ${association.throughModelId} · ${association.foreignKey}/${association.otherKey}`;
  }
  return `${associationKindLabel(association.kind)} · FK ${association.foreignKey}`;
};

type DataApiIncludesEditorProps = {
  includeConfigs: ConfigureDataApiIncludeConfig[];
  associations: EdgeModelAssociation[];
  onChange: (includeConfigs: ConfigureDataApiIncludeConfig[]) => void;
};

const upsertConfig = (
  configs: ConfigureDataApiIncludeConfig[],
  as: string,
  patch: Partial<ConfigureDataApiIncludeConfig>,
): ConfigureDataApiIncludeConfig[] => {
  const existing = configs.find((item) => item.as === as);
  if (!existing) {
    return [...configs, { as, enabled: false, ...patch }];
  }

  return configs.map((item) => (
    item.as === as ? { ...item, ...patch } : item
  ));
};

export const DataApiIncludesEditor: React.FC<DataApiIncludesEditorProps> = ({
  includeConfigs,
  associations,
  onChange,
}) => {
  if (associations.length === 0) {
    return (
      <p className="text-[11px] text-slate-500">
        No logical relations are defined on this Edge model. Add them on the Relations diagram by
        connecting tables.
      </p>
    );
  }

  const getConfig = (as: string): ConfigureDataApiIncludeConfig => (
    includeConfigs.find((item) => item.as === as) ?? {
      as,
      enabled: false,
      separate: isCollectionAssociationKind(
        associations.find((item) => item.as === as)?.kind ?? 'belongsTo',
      )
        ? true
        : undefined,
    }
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-slate-500">
        Configure eager-loaded relations. For hasMany / belongsToMany collections with a limit, keep
        {' '}
        <strong>Separate query</strong>
        {' '}
        enabled so the limit applies per parent row.
      </p>

      {associations.map((association) => {
        const config = getConfig(association.as);

        return (
          <div
            key={association.id}
            className="rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">{association.as}</p>
                <p className="text-[10px] text-slate-500">
                  {associationMetaLine(association)}
                </p>
              </div>
              <UiCheckbox
                size="sm"
                isSelected={config.enabled}
                onChange={(checked) => onChange(upsertConfig(includeConfigs, association.as, { enabled: checked }))}
              >
                Include in response
              </UiCheckbox>
            </div>

            {config.enabled ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <FormField label="Limit">
                  <UiInput
                    size="sm"
                    type="number"
                    value={config.limit?.toString() ?? ''}
                    placeholder="No limit"
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      onChange(upsertConfig(includeConfigs, association.as, {
                        limit: Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined,
                      }));
                    }}
                  />
                </FormField>
                <FormField label="Order">
                  <UiInput
                    size="sm"
                    value={config.order ?? ''}
                    placeholder="-createdAt"
                    onChange={(event) => onChange(upsertConfig(includeConfigs, association.as, {
                      order: event.target.value.trim() || undefined,
                    }))}
                  />
                </FormField>
                <FormField label="Child fields (comma-separated)">
                  <UiInput
                    size="sm"
                    value={(config.fields ?? []).join(', ')}
                    placeholder="All fields"
                    onChange={(event) => onChange(upsertConfig(includeConfigs, association.as, {
                      fields: event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    }))}
                  />
                </FormField>
                <FormField label="Nested includes (comma-separated)">
                  <UiInput
                    size="sm"
                    value={(config.nestedIncludes ?? []).join(', ')}
                    placeholder="items"
                    onChange={(event) => onChange(upsertConfig(includeConfigs, association.as, {
                      nestedIncludes: event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    }))}
                  />
                </FormField>
                <div className="md:col-span-2">
                  <UiCheckbox
                    size="sm"
                    isSelected={config.separate === true}
                    onChange={(checked) => onChange(upsertConfig(includeConfigs, association.as, {
                      separate: checked,
                    }))}
                  >
                    Separate query (recommended for hasMany + limit)
                  </UiCheckbox>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      <AppButton
        type="button"
        intent="secondary"
        size="sm"
        className="self-start"
        onClick={() => onChange(
          associations.map((association) => ({
            ...getConfig(association.as),
            enabled: true,
          })),
        )}
      >
        Enable all includes
      </AppButton>
    </div>
  );
};
