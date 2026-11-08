export type AgentMessageAttachment = {
  id: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'file';
  previewUrl?: string;
  size: number;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const DATA_IMAGE_PREFIX = 'data:image/';
const BASE64_DATA_URL_MARKER = ';base64,';

const isBase64DataUrlChar = (char: string): boolean => (
  /[A-Za-z0-9+/=]/.test(char)
);

const getBase64RunLength = (content: string, start: number): number => {
  let index = start;
  while (index < content.length && isBase64DataUrlChar(content[index])) {
    index += 1;
  }
  return index - start;
};

const findDataImageUrlRange = (content: string, start: number): { end: number; url: string } => {
  const markerIndex = content.indexOf(BASE64_DATA_URL_MARKER, start);
  if (markerIndex >= 0) {
    const payloadStart = markerIndex + BASE64_DATA_URL_MARKER.length;
    let end = payloadStart;
    const compactPayload: string[] = [];

    while (end < content.length) {
      const char = content[end];
      if (isBase64DataUrlChar(char)) {
        compactPayload.push(char);
        end += 1;
        continue;
      }
      if (/\s/.test(char)) {
        let next = end + 1;
        while (next < content.length && /\s/.test(content[next])) {
          next += 1;
        }
        const nextRunLength = getBase64RunLength(content, next);
        if (nextRunLength >= 32) {
          end = next;
          continue;
        }
        break;
      }
      break;
    }

    return {
      end,
      url: `${content.slice(start, payloadStart)}${compactPayload.join('')}`,
    };
  }

  let end = start;
  while (end < content.length) {
    const char = content[end];
    if (/\s/.test(char) || char === ')' || char === '"' || char === '\'' || char === '<' || char === '>') {
      break;
    }
    end += 1;
  }

  return {
    end,
    url: content.slice(start, end),
  };
};

const findEmbeddedDataImageMarkdown = (
  content: string,
  searchFrom = 0,
): { start: number; end: number; url: string } | null => {
  const markerStart = content.indexOf('![', searchFrom);
  if (markerStart < 0) return null;

  const urlMarker = `](${DATA_IMAGE_PREFIX}`;
  const urlMarkerIndex = content.indexOf(urlMarker, markerStart);
  if (urlMarkerIndex < 0) return null;

  const urlStart = urlMarkerIndex + 2;
  const { end: rawUrlEnd, url } = findDataImageUrlRange(content, urlStart);
  const markdownEnd = content[rawUrlEnd] === ')' ? rawUrlEnd + 1 : rawUrlEnd;

  return {
    start: markerStart,
    end: markdownEnd,
    url,
  };
};

export const extractEmbeddedDataImageUrls = (content: string): string[] => {
  const urls: string[] = [];
  let searchFrom = 0;

  while (searchFrom < content.length) {
    const match = findEmbeddedDataImageMarkdown(content, searchFrom);
    if (!match) break;
    urls.push(match.url);
    searchFrom = match.end;
  }

  searchFrom = 0;
  while (searchFrom < content.length) {
    const index = content.indexOf(DATA_IMAGE_PREFIX, searchFrom);
    if (index < 0) break;

    const { end, url } = findDataImageUrlRange(content, index);
    if (!urls.includes(url)) {
      urls.push(url);
    }
    searchFrom = Math.max(end, index + DATA_IMAGE_PREFIX.length);
  }

  return urls;
};

export const stripRawDataImageUrls = (content: string): string => {
  let result = content;
  let searchFrom = 0;

  while (searchFrom < result.length) {
    const index = result.indexOf(DATA_IMAGE_PREFIX, searchFrom);
    if (index < 0) break;

    const { end } = findDataImageUrlRange(result, index);

    result = `${result.slice(0, index)}${result.slice(end)}`;
    searchFrom = index;
  }

  return result
    .replace(/!\[[^\]]*\]\(\s*\)?/g, '')
    .replace(/!\[[^\]]*\]\s*/g, '');
};

const stripNamedImageMarkdown = (content: string, name: string): string => {
  const prefix = `![${name}](`;
  let result = content;
  let searchFrom = 0;

  while (searchFrom < result.length) {
    const start = result.indexOf(prefix, searchFrom);
    if (start < 0) break;

    const urlStart = start + prefix.length;
    const end = result.indexOf(')', urlStart);
    if (end < 0) break;

    result = `${result.slice(0, start)}${result.slice(end + 1)}`;
    searchFrom = start;
  }

  return result;
};

export const stripEmbeddedAttachmentMarkdown = (content: string): string => {
  let result = content;

  while (true) {
    const match = findEmbeddedDataImageMarkdown(result);
    if (!match) break;
    result = `${result.slice(0, match.start)}${result.slice(match.end)}`;
  }

  return stripRawDataImageUrls(
    result.replace(/\n*\[Attachment:[^\]]+\]/g, ''),
  ).trim();
};

export const stripAttachmentEnrichmentFromContent = (
  content: string,
  attachments?: AgentMessageAttachment[],
): string => {
  let result = stripEmbeddedAttachmentMarkdown(content);

  if (!attachments?.length) {
    return result;
  }

  attachments.forEach((attachment) => {
    if (attachment.kind === 'image' && attachment.previewUrl?.trim()) {
      result = stripNamedImageMarkdown(result, attachment.name);
      const previewUrl = attachment.previewUrl.trim();
      let previewSearchFrom = 0;
      while (previewSearchFrom < result.length) {
        const index = result.indexOf(previewUrl, previewSearchFrom);
        if (index < 0) break;
        result = `${result.slice(0, index)}${result.slice(index + previewUrl.length)}`;
        previewSearchFrom = index;
      }
      return;
    }
    const escapedName = escapeRegExp(attachment.name);
    result = result.replace(
      new RegExp(`\\n*\\[Attachment:\\s*${escapedName}[^\\]]*\\]`, 'g'),
      '',
    );
  });

  return stripRawDataImageUrls(result).trim();
};

export const hasImageAttachmentPreview = (
  attachments?: AgentMessageAttachment[],
): boolean => (
  attachments?.some((attachment) => (
    Boolean(attachment.previewUrl?.trim())
    && (attachment.kind === 'image' || attachment.mimeType.startsWith('image/'))
  )) ?? false
);

export const containsAttachmentPayloadText = (content: string): boolean => (
  content.includes('data:image/')
  || content.includes('![')
  || /\[Attachment:[^\]]+\]/.test(content)
);

export const resolveChatMessageDisplayContent = (
  content: string,
  attachments?: AgentMessageAttachment[],
): string => stripAttachmentEnrichmentFromContent(content, attachments);

export const cloneAgentMessageAttachments = (
  attachments?: AgentMessageAttachment[],
): AgentMessageAttachment[] | undefined => (
  attachments?.map((attachment) => ({ ...attachment }))
);

const ATTACHMENT_PAYLOAD_MARKERS = ['![', 'data:image/', '[Attachment:'] as const;

/** O(n) fast path — avoids scanning megabyte base64 payloads during strip loops. */
export const extractUserTextBeforeAttachmentPayload = (content: string): string => {
  let cutAt = content.length;
  for (const marker of ATTACHMENT_PAYLOAD_MARKERS) {
    const index = content.indexOf(marker);
    if (index >= 0) {
      cutAt = Math.min(cutAt, index);
    }
  }
  return content.slice(0, cutAt).trim();
};

export const sanitizeUserMessageForUi = (
  message: {
    role: string;
    content: string;
    attachments?: AgentMessageAttachment[];
  },
): { role: 'user'; content: string; attachments?: AgentMessageAttachment[] } => {
  const attachments = cloneAgentMessageAttachments(message.attachments);

  if (hasImageAttachmentPreview(attachments) && containsAttachmentPayloadText(message.content)) {
    return {
      role: 'user',
      content: extractUserTextBeforeAttachmentPayload(message.content),
      attachments,
    };
  }

  return {
    role: 'user',
    content: resolveChatMessageDisplayContent(message.content, attachments),
    attachments,
  };
};

export const enrichAgentMessageContent = (
  content: string,
  attachments?: AgentMessageAttachment[],
): string => {
  if (!attachments?.length) {
    return content;
  }

  const parts = [content.trim()];
  attachments.forEach((attachment) => {
    if (attachment.kind === 'image' && attachment.previewUrl?.trim()) {
      parts.push(`\n\n![${attachment.name}](${attachment.previewUrl.trim()})`);
      return;
    }
    parts.push(`\n\n[Attachment: ${attachment.name} (${attachment.mimeType}, ${attachment.size} bytes)]`);
  });

  return parts.filter(Boolean).join('');
};

export const buildApiChatMessages = (
  messages: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    attachments?: AgentMessageAttachment[];
  }>,
): Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }> => (
  messages.map((message) => ({
    role: message.role,
    content: enrichAgentMessageContent(message.content, message.attachments),
  }))
);
