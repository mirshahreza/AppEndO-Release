export function findTextareaElement(container: HTMLElement | null): HTMLTextAreaElement | null {
  if (!container) {
    return null;
  }
  const textarea = container.querySelector('textarea');
  return textarea instanceof HTMLTextAreaElement ? textarea : null;
}

export function readTextareaValue(
  textarea: HTMLTextAreaElement | null,
  controlledValue?: string,
): string {
  if (textarea) {
    return textarea.value;
  }
  if (controlledValue !== undefined) {
    return controlledValue;
  }
  return '';
}

export function writeTextareaValue(
  textarea: HTMLTextAreaElement | null,
  nextValue: string,
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void,
): void {
  if (onChange) {
    onChange({ target: { value: nextValue } } as React.ChangeEvent<HTMLTextAreaElement>);
    return;
  }

  if (!textarea) {
    return;
  }

  textarea.value = nextValue;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

export type TextareaSelection = {
  start: number;
  end: number;
  text: string;
};

export function readTextareaSelection(textarea: HTMLTextAreaElement | null): TextareaSelection | null {
  if (!textarea) {
    return null;
  }

  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  if (start === end) {
    return null;
  }

  return {
    start,
    end,
    text: textarea.value.slice(start, end),
  };
}

export function readTextareaCursorPosition(textarea: HTMLTextAreaElement | null): number {
  if (!textarea) {
    return 0;
  }
  return textarea.selectionStart ?? textarea.value.length;
}
