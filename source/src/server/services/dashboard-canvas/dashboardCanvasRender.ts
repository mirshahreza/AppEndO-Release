import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';
import type { PivotResult } from '../../../shared/api/contracts/data-api';

export type PivotSnapshotRenderInput = {
  title: string;
  takenAt: string;
  results: Array<{ widgetId: string; result: PivotResult }>;
};

const wrapLines = (text: string, max = 96): string[] => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const escapeXml = (value: string): string => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
);

export const renderPivotSnapshotPdf = async (input: PivotSnapshotRenderInput): Promise<Buffer> => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([612, 792]);
  let y = 760;
  const draw = (text: string, size = 11, useBold = false) => {
    if (y < 48) {
      page = doc.addPage([612, 792]);
      y = 760;
    }
    page.drawText(text, {
      x: 36,
      y,
      size,
      font: useBold ? bold : font,
      color: rgb(0.12, 0.16, 0.22),
    });
    y -= size + 6;
  };

  draw(input.title, 16, true);
  draw(`Snapshot taken at ${input.takenAt}`, 10);
  y -= 8;
  for (const entry of input.results) {
    draw(`Widget ${entry.widgetId}`, 12, true);
    draw(`Measures: ${entry.result.measures.map((item) => `${item.field} (${item.aggregation})`).join(', ') || 'none'}`);
    const preview = entry.result.cells.slice(0, 12).map((cell) => (
      `${cell.rowKey} / ${cell.colKey}: ${cell.values.map((value) => (value == null ? '—' : String(value))).join(', ')}`
    ));
    for (const line of preview.flatMap((line) => wrapLines(line))) {
      draw(line, 9);
    }
    if (entry.result.cells.length > 12) {
      draw(`… ${entry.result.cells.length - 12} more cells`, 9);
    }
    y -= 10;
  }

  return Buffer.from(await doc.save());
};

export const renderPivotSnapshotText = (input: PivotSnapshotRenderInput): string => {
  const lines = [
    input.title,
    `Snapshot taken at ${input.takenAt}`,
    '',
  ];
  for (const entry of input.results) {
    lines.push(`Widget ${entry.widgetId}`);
    lines.push(`Measures: ${entry.result.measures.map((item) => `${item.field} (${item.aggregation})`).join(', ')}`);
    for (const cell of entry.result.cells.slice(0, 40)) {
      lines.push(`  ${cell.rowKey} / ${cell.colKey}: ${cell.values.map((value) => (value == null ? 'null' : String(value))).join(', ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
};

export const renderPivotSnapshotPng = async (input: PivotSnapshotRenderInput): Promise<Buffer> => {
  const lines = renderPivotSnapshotText(input).split('\n').slice(0, 80);
  const width = 1200;
  const height = Math.max(640, 80 + lines.length * 22);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    '<rect width="100%" height="100%" fill="#f8fafc"/>',
    ...lines.map((line, index) => (
      `<text x="40" y="${56 + index * 22}" font-family="Arial, sans-serif" font-size="${index === 0 ? 22 : 14}" fill="#0f172a">${escapeXml(line)}</text>`
    )),
    '</svg>',
  ].join('');
  return sharp(Buffer.from(svg)).png().toBuffer();
};
