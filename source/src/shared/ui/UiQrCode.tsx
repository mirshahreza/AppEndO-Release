import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export type UiQrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export type UiQrCodeProps = {
  value?: string;
  size?: number;
  errorCorrectionLevel?: UiQrErrorCorrectionLevel | string;
  logoOverlay?: string;
  downloadable?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'data-designer-component'?: string;
};

const resolveEcl = (raw: unknown): UiQrErrorCorrectionLevel => {
  if (raw === 'L' || raw === 'M' || raw === 'Q' || raw === 'H') {
    return raw;
  }
  return 'M';
};

export const UiQrCode: React.FC<UiQrCodeProps> = ({
  value,
  size = 160,
  errorCorrectionLevel = 'M',
  logoOverlay,
  downloadable = false,
  className,
  style,
  'data-designer-component': dataDesignerComponent = 'content.qr-code',
}) => {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const resolvedValue = typeof value === 'string' ? value.trim() : '';
  const pixelSize = Number.isFinite(size) && size > 0 ? Math.round(size) : 160;
  const ecl = resolveEcl(errorCorrectionLevel);
  const logo = typeof logoOverlay === 'string' ? logoOverlay.trim() : '';

  const handleDownload = React.useCallback(() => {
    const svg = wrapperRef.current?.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'qr-code.svg';
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`inline-flex flex-col items-center gap-2 ${className ?? ''}`}
      style={style}
      data-designer-component={dataDesignerComponent}
      data-qr-value={resolvedValue || undefined}
    >
      {resolvedValue ? (
        <div className="relative" style={{ width: pixelSize, height: pixelSize }}>
          <QRCodeSVG
            value={resolvedValue}
            size={pixelSize}
            level={ecl}
            includeMargin
            data-testid="ui-qr-svg"
          />
          {logo ? (
            <img
              src={logo}
              alt=""
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-white object-contain p-0.5"
              style={{ width: pixelSize * 0.22, height: pixelSize * 0.22 }}
              data-testid="ui-qr-logo"
            />
          ) : null}
        </div>
      ) : (
        <div
          className="flex items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500"
          style={{ width: pixelSize, height: pixelSize }}
        >
          Set QR value
        </div>
      )}
      {downloadable && resolvedValue ? (
        <button
          type="button"
          data-testid="ui-qr-download"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
          onClick={handleDownload}
        >
          Download
        </button>
      ) : null}
    </div>
  );
};
