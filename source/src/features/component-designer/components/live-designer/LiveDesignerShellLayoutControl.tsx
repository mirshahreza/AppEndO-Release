import * as React from 'react';
import type { DesignerAction, DesignerDocument } from '../../../../domain/component-designer/types';
import { FooterLabelDropdown, ToolbarFilterSelect, UiCheckbox, UiSegmentedControl } from '../../../../shared/ui';
import {
  readShellBoundedEdge,
  readShellBoundedMaxWidth,
  readShellLayoutWidth,
  readShellLayoutWidthUserControl,
} from '../../../../shared/ui/shell-foundation/shellLayoutWidth';

const WIDTH_ITEMS = [
  { id: 'fluid', label: 'Full width' },
  { id: 'bounded', label: 'Bounded' },
] as const;

const SHELL_BOUNDED_MAX_OPTIONS = [
  { value: 'sm', label: 'Narrow column' },
  { value: 'md', label: 'Medium column' },
  { value: 'lg', label: 'Standard column' },
] as const;

const SHELL_BOUNDED_EDGE_OPTIONS = [
  { value: 'outset', label: 'Outset edge' },
  { value: 'hairline', label: 'Hairline edge' },
  { value: 'shadow', label: 'Shadow edge' },
] as const;

export type LiveDesignerShellLayoutControlProps = {
  document: DesignerDocument;
  dispatch: React.Dispatch<DesignerAction>;
  variant?: 'toolbar' | 'footer' | 'properties';
};

function useShellLayoutPatch(
  document: DesignerDocument,
  dispatch: React.Dispatch<DesignerAction>,
) {
  const layoutWidth = readShellLayoutWidth(document);
  const boundedMaxWidth = readShellBoundedMaxWidth(document);
  const boundedEdge = readShellBoundedEdge(document);
  const layoutWidthUserControl = readShellLayoutWidthUserControl(document);

  return React.useCallback((partial: Partial<{
    layoutWidth: 'fluid' | 'bounded';
    boundedMaxWidth: 'sm' | 'md' | 'lg';
    boundedEdge: 'hairline' | 'shadow' | 'outset';
    layoutWidthUserControl: boolean;
  }>) => {
    dispatch({
      type: 'set-shell-layout-width',
      layoutWidth: partial.layoutWidth ?? layoutWidth,
      boundedMaxWidth: partial.boundedMaxWidth ?? boundedMaxWidth,
      boundedEdge: partial.boundedEdge ?? boundedEdge,
      layoutWidthUserControl: partial.layoutWidthUserControl ?? layoutWidthUserControl,
    });
  }, [boundedEdge, boundedMaxWidth, dispatch, layoutWidth, layoutWidthUserControl]);
}

export const LiveDesignerShellLayoutControl: React.FC<LiveDesignerShellLayoutControlProps> = ({
  document,
  dispatch,
  variant = 'toolbar',
}) => {
  const layoutWidth = readShellLayoutWidth(document);
  const boundedMaxWidth = readShellBoundedMaxWidth(document);
  const boundedEdge = readShellBoundedEdge(document);
  const layoutWidthUserControl = readShellLayoutWidthUserControl(document);
  const patch = useShellLayoutPatch(document, dispatch);

  if (variant === 'properties') {
    return (
      <div className="space-y-3" data-testid="live-designer-shell-layout-controls">
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-600">Default width</span>
          <UiSegmentedControl
            ariaLabel="Shell page width default"
            items={[...WIDTH_ITEMS]}
            selectedKey={layoutWidth}
            onSelectionChange={(key) => {
              if (key === 'fluid' || key === 'bounded') {
                patch({ layoutWidth: key });
              }
            }}
            className="w-full max-w-md"
          />
        </div>
        {layoutWidth === 'bounded' ? (
          <>
            <ToolbarFilterSelect
              ariaLabel="Bounded column width"
              value={boundedMaxWidth}
              options={SHELL_BOUNDED_MAX_OPTIONS}
              onChange={(value) => {
                if (value === 'sm' || value === 'md' || value === 'lg') {
                  patch({ boundedMaxWidth: value });
                }
              }}
              className="w-full max-w-md"
            />
            <ToolbarFilterSelect
              ariaLabel="Bounded column edge"
              value={boundedEdge}
              options={SHELL_BOUNDED_EDGE_OPTIONS}
              onChange={(value) => {
                if (value === 'hairline' || value === 'shadow' || value === 'outset') {
                  patch({ boundedEdge: value });
                }
              }}
              className="w-full max-w-md"
            />
            <UiCheckbox
              checked={layoutWidthUserControl}
              onChange={(event) => patch({ layoutWidthUserControl: event.target.checked })}
            >
              Show expand control in header for visitors
            </UiCheckbox>
          </>
        ) : null}
      </div>
    );
  }

  if (variant === 'footer') {
    return (
      <FooterShellLayoutControl
        layoutWidth={layoutWidth}
        boundedMaxWidth={boundedMaxWidth}
        boundedEdge={boundedEdge}
        onPatch={patch}
      />
    );
  }

  return (
    <div
      className="flex min-w-0 flex-wrap items-center justify-center gap-2"
      data-testid="live-designer-shell-layout-controls"
    >
      <span className="text-xs font-semibold text-slate-600">Page width</span>
      <UiSegmentedControl
        ariaLabel="Shell page width"
        items={[...WIDTH_ITEMS]}
        selectedKey={layoutWidth}
        onSelectionChange={(key) => {
          if (key === 'fluid' || key === 'bounded') {
            patch({ layoutWidth: key });
          }
        }}
        className="shrink-0"
      />
      {layoutWidth === 'bounded' ? (
        <>
          <ToolbarFilterSelect
            ariaLabel="Bounded column width"
            value={boundedMaxWidth}
            options={SHELL_BOUNDED_MAX_OPTIONS}
            onChange={(value) => {
              if (value === 'sm' || value === 'md' || value === 'lg') {
                patch({ boundedMaxWidth: value });
              }
            }}
            className="min-w-[9.5rem]"
          />
          <ToolbarFilterSelect
            ariaLabel="Bounded column edge"
            value={boundedEdge}
            options={SHELL_BOUNDED_EDGE_OPTIONS}
            onChange={(value) => {
              if (value === 'hairline' || value === 'shadow' || value === 'outset') {
                patch({ boundedEdge: value });
              }
            }}
            className="min-w-[8.5rem]"
          />
        </>
      ) : null}
    </div>
  );
};

const FooterShellLayoutControl: React.FC<{
  layoutWidth: 'fluid' | 'bounded';
  boundedMaxWidth: 'sm' | 'md' | 'lg';
  boundedEdge: 'hairline' | 'shadow' | 'outset';
  onPatch: ReturnType<typeof useShellLayoutPatch>;
}> = ({ layoutWidth, boundedMaxWidth, boundedEdge, onPatch }) => {
  const widthOptions = [
    { value: 'fluid' as const, label: 'Full width' },
    { value: 'bounded' as const, label: 'Bounded' },
  ];
  const maxOptions = SHELL_BOUNDED_MAX_OPTIONS.map((option) => ({ value: option.value, label: option.label }));
  const edgeOptions = SHELL_BOUNDED_EDGE_OPTIONS.map((option) => ({ value: option.value, label: option.label }));

  return (
    <div className="flex min-w-0 items-center gap-1.5" data-testid="live-designer-shell-layout-controls">
      <span className="shrink-0 font-medium uppercase tracking-wide text-slate-400">Page</span>
      <FooterLabelDropdown
        ariaLabel="Shell page width"
        value={layoutWidth}
        options={widthOptions}
        onChange={(next) => onPatch({ layoutWidth: next })}
        triggerClassName="text-violet-700 hover:text-violet-800"
      />
      {layoutWidth === 'bounded' ? (
        <>
          <FooterLabelDropdown
            ariaLabel="Bounded column width"
            value={boundedMaxWidth}
            options={maxOptions}
            onChange={(next) => onPatch({ boundedMaxWidth: next })}
            triggerClassName="text-violet-700 hover:text-violet-800"
          />
          <FooterLabelDropdown
            ariaLabel="Bounded column edge"
            value={boundedEdge}
            options={edgeOptions}
            onChange={(next) => onPatch({ boundedEdge: next })}
            triggerClassName="text-violet-700 hover:text-violet-800"
          />
        </>
      ) : null}
    </div>
  );
};
