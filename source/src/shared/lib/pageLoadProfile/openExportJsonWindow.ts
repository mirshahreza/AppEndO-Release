import { PAGE_LOAD_PROFILE_COPY as COPY } from './pageLoadProfileCopy';

/** Opens formatted export JSON in a new browser tab (no inline preview in the profile dialog). */
export const openPageLoadProfileExportWindow = (json: string): boolean => {
  if (typeof window === 'undefined' || !json.trim()) {
    return false;
  }
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768');
  if (!popup) {
    return false;
  }
  popup.document.title = COPY.title;
  const doc = popup.document;
  doc.documentElement.lang = 'en';
  const style = doc.createElement('style');
  style.textContent = `
    body { margin: 0; padding: 16px; font: 12px/1.45 ui-monospace, monospace; background: #f8fafc; color: #0f172a; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
  `;
  doc.head.appendChild(style);
  const pre = doc.createElement('pre');
  pre.textContent = json;
  doc.body.appendChild(pre);
  return true;
};
