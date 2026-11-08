import * as React from 'react';
import { slotRegistry } from '../../core/slots/SlotRegistry';

export const DASHBOARD_WIDGETS_SLOT_ID = 'core.dashboard.widgets';

export const DASHBOARD_WIDGET_GRID_CLASS = 'grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

type DesignerRuntimeRegisteredSlotFillProps = {
  slotId: string;
  label: string;
  surface: string;
  className?: string;
  style?: React.CSSProperties;
};

const SlotEmptyPlaceholder: React.FC<{
  slotId: string;
  label: string;
  surface: string;
}> = ({ slotId, label, surface }) => (
  <div className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-violet-300 bg-violet-50/80 px-4 py-3 text-center">
    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-600">Platform Slot</span>
    <span className="text-sm font-semibold text-violet-900">{label}</span>
    {slotId ? <span className="font-mono text-[10px] text-violet-700/80">{slotId}</span> : null}
    <span className="text-[10px] text-violet-600/70">{surface}</span>
  </div>
);

/** Renders live `slotRegistry` fills for generic platform slots (not shell chrome). */
export const DesignerRuntimeRegisteredSlotFill: React.FC<DesignerRuntimeRegisteredSlotFillProps> = ({
  slotId,
  label,
  surface,
  className,
  style,
}) => {
  const subscribe = React.useCallback((listener: () => void) => slotRegistry.subscribe(listener), []);
  const getSnapshot = React.useCallback(() => slotRegistry.getComponents(slotId), [slotId]);
  const components = React.useSyncExternalStore(subscribe, getSnapshot);

  if (components.length === 0) {
    return (
      <div className={className} style={style}>
        <SlotEmptyPlaceholder slotId={slotId} label={label} surface={surface} />
      </div>
    );
  }

  const rendered = components.map((entry) => (
    <entry.component key={entry.id} />
  ));

  if (slotId === DASHBOARD_WIDGETS_SLOT_ID) {
    return (
      <div className={className} style={style}>
        <div className={DASHBOARD_WIDGET_GRID_CLASS}>{rendered}</div>
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      {rendered}
    </div>
  );
};
