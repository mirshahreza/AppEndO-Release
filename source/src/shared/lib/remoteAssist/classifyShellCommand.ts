export type RemoteCommandEffect = 'read' | 'write';

const READ_COMMANDS = new Set([
  '[',
  'arch',
  'awk',
  'basename',
  'cal',
  'cat',
  'cd',
  'cmp',
  'column',
  'comm',
  'cut',
  'date',
  'df',
  'diff',
  'dir',
  'dirname',
  'dirs',
  'dmesg',
  'du',
  'echo',
  'egrep',
  'env',
  'false',
  'fgrep',
  'file',
  'find',
  'free',
  'getent',
  'grep',
  'groups',
  'head',
  'history',
  'host',
  'hostname',
  'hostnamectl',
  'id',
  'ifconfig',
  'ip',
  'jobs',
  'last',
  'll',
  'locate',
  'ls',
  'lsblk',
  'lscpu',
  'lsmem',
  'lspci',
  'lsusb',
  'lsof',
  'md5sum',
  'nl',
  'nproc',
  'nslookup',
  'popd',
  'printenv',
  'printf',
  'ps',
  'pushd',
  'pwd',
  'readlink',
  'realpath',
  'rg',
  'sha1sum',
  'sha256sum',
  'sha512sum',
  'sort',
  'ss',
  'stat',
  'tail',
  'test',
  'timedatectl',
  'tree',
  'true',
  'tput',
  'tty',
  'type',
  'uname',
  'uniq',
  'uptime',
  'w',
  'wc',
  'whereis',
  'which',
  'who',
  'whoami',
]);

const GIT_READ_SUBCOMMANDS = new Set([
  'blame',
  'branch',
  'cat-file',
  'describe',
  'diff',
  'log',
  'ls-files',
  'remote',
  'rev-parse',
  'show',
  'status',
]);

const SYSTEMCTL_READ_SUBCOMMANDS = new Set([
  'cat',
  'help',
  'is-active',
  'is-enabled',
  'is-failed',
  'list-unit-files',
  'list-units',
  'show',
  'status',
]);

const DOCKER_READ_SUBCOMMANDS = new Set([
  'images',
  'inspect',
  'logs',
  'ps',
  'stats',
  'top',
  'version',
]);

const JOURNALCTL_READ = true;

const splitShellStatements = (command: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;
  let escaped = false;

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) {
      parts.push(trimmed);
    }
    current = '';
  };

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (quote) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (quote === '"' && char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === ';') {
      flush();
      continue;
    }
    if (char === '&' && command[index + 1] === '&') {
      flush();
      index += 1;
      continue;
    }
    if (char === '|' && command[index + 1] === '|') {
      flush();
      index += 1;
      continue;
    }
    if (char === '|') {
      flush();
      continue;
    }
    current += char;
  }
  flush();
  return parts;
};

const stripLeadingAssignments = (segment: string): string => {
  let rest = segment.trim();
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(rest)) {
    const match = rest.match(/^[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|"[^"]*"|\S+)\s*/);
    if (!match) {
      break;
    }
    rest = rest.slice(match[0].length);
  }
  return rest.trim();
};

const tokenizeUnquoted = (segment: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;
  let escaped = false;

  const flush = () => {
    if (current) {
      tokens.push(current);
      current = '';
    }
  };

  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index];
    if (quote) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (quote === '"' && char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (/\s/.test(char)) {
      flush();
      continue;
    }
    current += char;
  }
  flush();
  return tokens;
};

const unwrapToken = (token: string): string => {
  if (
    (token.startsWith("'") && token.endsWith("'") && token.length >= 2)
    || (token.startsWith('"') && token.endsWith('"') && token.length >= 2)
  ) {
    return token.slice(1, -1);
  }
  return token;
};

const hasWriteRedirect = (segment: string): boolean => {
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (quote === '"' && char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === '>') {
      return true;
    }
  }
  return false;
};

const classifySegment = (rawSegment: string): RemoteCommandEffect => {
  const segment = stripLeadingAssignments(rawSegment);
  if (!segment) {
    return 'write';
  }
  if (hasWriteRedirect(segment)) {
    return 'write';
  }

  const tokens = tokenizeUnquoted(segment);
  if (tokens.length === 0) {
    return 'write';
  }

  let offset = 0;
  let command = unwrapToken(tokens[0] ?? '').toLowerCase();
  if (command === 'sudo' || command === 'command' || command === 'time' || command === 'nice') {
    offset = 1;
    command = unwrapToken(tokens[1] ?? '').toLowerCase();
  }
  if (!command) {
    return 'write';
  }

  const rest = tokens.slice(offset + 1).map((token) => unwrapToken(token));
  const flags = rest.filter((token) => token.startsWith('-'));
  const subcommand = rest.find((token) => token && !token.startsWith('-'))?.toLowerCase() ?? '';

  if (command === 'sed' && flags.some((flag) => flag === '-i' || flag.startsWith('-i'))) {
    return 'write';
  }
  if (command === 'crontab' && !flags.includes('-l')) {
    return 'write';
  }
  if (command === 'git') {
    return GIT_READ_SUBCOMMANDS.has(subcommand) ? 'read' : 'write';
  }
  if (command === 'systemctl') {
    return SYSTEMCTL_READ_SUBCOMMANDS.has(subcommand) ? 'read' : 'write';
  }
  if (command === 'docker') {
    return DOCKER_READ_SUBCOMMANDS.has(subcommand) ? 'read' : 'write';
  }
  if (command === 'journalctl') {
    return JOURNALCTL_READ ? 'read' : 'write';
  }
  if (READ_COMMANDS.has(command)) {
    return 'read';
  }
  return 'write';
};

export function classifyShellCommand(command: string): RemoteCommandEffect {
  const trimmed = command.replace(/\0/g, '').trim();
  if (!trimmed) {
    return 'write';
  }
  const statements = splitShellStatements(trimmed);
  if (statements.length === 0) {
    return 'write';
  }
  return statements.some((segment) => classifySegment(segment) === 'write') ? 'write' : 'read';
}
