import { useCallback } from 'react';

export function useBrowserTextToSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = useCallback((text: string, lang = 'en-US') => {
    if (!supported || !text.trim()) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  }, [supported]);

  const cancel = useCallback(() => {
    if (!supported) {
      return;
    }
    window.speechSynthesis.cancel();
  }, [supported]);

  return { supported, speak, cancel };
}

export function buildVoiceFillSummary(
  rows: Array<{ label: string; value: string }>,
): string {
  if (rows.length === 0) {
    return 'No fields were filled.';
  }

  const parts = rows.map((row) => `${row.label}: ${row.value}`);
  return `Filled fields. ${parts.join('. ')}`;
}
