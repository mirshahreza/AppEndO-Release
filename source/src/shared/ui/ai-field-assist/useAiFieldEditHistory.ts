import { useCallback, useState } from 'react';

export const EUA_FIELD_EDIT_HISTORY_MAX_LEVELS = 20;

export type AiFieldEditHistory = {
  canUndo: boolean;
  canRedo: boolean;
  pushAppliedEdit: (beforeValue: string, afterValue: string) => void;
  undo: (currentValue: string) => string | null;
  redo: (currentValue: string) => string | null;
  clear: () => void;
};

export function useAiFieldEditHistory(maxLevels = EUA_FIELD_EDIT_HISTORY_MAX_LEVELS): AiFieldEditHistory {
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  const pushAppliedEdit = useCallback((beforeValue: string, afterValue: string) => {
    if (beforeValue === afterValue) {
      return;
    }

    setUndoStack((current) => {
      const next = [...current, beforeValue];
      if (next.length > maxLevels) {
        return next.slice(next.length - maxLevels);
      }
      return next;
    });
    setRedoStack([]);
  }, [maxLevels]);

  const undo = useCallback((currentValue: string): string | null => {
    if (undoStack.length === 0) {
      return null;
    }

    const previous = undoStack[undoStack.length - 1] ?? null;
    if (previous === null) {
      return null;
    }

    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, currentValue]);
    return previous;
  }, [undoStack]);

  const redo = useCallback((currentValue: string): string | null => {
    if (redoStack.length === 0) {
      return null;
    }

    const nextValue = redoStack[redoStack.length - 1] ?? null;
    if (nextValue === null) {
      return null;
    }

    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current, currentValue]);
    return nextValue;
  }, [redoStack]);

  const clear = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    pushAppliedEdit,
    undo,
    redo,
    clear,
  };
}
