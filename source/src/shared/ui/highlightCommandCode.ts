export type CommandHighlightTokenType =
  | 'command'
  | 'flag'
  | 'string'
  | 'comment'
  | 'operator'
  | 'path'
  | 'text';

export type CommandHighlightToken = {
  type: CommandHighlightTokenType;
  value: string;
};

const HIGHLIGHT_LANGUAGES = new Set([
  'bash',
  'sh',
  'shell',
  'zsh',
  'fish',
  'ksh',
  'ftp',
  'sftp',
  'ftps',
]);

const OPERATORS = new Set(['|', '||', '&&', ';', '>', '>>', '<', '<<', '2>', '&>', '&']);

export function isCommandHighlightLanguage(language: string): boolean {
  return HIGHLIGHT_LANGUAGES.has(language.trim().toLowerCase());
}

export function tokenizeCommandCode(code: string): CommandHighlightToken[] {
  const tokens: CommandHighlightToken[] = [];
  let index = 0;
  let atCommand = true;

  const push = (type: CommandHighlightTokenType, value: string) => {
    if (!value) {
      return;
    }
    const last = tokens[tokens.length - 1];
    if (last && last.type === type) {
      last.value += value;
      return;
    }
    tokens.push({ type, value });
  };

  while (index < code.length) {
    const char = code[index];

    if (char === '#' && (index === 0 || /\s/.test(code[index - 1] ?? ''))) {
      push('comment', code.slice(index));
      break;
    }

    if (char === "'" || char === '"') {
      const quote = char;
      let end = index + 1;
      while (end < code.length) {
        if (code[end] === '\\' && quote === '"') {
          end += 2;
          continue;
        }
        if (code[end] === quote) {
          end += 1;
          break;
        }
        end += 1;
      }
      push('string', code.slice(index, end));
      index = end;
      atCommand = false;
      continue;
    }

    if (char === '\n') {
      push('text', char);
      index += 1;
      atCommand = true;
      continue;
    }

    if (/\s/.test(char)) {
      push('text', char);
      index += 1;
      continue;
    }

    const two = code.slice(index, index + 2);
    if (OPERATORS.has(two) || OPERATORS.has(char)) {
      const operator = OPERATORS.has(two) ? two : char;
      push('operator', operator);
      index += operator.length;
      atCommand = true;
      continue;
    }

    let end = index;
    while (end < code.length && !/\s/.test(code[end]) && code[end] !== ';' && code[end] !== '|' && code[end] !== '&' && code[end] !== '>' && code[end] !== '<' && code[end] !== '#' && code[end] !== "'" && code[end] !== '"') {
      end += 1;
    }
    const word = code.slice(index, end);
    if (!word) {
      push('text', char);
      index += 1;
      continue;
    }

    if (atCommand) {
      push('command', word);
      atCommand = false;
    } else if (word.startsWith('-')) {
      push('flag', word);
    } else if (word.startsWith('/') || word.startsWith('./') || word.startsWith('../') || word.startsWith('~')) {
      push('path', word);
    } else {
      push('text', word);
    }
    index = end;
  }

  return tokens;
}
