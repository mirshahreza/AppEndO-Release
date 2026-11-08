export type SshHubSessionControlMessage = {
  type: string;
  message?: string;
};

const decodeFrameText = (data: unknown): string | null => {
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data);
  }
  return null;
};

export function parseSshHubSessionControl(data: unknown): SshHubSessionControlMessage | null {
  const text = decodeFrameText(data)?.trim();
  if (!text?.startsWith('{')) {
    return null;
  }
  try {
    const parsed = JSON.parse(text) as { type?: unknown; message?: unknown };
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
      return null;
    }
    return {
      type: parsed.type,
      message: typeof parsed.message === 'string' ? parsed.message : undefined,
    };
  } catch {
    return null;
  }
}
