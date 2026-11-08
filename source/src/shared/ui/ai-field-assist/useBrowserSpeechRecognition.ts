import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const scoped = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return scoped.SpeechRecognition ?? scoped.webkitSpeechRecognition ?? null;
}

export type UseBrowserSpeechRecognitionOptions = {
  lang?: string;
  continuous?: boolean;
  onFinalTranscript?: (text: string) => void;
};

export function useBrowserSpeechRecognition(options?: UseBrowserSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const supported = getSpeechRecognitionCtor() !== null;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    setError(null);
    setTranscript('');

    const recognition = new Ctor();
    recognition.lang = options?.lang?.trim() || 'en-US';
    recognition.continuous = options?.continuous ?? true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let next = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        next += event.results[index][0]?.transcript ?? '';
      }
      setTranscript(next.trim());
      const lastResult = event.results[event.results.length - 1];
      if (lastResult?.isFinal) {
        options?.onFinalTranscript?.(next.trim());
      }
    };

    recognition.onerror = (event) => {
      setError(event.error === 'not-allowed'
        ? 'Microphone permission was denied.'
        : `Speech recognition error: ${event.error}`);
      stop();
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [options, stop]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
  }, []);

  return {
    supported,
    isListening,
    transcript,
    error,
    start,
    stop,
  };
}
