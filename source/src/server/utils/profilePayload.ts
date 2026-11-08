const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const PROFILE_IMAGE_XS_MAX_BYTES = 256 * 1024;
export const BASE_INFO_ROOT_GENDER = '100.1';
export const BASE_INFO_ROOT_PERSON_TYPE = '100.2';

export const toOptionalTrimmed = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
};

export const normalizeNationalCode = (value: unknown): string | null => toOptionalTrimmed(value);

export const normalizeBirthYear = (value: unknown): string | null => {
  const text = toOptionalTrimmed(value);
  if (!text) return null;
  if (!/^\d{1,4}$/.test(text)) {
    throw new Error('birthYear must be 1 to 4 digits.');
  }
  return text;
};

export const normalizeBirthMonth = (value: unknown): string | null => {
  const text = toOptionalTrimmed(value);
  if (!text) return null;
  if (!/^\d{1,2}$/.test(text)) {
    throw new Error('birthMonth must be numeric.');
  }
  const normalized = text.padStart(2, '0');
  const num = Number(normalized);
  if (num < 1 || num > 12) {
    throw new Error('birthMonth must be between 01 and 12.');
  }
  return normalized;
};

export const normalizeBirthDay = (value: unknown): string | null => {
  const text = toOptionalTrimmed(value);
  if (!text) return null;
  if (!/^\d{1,2}$/.test(text)) {
    throw new Error('birthDay must be numeric.');
  }
  const normalized = text.padStart(2, '0');
  const num = Number(normalized);
  if (num < 1 || num > 31) {
    throw new Error('birthDay must be between 01 and 31.');
  }
  return normalized;
};

const parseBase64Image = (value: unknown, maxBytes: number, fieldName: string): Buffer | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const raw = text.includes(',') ? text.split(',').pop() || '' : text;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(raw, 'base64');
  } catch {
    throw new Error(`${fieldName} must be valid base64.`);
  }
  if (!buffer.length) {
    throw new Error(`${fieldName} cannot be empty.`);
  }
  if (buffer.length > maxBytes) {
    throw new Error(`${fieldName} exceeds max size.`);
  }
  return buffer;
};

export const encodeBufferBase64 = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (Buffer.isBuffer(value)) {
    return value.length ? value.toString('base64') : null;
  }
  if (value instanceof Uint8Array) {
    return value.length ? Buffer.from(value).toString('base64') : null;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (text.startsWith('\\x')) {
      return Buffer.from(text.slice(2), 'hex').toString('base64');
    }
  }
  return null;
};

export const normalizeProfilePayload = (payload: Record<string, unknown>) => {
  const hasProfileImageBodyInput = Object.prototype.hasOwnProperty.call(payload, 'profileImageBody');
  const hasProfileImageBodyXsInput = Object.prototype.hasOwnProperty.call(payload, 'profileImageBodyXs');
  const profileImageBody = parseBase64Image(payload.profileImageBody, PROFILE_IMAGE_MAX_BYTES, 'profileImageBody');
  const profileImageBodyXs = parseBase64Image(payload.profileImageBodyXs, PROFILE_IMAGE_XS_MAX_BYTES, 'profileImageBodyXs');

  const normalized = {
    firstname: toOptionalTrimmed(payload.firstname ?? payload.firstName),
    lastname: toOptionalTrimmed(payload.lastname ?? payload.lastName),
    fathername: toOptionalTrimmed(payload.fathername ?? payload.fatherName),
    grandfathername: toOptionalTrimmed(payload.grandfathername ?? payload.grandfatherName),
    phone: toOptionalTrimmed(payload.phone),
    nickname: toOptionalTrimmed(payload.nickname),
    nationalCode: toOptionalTrimmed(payload.nationalCode ?? payload.national_code),
    birthYear: normalizeBirthYear(payload.birthYear),
    birthMonth: normalizeBirthMonth(payload.birthMonth),
    birthDay: normalizeBirthDay(payload.birthDay),
    genderCode: toOptionalTrimmed(payload.genderCode),
    personTypeCode: toOptionalTrimmed(payload.personTypeCode),
    companyName: toOptionalTrimmed(payload.companyName ?? payload.company_name),
    registrationNumber: toOptionalTrimmed(payload.registrationNumber ?? payload.registration_number),
    website: toOptionalTrimmed(payload.website),
    profileImageMime: toOptionalTrimmed(payload.profileImageMime),
    profileImageBody,
    profileImageBodyXs,
  };

  const effectiveFullImage = normalized.profileImageBody === undefined ? undefined : normalized.profileImageBody;
  const effectiveThumb = normalized.profileImageBodyXs === undefined
    ? (effectiveFullImage === undefined ? undefined : effectiveFullImage)
    : normalized.profileImageBodyXs;

  const fullImageSize = effectiveFullImage === undefined
    ? undefined
    : (effectiveFullImage === null ? null : effectiveFullImage.length);

  return {
    ...normalized,
    hasProfileImageBodyInput,
    hasProfileImageBodyXsInput,
    profileImageBody: effectiveFullImage,
    profileImageBodyXs: effectiveThumb,
    profileImageSize: fullImageSize,
  };
};

export const hasProfilePayloadValue = (profile: ReturnType<typeof normalizeProfilePayload>) => Boolean(
  profile.firstname
  || profile.lastname
  || profile.fathername
  || profile.grandfathername
  || profile.phone
  || profile.nickname
  || profile.nationalCode
  || profile.birthYear
  || profile.birthMonth
  || profile.birthDay
  || profile.genderCode
  || profile.personTypeCode
  || profile.companyName
  || profile.registrationNumber
  || profile.website
  || profile.profileImageBody
  || profile.profileImageBodyXs
  || profile.profileImageMime
  || profile.profileImageSize,
);
