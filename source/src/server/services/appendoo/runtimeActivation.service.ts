import type { RuntimeActivationBatchResult } from '../../../shared/api/contracts/appendoo/runtimeActivation.types';
import type { BuilderArtifactMutation } from '../../../shared/api/contracts/appendoo/builderProtocol.types';
import { isLiveDesignerPublishEnabled, isLiveExperienceRegistryEnabled, isLiveRuntimeActivationEnabled } from '../../../shared/lib/appendoo/appendooIntegrationFlags';
import {
  executeRuntimeActivation,
  planRuntimeActivations,
} from '../../../shared/lib/appendoo/runtimeActivationScaffold';
import { compileExperienceRegistryFromDesignerPublish, persistLiveExperienceActivations } from './runtimeActivationExperienceLive.service';
import { persistLiveDesignerActivations, persistLiveDesignerActivationsSync } from './runtimeActivationDesignerLive.service';
import { persistLiveRuntimeActivations } from './runtimeActivationLive.service';

export class RuntimeActivationService {
  activateFromMutations(
    mutations: Pick<BuilderArtifactMutation, 'path' | 'artifactId'>[],
  ): RuntimeActivationBatchResult {
    const targets = planRuntimeActivations(mutations);
    let batch = executeRuntimeActivation(targets);

    if (isLiveRuntimeActivationEnabled()) {
      batch = persistLiveRuntimeActivations(targets, batch);
    }

    if (isLiveDesignerPublishEnabled()) {
      batch = persistLiveDesignerActivationsSync(targets, batch);
    }

    return batch;
  }

  async activateFromMutationsAsync(
    mutations: Pick<BuilderArtifactMutation, 'path' | 'artifactId'>[],
  ): Promise<RuntimeActivationBatchResult> {
    const targets = planRuntimeActivations(mutations);
    let batch = executeRuntimeActivation(targets);

    if (isLiveRuntimeActivationEnabled()) {
      batch = persistLiveRuntimeActivations(targets, batch);
    }

    if (isLiveDesignerPublishEnabled()) {
      batch = await persistLiveDesignerActivations(targets, batch);
    }

    if (isLiveExperienceRegistryEnabled()) {
      batch = await persistLiveExperienceActivations(targets, batch);
    }

    return batch;
  }
}

export { compileExperienceRegistryFromDesignerPublish };

export const runtimeActivationService = new RuntimeActivationService();
