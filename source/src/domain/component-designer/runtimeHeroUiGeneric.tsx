import * as React from 'react';
import {
  ListBox,
} from '@heroui/react';
import type { DesignerNode } from './types';
import { mergeClassNames, readString, resolveRuntimeNodeClassName, wrapDesignerChildSlot } from './runtimeShared';
import type { RuntimeRenderOptions } from './runtimeTypes';
import { resolveRuntimeComponentProps } from './runtimeNodeProps';

type GenericComponent = React.ComponentType<Record<string, unknown>>;

const GENERIC_LEAF_COMPONENTS: Record<string, GenericComponent> = {
  'heroui.listbox': ListBox as unknown as GenericComponent,
};

const designInteractionClass = (mode: RuntimeRenderOptions['mode']): string | undefined =>
  mode === 'design' ? 'pointer-events-none' : undefined;

export const renderHeroUiGenericLeafNode = (
  node: DesignerNode,
  paletteItemId: string,
  options: RuntimeRenderOptions,
): React.ReactNode | null => {
  const Component = GENERIC_LEAF_COMPONENTS[paletteItemId];
  const className = resolveRuntimeNodeClassName(node, designInteractionClass(options.mode));
  const passthrough = resolveRuntimeComponentProps(node, { libraryComponent: true });

  if (Component) {
    return (
      <Component
        {...passthrough}
        className={className}
        style={options.style}
      >
        {readString(node.props.text) || readString(node.props.label) || undefined}
      </Component>
    );
  }

  return (
    <div
      className={mergeClassNames(
        options.mode === 'runtime'
          ? 'inline-flex min-w-[96px] rounded-md border-2 border-dashed border-amber-300/90 bg-amber-50/60 px-2 py-1.5'
          : 'inline-flex min-w-[80px] rounded-md border border-dashed border-slate-300 px-2 py-1',
        className,
      )}
      style={options.style}
      title={readString(node.props.title)}
      aria-label={readString(node.props.ariaLabel)}
      data-designer-preview-placeholder={options.mode === 'runtime' ? 'true' : undefined}
    >
      {options.mode === 'runtime' ? (
        <div className="flex flex-col items-center gap-0.5 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600/90">Preview</span>
          <span className="text-[11px] font-semibold text-amber-900">
            {readString(node.props.text, readString(node.props.label, paletteItemId.replace(/^heroui\./, '')))}
          </span>
          <span className="text-[10px] text-amber-700/90">{paletteItemId}</span>
        </div>
      ) : (
        <span className="text-[11px] font-medium text-slate-700">
          {readString(node.props.text, readString(node.props.label, paletteItemId.replace(/^heroui\./, '')))}
        </span>
      )}
    </div>
  );
};

export const renderHeroUiGenericStructuralNode = (
  node: DesignerNode,
  paletteItemId: string,
  options: RuntimeRenderOptions & { className?: string; children?: React.ReactNode },
): React.ReactNode => {
  const className = mergeClassNames(options.className, designInteractionClass(options.mode));
  const passthrough = resolveRuntimeComponentProps(node, { libraryComponent: true });

  return (
    <div
      {...passthrough}
      className={className}
      style={options.style}
      title={readString(node.props.title)}
      aria-label={readString(node.props.ariaLabel)}
      data-designer-component={paletteItemId}
    >
      {wrapDesignerChildSlot(options.children, options.mode)}
    </div>
  );
};
