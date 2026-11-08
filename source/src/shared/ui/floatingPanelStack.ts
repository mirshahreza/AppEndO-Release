const FLOATING_PANEL_STACK_FLOOR = 100;

type StackListener = (zIndex: number) => void;

type StackEntry = {
  id: number;
  layer: number;
  order: number;
  lastZ: number | undefined;
  listener: StackListener;
};

let nextId = 1;
let nextOrder = 1;
const entries = new Map<number, StackEntry>();

const publishStack = () => {
  const sorted = [...entries.values()].sort((left, right) => {
    if (left.layer !== right.layer) {
      return left.layer - right.layer;
    }
    return left.order - right.order;
  });

  sorted.forEach((entry, index) => {
    const zIndex = FLOATING_PANEL_STACK_FLOOR + index;
    if (entry.lastZ === zIndex) {
      return;
    }
    entry.lastZ = zIndex;
    entry.listener(zIndex);
  });
};

export const subscribeFloatingPanelStack = (
  listener: StackListener,
  layer = 0,
): { raise: () => void; unregister: () => void } => {
  const id = nextId;
  nextId += 1;
  const entry: StackEntry = {
    id,
    layer,
    order: nextOrder,
    lastZ: undefined,
    listener,
  };
  nextOrder += 1;
  entries.set(id, entry);
  publishStack();

  return {
    raise: () => {
      const current = entries.get(id);
      if (!current) {
        return;
      }
      let topOrder = current.order;
      entries.forEach((item) => {
        if (item.layer === current.layer && item.order > topOrder) {
          topOrder = item.order;
        }
      });
      if (current.order === topOrder) {
        return;
      }
      current.order = nextOrder;
      nextOrder += 1;
      publishStack();
    },
    unregister: () => {
      entries.delete(id);
    },
  };
};

export const resetFloatingPanelStackForTests = () => {
  entries.clear();
  nextId = 1;
  nextOrder = 1;
};
