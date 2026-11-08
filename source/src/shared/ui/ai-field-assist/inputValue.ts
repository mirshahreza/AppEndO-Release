export function findInputElement(container: HTMLElement | null): HTMLInputElement | null {
  if (!container) {
    return null;
  }
  const input = container.querySelector('input');
  return input instanceof HTMLInputElement ? input : null;
}

export function readInputValue(
  input: HTMLInputElement | null,
  controlledValue?: string | number,
): string {
  if (input) {
    return input.value;
  }
  if (controlledValue !== undefined) {
    return String(controlledValue);
  }
  return '';
}

export function writeInputValue(
  input: HTMLInputElement | null,
  nextValue: string,
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void,
): void {
  if (onChange) {
    onChange({ target: { value: nextValue } } as React.ChangeEvent<HTMLInputElement>);
    return;
  }

  if (!input) {
    return;
  }

  input.value = nextValue;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export type InputSelection = {
  start: number;
  end: number;
  text: string;
};

export function readInputSelection(input: HTMLInputElement | null): InputSelection | null {
  if (!input) {
    return null;
  }

  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  if (start === end) {
    return null;
  }

  return {
    start,
    end,
    text: input.value.slice(start, end),
  };
}

export function readInputCursorPosition(input: HTMLInputElement | null): number {
  if (!input) {
    return 0;
  }
  return input.selectionStart ?? input.value.length;
}

export function isAiAssistInputType(type?: string): boolean {
  const normalized = type?.trim().toLowerCase();
  return !normalized || normalized === 'text' || normalized === 'search';
}
