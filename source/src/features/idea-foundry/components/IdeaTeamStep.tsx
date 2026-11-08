import React, { useMemo, useState } from 'react';
import { Bot, UserPlus } from 'lucide-react';
import type { IdeaTeamModel, IdeaTeamPerson } from '../../../shared/api/contracts/idea-foundry/types';
import {
  FORM_FIELD_ERROR_CLASS,
  FormSection,
} from '../../../shared/ui';
import { IdeaPersonPickerDialog } from './IdeaPersonPickerDialog';
import { IdeaTeamAddCard, IdeaTeamPersonCard } from './IdeaTeamPersonCard';
import { IdeaTeamModelCard } from './IdeaTeamModelCard';
import { IdeaTeamModelPickerDialog } from './IdeaTeamModelPickerDialog';

type IdeaTeamStepProps = {
  decisionMaker: IdeaTeamPerson | null;
  collaborators: IdeaTeamPerson[];
  models: IdeaTeamModel[];
  availableModels: readonly IdeaTeamModel[];
  modelsLoading?: boolean;
  peopleError?: string | null;
  modelsError?: string | null;
  onChangeDecisionMaker: (person: IdeaTeamPerson) => void;
  onAddCollaborators: (people: IdeaTeamPerson[]) => void;
  onRemoveCollaborator: (userId: number) => void;
  onMakeDecisionMaker: (person: IdeaTeamPerson) => void;
  onAddModels: (models: IdeaTeamModel[]) => void;
  onRemoveModel: (modelId: string) => void;
  onMakeLeadModel: (model: IdeaTeamModel) => void;
};

type PickerMode = 'decision-maker' | 'collaborators' | null;
type ModelPickerMode = 'lead' | 'add' | null;

const SECTION_TITLE_CLASS = 'text-slate-500';
const SECTION_BAR_CLASS = 'hidden';
const TEAM_DIVIDER_CLASS = 'my-1 border-t border-border-subtle';

export const IdeaTeamStep: React.FC<IdeaTeamStepProps> = ({
  decisionMaker,
  collaborators,
  models,
  availableModels,
  modelsLoading = false,
  peopleError,
  modelsError,
  onChangeDecisionMaker,
  onAddCollaborators,
  onRemoveCollaborator,
  onMakeDecisionMaker,
  onAddModels,
  onRemoveModel,
  onMakeLeadModel,
}) => {
  const [picker, setPicker] = useState<PickerMode>(null);
  const [modelPicker, setModelPicker] = useState<ModelPickerMode>(null);
  const selectedModelIds = useMemo(() => new Set(models.map((model) => model.id)), [models]);
  const excludedUserIds = useMemo(() => {
    const ids = new Set<number>();
    if (decisionMaker) ids.add(decisionMaker.userId);
    for (const person of collaborators) ids.add(person.userId);
    return ids;
  }, [collaborators, decisionMaker]);
  const unselectedModels = useMemo(
    () => availableModels.filter((model) => !selectedModelIds.has(model.id)),
    [availableModels, selectedModelIds],
  );
  const leadModel = models[0] ?? null;
  const supportingModels = models.slice(1);
  const leadCandidates = useMemo(
    () => availableModels.filter((model) => model.id !== leadModel?.id),
    [availableModels, leadModel],
  );

  return (
    <div className="grid h-full min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
      <FormSection
        title="Team members"
        hint="Who makes the final call, and who else is on the idea."
        accentBarClassName={SECTION_BAR_CLASS}
        titleClassName={SECTION_TITLE_CLASS}
        className="flex h-full min-h-0 min-w-0 flex-col"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {decisionMaker ? (
            <IdeaTeamPersonCard
              person={decisionMaker}
              role="decision-maker"
              onChange={() => setPicker('decision-maker')}
            />
          ) : (
            <IdeaTeamAddCard
              label="Choose decision maker"
              onClick={() => setPicker('decision-maker')}
              icon={<UserPlus className="h-3.5 w-3.5" aria-hidden />}
            />
          )}
          {decisionMaker ? <div role="separator" className={TEAM_DIVIDER_CLASS} /> : null}
          {collaborators.map((person) => (
            <IdeaTeamPersonCard
              key={person.userId}
              person={person}
              role="collaborator"
              onMakeDecisionMaker={() => onMakeDecisionMaker(person)}
              onRemove={() => onRemoveCollaborator(person.userId)}
            />
          ))}
          <IdeaTeamAddCard
            label="Add collaborator"
            onClick={() => setPicker('collaborators')}
            icon={<UserPlus className="h-3.5 w-3.5" aria-hidden />}
          />
          {peopleError ? <p className={FORM_FIELD_ERROR_CLASS}>{peopleError}</p> : null}
        </div>
      </FormSection>

      <FormSection
        title="Models"
        hint="Which model leads, and which others join."
        accentBarClassName={SECTION_BAR_CLASS}
        titleClassName={SECTION_TITLE_CLASS}
        className="flex h-full min-h-0 min-w-0 flex-col"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" role="group" aria-label="Models">
          {modelsLoading && !leadModel ? (
            <p className="text-sm font-medium text-slate-500">Loading models…</p>
          ) : !leadModel && availableModels.length === 0 ? (
            <p className="text-sm font-medium text-slate-500">
              No enabled chat models with a provider key. Turn one on in Settings → AI models.
            </p>
          ) : (
            <>
              {leadModel ? (
                <IdeaTeamModelCard
                  model={leadModel}
                  role="lead"
                  onChange={leadCandidates.length > 0 ? () => setModelPicker('lead') : undefined}
                />
              ) : null}
              {leadModel ? <div role="separator" className={TEAM_DIVIDER_CLASS} /> : null}
              {supportingModels.map((model) => (
                <IdeaTeamModelCard
                  key={model.id}
                  model={model}
                  role="supporting"
                  onMakeLead={() => onMakeLeadModel(model)}
                  onRemove={() => onRemoveModel(model.id)}
                />
              ))}
              {unselectedModels.length > 0 ? (
                <IdeaTeamAddCard
                  label="Add model"
                  onClick={() => setModelPicker('add')}
                  icon={<Bot className="h-3.5 w-3.5" aria-hidden />}
                />
              ) : null}
            </>
          )}
          {modelsError ? <p className={FORM_FIELD_ERROR_CLASS}>{modelsError}</p> : null}
        </div>
      </FormSection>

      <IdeaPersonPickerDialog
        open={picker === 'decision-maker'}
        title="Choose decision maker"
        multiple={false}
        excludedUserIds={new Set()}
        onClose={() => setPicker(null)}
        onPick={(people) => {
          const person = people[0];
          if (person) onChangeDecisionMaker(person);
          setPicker(null);
        }}
      />
      <IdeaPersonPickerDialog
        open={picker === 'collaborators'}
        title="Add collaborators"
        multiple
        excludedUserIds={excludedUserIds}
        onClose={() => setPicker(null)}
        onPick={(people) => {
          onAddCollaborators(people);
          setPicker(null);
        }}
      />
      <IdeaTeamModelPickerDialog
        open={modelPicker === 'lead'}
        title="Choose lead model"
        multiple={false}
        models={leadCandidates}
        onClose={() => setModelPicker(null)}
        onPick={(picked) => {
          const model = picked[0];
          if (model) onMakeLeadModel(model);
          setModelPicker(null);
        }}
      />
      <IdeaTeamModelPickerDialog
        open={modelPicker === 'add'}
        models={unselectedModels}
        onClose={() => setModelPicker(null)}
        onPick={(picked) => {
          onAddModels(picked);
          setModelPicker(null);
        }}
      />
    </div>
  );
};
