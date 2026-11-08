import * as React from 'react';
import JsBarcode from 'jsbarcode';

export type UiBarcodeFormat = 'CODE128' | 'EAN13' | 'UPC';

export type UiBarcodeProps = {
  value?: string;
  format?: UiBarcodeFormat | string;
  showValue?: boolean;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  'data-designer-component'?: string;
};

const resolveFormat = (raw: unknown): UiBarcodeFormat => {
  if (raw === 'CODE128' || raw === 'EAN13' || raw === 'UPC') {
    return raw;
  }
  return 'CODE128';
};

export const UiBarcode: React.FC<UiBarcodeProps> = ({
  value,
  format = 'CODE128',
  showValue = true,
  size = 2,
  className,
  style,
  'data-designer-component': dataDesignerComponent = 'content.barcode',
}) => {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const resolvedValue = typeof value === 'string' ? value.trim() : '';
  const resolvedFormat = resolveFormat(format);
  const lineWidth = Number.isFinite(size) && size > 0 ? size : 2;

  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    if (!resolvedValue) {
      setError(null);
      while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
      }
      return;
    }
    try {
      JsBarcode(svg, resolvedValue, {
        format: resolvedFormat,
        displayValue: showValue,
        width: lineWidth,
        height: 64,
        margin: 8,
        fontSize: 14,
      });
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid barcode value');
      while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
      }
    }
  }, [resolvedValue, resolvedFormat, showValue, lineWidth]);

  return (
    <div
      className={`inline-flex flex-col items-center ${className ?? ''}`}
      style={style}
      data-designer-component={dataDesignerComponent}
      data-barcode-format={resolvedFormat}
      data-barcode-value={resolvedValue || undefined}
    >
      <svg ref={svgRef} data-testid="ui-barcode-svg" />
      {!resolvedValue ? (
        <p className="text-xs text-slate-500">Set barcode value</p>
      ) : null}
      {error ? (
        <p className="text-xs text-rose-600" data-testid="ui-barcode-error">
          {error}
        </p>
      ) : null}
    </div>
  );
};
