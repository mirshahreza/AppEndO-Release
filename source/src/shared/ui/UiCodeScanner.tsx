import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { cn } from '../../lib/utils';
import { AppButton } from './AppButton';

export type UiCodeScannerFacing = 'environment' | 'user';

export type UiCodeScannerProps = {
  facingMode?: UiCodeScannerFacing;
  className?: string;
  onScan?: (value: string) => void;
};

/** Camera barcode / QR reader. Starts only after an explicit operator action. */
export const UiCodeScanner: React.FC<UiCodeScannerProps> = ({
  facingMode = 'environment',
  className,
  onScan,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [active, setActive] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const stop = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setActive(false);
  };

  useEffect(() => () => {
    stop();
  }, []);

  const start = async () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setError(null);
    setValue('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      const reader = new BrowserMultiFormatReader();
      setActive(true);
      const controls = await reader.decodeFromStream(stream, video, (result) => {
        if (!result) {
          return;
        }
        const text = result.getText();
        setValue(text);
        onScan?.(text);
      });
      controlsRef.current = controls;
    } catch (cause) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      setActive(false);
      setError(cause instanceof Error ? cause.message : 'Camera access failed.');
    }
  };

  return (
    <div className={cn('w-full max-w-md', className)}>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <video
          ref={videoRef}
          className="aspect-video w-full bg-slate-900"
          muted
          playsInline
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {active ? (
          <AppButton type="button" intent="secondary" size="sm" onClick={stop}>Stop camera</AppButton>
        ) : (
          <AppButton type="button" intent="secondary" size="sm" onClick={() => { void start(); }}>Start camera</AppButton>
        )}
        {value ? <span className="truncate text-xs text-cyan-700">{value}</span> : null}
      </div>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
};
