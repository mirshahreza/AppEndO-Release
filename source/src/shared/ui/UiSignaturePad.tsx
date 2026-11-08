import React, { useCallback, useEffect, useRef } from 'react';
import SignaturePad from 'signature_pad';
import { cn } from '../../lib/utils';
import { AppButton } from './AppButton';

export type UiSignaturePadProps = {
  penColor?: string;
  height?: number;
  disabled?: boolean;
  className?: string;
  onChange?: (dataUrl: string) => void;
};

const resizeCanvas = (canvas: HTMLCanvasElement, pad: SignaturePad) => {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const data = pad.isEmpty() ? null : pad.toData();
  canvas.width = canvas.offsetWidth * ratio;
  canvas.height = canvas.offsetHeight * ratio;
  const context = canvas.getContext('2d');
  context?.scale(ratio, ratio);
  pad.clear();
  if (data) {
    pad.fromData(data);
  }
};

/** Canvas signature capture for approval and workflow forms. */
export const UiSignaturePad: React.FC<UiSignaturePadProps> = ({
  penColor = '#0f172a',
  height = 160,
  disabled,
  className,
  onChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  const emitChange = useCallback(() => {
    const pad = padRef.current;
    if (!pad) {
      return;
    }
    onChange?.(pad.isEmpty() ? '' : pad.toDataURL('image/png'));
  }, [onChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const pad = new SignaturePad(canvas, { penColor, backgroundColor: 'rgb(255,255,255)' });
    padRef.current = pad;
    resizeCanvas(canvas, pad);
    const onStroke = () => emitChange();
    pad.addEventListener('endStroke', onStroke);
    const onResize = () => resizeCanvas(canvas, pad);
    window.addEventListener('resize', onResize);
    return () => {
      pad.removeEventListener('endStroke', onStroke);
      window.removeEventListener('resize', onResize);
      pad.off();
      padRef.current = null;
    };
  }, [emitChange, penColor]);

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) {
      return;
    }
    if (disabled) {
      pad.off();
    } else {
      pad.on();
    }
  }, [disabled]);

  return (
    <div className={cn('w-full max-w-lg', className)}>
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border border-slate-200 bg-white"
        style={{ height }}
        aria-label="Signature"
      />
      <div className="mt-2 flex justify-end">
        <AppButton
          type="button"
          intent="utility"
          size="sm"
          disabled={disabled}
          onClick={() => {
            padRef.current?.clear();
            emitChange();
          }}
        >
          Clear
        </AppButton>
      </div>
    </div>
  );
};
