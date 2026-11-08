import { AppButton } from '../../../shared/ui/AppButton';
import type { EngineeringPipelineViewModel } from '../../../shared/api/contracts/appendoo/engineeringPipeline.types';
import {
  isPromotionApprovalPipeline,
  resolveEngineeringPipelineApprovalBinding,
  shouldShowSemanticPlanApprovalBar,
} from '../../../shared/lib/appendoo/engineeringPipelineApprovalUi';

type SemanticPlanApprovalBarProps = {
  pipeline: EngineeringPipelineViewModel;
  onApprove?: (bindingId: string) => void | Promise<void>;
  approving?: boolean;
};

/** Plain approval prompt — message and button live outside technical summary panels. */
export const SemanticPlanApprovalBar = ({
  pipeline,
  onApprove,
  approving = false,
}: SemanticPlanApprovalBarProps) => {
  const canApprove = shouldShowSemanticPlanApprovalBar(pipeline, {
    hasApproveHandler: Boolean(onApprove),
  });

  if (!canApprove) {
    return null;
  }

  const bindingId = resolveEngineeringPipelineApprovalBinding(pipeline);
  const isPromotion = isPromotionApprovalPipeline(pipeline);
  const objective = pipeline.planObjective?.trim() || 'the planned changes';

  return (
    <div className="mt-2" data-testid="semantic-plan-approval-bar">
      <p className="mb-1.5 text-xs leading-relaxed text-slate-700">
        {isPromotion ? (
          <>
            Verification passed for
            {' '}
            <span className="font-medium">{objective}</span>
            . Approve package export / promotion with architect sign-off.
          </>
        ) : (
          <>
            A build plan is ready for
            {' '}
            <span className="font-medium">{objective}</span>
            . Approve to apply the changes.
          </>
        )}
      </p>
      <AppButton
        intent="confirm"
        size="sm"
        isDisabled={approving || !bindingId}
        onClick={() => {
          if (bindingId) {
            void onApprove?.(bindingId);
          }
        }}
        data-testid="semantic-plan-approve-button"
      >
        {approving
          ? (isPromotion ? 'Exporting…' : 'Approving…')
          : (isPromotion ? 'Approve export' : 'Approve & build')}
      </AppButton>
    </div>
  );
};
