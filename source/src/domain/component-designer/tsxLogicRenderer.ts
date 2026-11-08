import type { DesignerNode } from './types';
import type { TsxBindingRenderContext } from './bindingCodegen';
import { resolveCombinedNodeVisibilityCondition } from './bindingDynamicActionsCodegen';
import {
  clientComponentViewportRequiresWrap,
  resolveClientComponentViewportPolicy,
} from '../../shared/lib/clientComponentViewport';
import {
  isLogicRepeaterNode,
  resolveRepeaterArrayExpression,
  resolveRepeaterNodeConfig,
  type RepeaterRenderScope,
} from './repeaterEngine';
import { resolveRepeaterArrayExpressionForCodegen } from './bindingRepeaterEngine';
import { renderVisibilityConditionJsxWrapper } from './visibilityConditionEngine';

export type RenderDesignerNodeJsx = (
  nodeId: string,
  nodes: Record<string, DesignerNode>,
  depth: number,
  bindingContext?: TsxBindingRenderContext,
  wrapAsJsxExpression?: boolean,
) => string;

export const buildRepeaterScopeExpression = (scope: RepeaterRenderScope): string =>
  `({ item: ${scope.itemVar}, index: ${scope.indexVar} })`;

export const wrapNodeJsxWithVisibilityCondition = (
  node: DesignerNode,
  innerJsx: string,
  depth: number,
  bindingContext?: TsxBindingRenderContext,
  wrapAsJsxExpression = true,
): string => {
  const showHideTargetNodeIds = bindingContext?.showHideTargetNodeIds ?? new Set<string>();
  const condition = resolveCombinedNodeVisibilityCondition(node, showHideTargetNodeIds);
  if (!condition || innerJsx.trim().length === 0) {
    return innerJsx;
  }

  const scopeExpression = bindingContext?.repeaterScope
    ? buildRepeaterScopeExpression(bindingContext.repeaterScope)
    : '({})';

  return renderVisibilityConditionJsxWrapper(condition, innerJsx, depth, scopeExpression, wrapAsJsxExpression);
};

export const wrapNodeJsxWithClientComponent = (
  node: DesignerNode,
  innerJsx: string,
  _depth: number,
): string => {
  if (innerJsx.trim().length === 0) {
    return innerJsx;
  }

  const policy = resolveClientComponentViewportPolicy({
    minViewport: node.props.minViewport,
    belowMin: node.props.belowMin,
  });
  if (!clientComponentViewportRequiresWrap(policy) || !policy.minViewport) {
    return innerJsx;
  }

  const belowMinAttr = policy.belowMin === 'continue' ? '' : ` belowMin="${policy.belowMin}"`;
  return `<UiClientComponent minViewport="${policy.minViewport}"${belowMinAttr}>\n${innerJsx}\n</UiClientComponent>`;
};

export const wrapNodeJsxWithClientAndVisibility = (
  node: DesignerNode,
  innerJsx: string,
  depth: number,
  bindingContext?: TsxBindingRenderContext,
  wrapAsJsxExpression = true,
): string =>
  wrapNodeJsxWithClientComponent(
    node,
    wrapNodeJsxWithVisibilityCondition(node, innerJsx, depth, bindingContext, wrapAsJsxExpression),
    depth,
  );

export const renderLogicRepeaterJsx = (
  node: DesignerNode,
  nodes: Record<string, DesignerNode>,
  depth: number,
  renderChild: RenderDesignerNodeJsx,
  bindingContext?: TsxBindingRenderContext,
): string => {
  const config = resolveRepeaterNodeConfig(node);
  const arrayExpression = bindingContext
    ? resolveRepeaterArrayExpressionForCodegen(
      node,
      config,
      bindingContext.plan.repeaterPlan.repeaterListFetches,
      bindingContext.repeaterScope,
    )
    : resolveRepeaterArrayExpression(config.dataPath);
  const repeaterScope: RepeaterRenderScope = {
    itemVar: config.itemAlias,
    indexVar: config.indexAlias,
  };
  const childContext: TsxBindingRenderContext | undefined = bindingContext
    ? { ...bindingContext, repeaterScope }
    : undefined;

  const children = node.children
    .map((childId) => renderChild(childId, nodes, depth + 2, childContext, false))
    .filter((item) => item.length > 0)
    .join('\n');

  const innerBlock = children.length > 0
    ? children
    : `${'  '.repeat(depth + 2)}<div />`;

  const mapBody = [
    `${'  '.repeat(depth + 1)}{(${arrayExpression}).map((${config.itemAlias}, ${config.indexAlias}) => (`,
    `${'  '.repeat(depth + 2)}${innerBlock}`,
    `${'  '.repeat(depth + 1)}))}`,
  ].join('\n');

  const className = typeof node.props.className === 'string' ? node.props.className.trim() : '';
  const repeaterShell = className.length > 0
    ? [
        `${'  '.repeat(depth)}<div className=${JSON.stringify(className)}>`,
        mapBody,
        `${'  '.repeat(depth)}</div>`,
      ].join('\n')
    : mapBody;

  return wrapNodeJsxWithClientAndVisibility(node, repeaterShell, depth, bindingContext);
};

export const shouldRenderAsLogicRepeater = (node: DesignerNode): boolean =>
  isLogicRepeaterNode(node);
