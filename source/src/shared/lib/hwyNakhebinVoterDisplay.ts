const readRowStringField = (row: Record<string, unknown>, field: string): string => {
  const snake = field.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
  const raw = row[field] ?? row[snake];
  if (raw === null || raw === undefined) {
    return '';
  }
  return String(raw).trim();
};

const joinNameParts = (...parts: string[]): string =>
  parts.map((part) => part.trim()).filter(Boolean).join(' ');

const readBirthYear = (row: Record<string, unknown>): string =>
  readRowStringField(row, 'birthYear');

/** List grids: family name and birth year on one line, separated by ` | `. */
export const formatHwyPersonListNameSecondLine = (
  familyName: string,
  birthYear: unknown,
): string => {
  const family = familyName.trim();
  const year = birthYear === null || birthYear === undefined
    ? ''
    : String(birthYear).trim();
  if (family && year) {
    return `${family} | ${year}`;
  }
  return family || year;
};

/** Nakhebin grid: line 1 = first + father + grandfather; line 2 = family name (surname). */
export const applyHwyNakhebinVoterNameDisplayLines = (row: Record<string, unknown>): void => {
  const line1 = joinNameParts(
    readRowStringField(row, 'firstName'),
    readRowStringField(row, 'fatherName'),
    readRowStringField(row, 'grandfatherName'),
  );
  const line2 = readRowStringField(row, 'familyName');
  if (line1) {
    row.voterNameLine1 = line1;
  }
  if (line2) {
    row.voterNameLine2 = line2;
  }
};

export const readHwyNakhebinVoterNameLine1 = (row: Record<string, unknown>): string => {
  const direct = readRowStringField(row, 'voterNameLine1');
  if (direct) {
    return direct;
  }
  return joinNameParts(
    readRowStringField(row, 'firstName'),
    readRowStringField(row, 'fatherName'),
    readRowStringField(row, 'grandfatherName'),
  );
};

export const readHwyNakhebinVoterNameLine2 = (row: Record<string, unknown>): string => {
  const family = readRowStringField(row, 'familyName')
    || readRowStringField(row, 'voterNameLine2');
  return formatHwyPersonListNameSecondLine(family, readBirthYear(row));
};
