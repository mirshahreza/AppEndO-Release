import {
  adjustCanvasTone,
  canvasToDataUrl,
  dataUrlToCanvas,
  flipCanvas,
  resizeCanvas,
  rotateCanvas,
  rotateCanvasByDegrees,
} from './imageEditor';

export type LocalImageEditKind =
  | { kind: 'rotate'; degrees: number }
  | { kind: 'flip-horizontal' }
  | { kind: 'flip-vertical' }
  | { kind: 'brighten'; amount: number }
  | { kind: 'darken'; amount: number }
  | { kind: 'contrast'; amount: number }
  | { kind: 'upscale'; factor: number };

export type LocalImageEditResult = {
  dataUrl: string;
  label: string;
};

const normalizePromptDigits = (prompt: string): string => {
  const easternArabicDigits = '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9';
  const arabicIndicDigits = '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
  return prompt.replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (character) => {
    const easternIndex = easternArabicDigits.indexOf(character);
    if (easternIndex >= 0) return String(easternIndex);
    const arabicIndex = arabicIndicDigits.indexOf(character);
    if (arabicIndex >= 0) return String(arabicIndex);
    return character;
  });
};

const parseRotationDegrees = (prompt: string): number | null => {
  const normalized = normalizePromptDigits(prompt.toLowerCase());

  const rotateMatch = normalized.match(
    /(?:rotate|turn|spin)[^\d+-]*([+-]?\d+(?:\.\d+)?)\s*(?:°|deg(?:ree)?s?)?/i,
  );
  const angleMatch = normalized.match(/([+-]?\d+(?:\.\d+)?)\s*(?:°|deg(?:ree)?s?)/i);

  let degrees: number | null = null;
  if (rotateMatch) degrees = Number.parseFloat(rotateMatch[1]);
  else if (angleMatch) degrees = Number.parseFloat(angleMatch[1]);

  if (degrees === null || Number.isNaN(degrees)) {
    if (/(?:rotate|turn|spin).*(?:right|clockwise|cw)/i.test(normalized)) {
      return 90;
    }
    if (/(?:rotate|turn|spin).*(?:left|counter(?:clockwise)?|ccw)/i.test(normalized)) {
      return -90;
    }
    return null;
  }

  const hasExplicitSign = /^[+-]/.test(rotateMatch?.[1] ?? angleMatch?.[1] ?? '');
  if (!hasExplicitSign && /(?:left|counter(?:clockwise)?|ccw)/i.test(normalized)) {
    degrees = -Math.abs(degrees);
  }

  return degrees;
};

const parseAmount = (prompt: string, fallback = 20): number => {
  const normalized = normalizePromptDigits(prompt);
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)?/);
  if (!match) return fallback;
  const amount = Number.parseFloat(match[1]);
  return Number.isNaN(amount) ? fallback : amount;
};

const formatRotationLabel = (degrees: number): string => `Rotate ${degrees}°`;

export const matchLocalImageEditPrompt = (prompt: string): LocalImageEditKind | null => {
  const trimmed = prompt.trim();
  if (!trimmed) return null;

  const normalized = normalizePromptDigits(trimmed.toLowerCase());

  const rotationDegrees = parseRotationDegrees(trimmed);
  if (rotationDegrees !== null) {
    return { kind: 'rotate', degrees: Math.round(rotationDegrees * 100) / 100 };
  }

  if (/(?:flip|mirror).*(?:horizontal)|(?:horizontal).*(?:flip|mirror)/i.test(normalized)) {
    return { kind: 'flip-horizontal' };
  }

  if (/(?:flip|mirror).*(?:vertical)|(?:vertical).*(?:flip|mirror)/i.test(normalized)) {
    return { kind: 'flip-vertical' };
  }

  if (/(?:brighten|lighter)/i.test(normalized)) {
    return { kind: 'brighten', amount: parseAmount(trimmed, 20) };
  }

  if (/(?:darken|darker)/i.test(normalized)) {
    return { kind: 'darken', amount: parseAmount(trimmed, 20) };
  }

  if (/(?:contrast)/i.test(normalized)) {
    const amount = parseAmount(trimmed, 20);
    const signedAmount = /(?:reduce|decrease|lower)/i.test(normalized) ? -amount : amount;
    return { kind: 'contrast', amount: signedAmount };
  }

  if (/(?:upscale|enhance quality|sharpen)/i.test(normalized)) {
    const factorMatch = normalized.match(/(\d+(?:\.\d+)?)\s*x\b/);
    const factor = factorMatch ? Number.parseFloat(factorMatch[1]) : 1.5;
    const safeFactor = Number.isNaN(factor) ? 1.5 : Math.min(3, Math.max(1.1, factor));
    return { kind: 'upscale', factor: safeFactor };
  }

  return null;
};

const applyLocalImageEdit = (source: HTMLCanvasElement, edit: LocalImageEditKind): { canvas: HTMLCanvasElement; label: string } => {
  switch (edit.kind) {
    case 'rotate': {
      const canvas = edit.degrees === 90 || edit.degrees === -90 || edit.degrees === 180 || edit.degrees === -180
        ? rotateCanvas(source, edit.degrees as 90 | -90 | 180)
        : rotateCanvasByDegrees(source, edit.degrees);
      return { canvas, label: formatRotationLabel(edit.degrees) };
    }
    case 'flip-horizontal':
      return { canvas: flipCanvas(source, true), label: 'Flip horizontal' };
    case 'flip-vertical':
      return { canvas: flipCanvas(source, false), label: 'Flip vertical' };
    case 'brighten':
      return {
        canvas: adjustCanvasTone(source, { brightness: edit.amount }),
        label: `Brighten ${edit.amount}%`,
      };
    case 'darken':
      return {
        canvas: adjustCanvasTone(source, { brightness: -edit.amount }),
        label: `Darken ${edit.amount}%`,
      };
    case 'contrast':
      return {
        canvas: adjustCanvasTone(source, { contrast: edit.amount }),
        label: `Contrast ${edit.amount > 0 ? '+' : ''}${edit.amount}%`,
      };
    case 'upscale': {
      const upscaled = resizeCanvas(
        source,
        Math.round(source.width * edit.factor),
        Math.round(source.height * edit.factor),
      );
      return { canvas: upscaled, label: `Upscale ${edit.factor}x` };
    }
    default:
      return { canvas: source, label: 'Edit' };
  }
};

export const tryLocalImageEditPrompt = async (
  prompt: string,
  imageSrc: string,
): Promise<LocalImageEditResult | null> => {
  const edit = matchLocalImageEditPrompt(prompt);
  if (!edit) return null;

  const source = await dataUrlToCanvas(imageSrc);
  const { canvas, label } = applyLocalImageEdit(source, edit);
  const mime = edit.kind === 'upscale' ? 'image/jpeg' : 'image/png';
  const quality = edit.kind === 'upscale' ? 0.92 : undefined;
  return {
    dataUrl: canvasToDataUrl(canvas, mime, quality),
    label,
  };
};
