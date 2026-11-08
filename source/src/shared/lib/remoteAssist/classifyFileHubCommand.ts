import type { RemoteCommandEffect } from './classifyShellCommand';

const READ_VERBS = new Set([
  'cd',
  'dir',
  'help',
  'ls',
  'mlsd',
  'nlist',
  'pwd',
  'size',
  'stat',
]);

const firstVerb = (command: string): string => {
  const trimmed = command.replace(/\0/g, '').trim();
  if (!trimmed) {
    return '';
  }
  let current = '';
  let quote: "'" | '"' | null = null;
  for (const char of trimmed) {
    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        break;
      }
      continue;
    }
    current += char;
  }
  return current.toLowerCase();
};

export function classifyFileHubCommand(command: string): RemoteCommandEffect {
  const verb = firstVerb(command);
  if (!verb) {
    return 'write';
  }
  return READ_VERBS.has(verb) ? 'read' : 'write';
}
