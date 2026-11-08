import type {
  PromotionRun,
  StartPromotionInput,
} from '../../../shared/api/contracts/appendoo/promotion.types';
import type { VerificationRun } from '../../../shared/api/contracts/appendoo/verificationEngine.types';
import {
  compilePackageDnaScaffold,
  createPromotionRunScaffold,
  executePromotionScaffold,
  summarizePromotionRun,
} from '../../../shared/lib/appendoo/promotionScaffold';
import { finalizePackageSnapshotScaffold } from '../../../shared/lib/appendoo/packageSnapshotFinalizeScaffold';
import { packageSnapshotStore } from '../../../shared/lib/appendoo/packageSnapshotStore';
import { packageSnapshotRoundtripService } from './packageSnapshotRoundtrip.service';

export class PromotionService {
  startPromotion(input: StartPromotionInput, verificationRun: VerificationRun): {
    run: PromotionRun;
    summary: ReturnType<typeof summarizePromotionRun>;
    packageDna: ReturnType<typeof compilePackageDnaScaffold>;
  } {
    const run = createPromotionRunScaffold(input, verificationRun)!;

    return {
      run,
      summary: summarizePromotionRun(run),
      packageDna: compilePackageDnaScaffold(verificationRun),
    };
  }

  /** AE-9.3/9.9/9.10 — advance verified promotion through DEPLOYED + snapshot + export roundtrip. */
  executePromotion(
    run: PromotionRun,
    mutationPaths: string[] = [],
  ): {
    run: PromotionRun;
    summary: ReturnType<typeof summarizePromotionRun>;
    roundtripValidated?: boolean;
  } {
    const executed = executePromotionScaffold(run);
    if (executed.state !== 'DEPLOYED') {
      return {
        run: executed,
        summary: summarizePromotionRun(executed),
      };
    }

    const finalized = finalizePackageSnapshotScaffold(executed, mutationPaths);
    if (finalized.snapshot) {
      const roundtrip = packageSnapshotRoundtripService.executeRoundtrip(finalized.snapshot);
      packageSnapshotStore.save(roundtrip.snapshot);
      return {
        run: finalized.run,
        summary: summarizePromotionRun(finalized.run),
        roundtripValidated: roundtrip.ok,
      };
    }

    return {
      run: finalized.run,
      summary: summarizePromotionRun(finalized.run),
    };
  }
}

export const promotionService = new PromotionService();
