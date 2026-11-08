import bcrypt from 'bcryptjs';
import type { Pool } from 'pg';
import { seedRoleMcpGrants } from '../../server/services/ai/mcpAccessSeed';
import { loadSeedPicture } from './seedUserPictures';

/** First auto-generated user id (admin seed, install admin, and all new users). */
export const USER_ID_SEQUENCE_START = 1_000_000;

/**
 * `base_user_roles` has no surrogate id — composite PK (`user_id`, `role_name`).
 * `user_id` values follow {@link USER_ID_SEQUENCE_START} via `base_users.id`.
 */

/** Number of users inserted on first-time database seed (includes built-in admin). */
export const SEED_USER_COUNT = 100;

type SeedUser = {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  isBuiltin: boolean;
  role: string | null;
  firstname: string;
  lastname: string;
  fathername: string | null;
  grandfathername: string | null;
  genderCode: string | null;
  nickname: string | null;
  nationalCode: string | null;
  birthYear: string | null;
  birthMonth: string | null;
  birthDay: string | null;
  personTypeCode: string | null;
  phone: string | null;
  mobile: string | null;
  emailVerifiedAt: string | null;
  mobileVerifiedAt: string | null;
  lastLoginAt: string | null;
  profileImagePath: string;
};

const SEED_EMAIL_DOMAIN = 'append.os';

const SEED_FIRST_NAMES_MALE = [
  'Reza', 'Amir', 'Ali', 'Hamid', 'Hossein', 'Mahmoud', 'Javad', 'Saeed', 'Mohsen', 'Mostafa',
  'Behzad', 'Kian', 'Arash', 'Babak', 'Farhad', 'Mehdi', 'Nima', 'Omid', 'Pouya', 'Sina',
];
const SEED_FIRST_NAMES_FEMALE = [
  'Sara', 'Maryam', 'Neda', 'Zahra', 'Leila', 'Fatemeh', 'Parisa', 'Shirin', 'Golnaz', 'Mahsa',
  'Aida', 'Elham', 'Hanieh', 'Kimia', 'Mina', 'Nasim', 'Roya', 'Sanaz', 'Taraneh', 'Yasaman',
];
const SEED_LAST_NAMES = [
  'Ahmadi', 'Karimi', 'Hosseini', 'Moradi', 'Rahimi', 'Nouri', 'Salehi', 'Farhadi', 'Azimi', 'Jafari',
  'Bagheri', 'Khani', 'Tehrani', 'Shirazi', 'Tabrizi', 'Ebrahimi', 'Ghasemi', 'Mousavi', 'Sadeghi', 'Yousefi',
];
const SEED_FATHER_NAMES = [
  'Mohammad', 'Hassan', 'Ali', 'Javad', 'Saeed', 'Mahmoud', 'Yousef', 'Parviz', 'Mostafa', 'Reza',
  'Akbar', 'Esmail', 'Gholam', 'Habib', 'Kamal', 'Mansour', 'Nader', 'Rasoul', 'Sohrab', 'Vahid',
];
const SEED_GRANDFATHER_NAMES = [
  'Ali', 'Ahmad', 'Reza', 'Karim', 'Mohsen', 'Hossein', 'Abbas', 'Nader', 'Sadegh', 'Ebrahim',
  'Fereydoun', 'Gholam', 'Hasan', 'Ismail', 'Jamshid', 'Lotfali', 'Morteza', 'Nasser', 'Qasem', 'Rostam',
];
const SEED_NICKNAME_SUFFIXES = ['', '2', '_official', '_ir', 'pro', 'dev', 'star'];
const SEED_PERSON_TYPE_INDIVIDUAL = '100.2.1';
const SEED_PERSON_TYPE_COMPANY = '100.2.2';
const SEED_GENDER_MALE = '100.1.1';
const SEED_GENDER_FEMALE = '100.1.2';
const SEED_COMPANIES = [
  { firstname: 'Pars', lastname: 'Technology' },
  { firstname: 'Aria', lastname: 'Trading' },
  { firstname: 'Sepahan', lastname: 'Industries' },
  { firstname: 'Kish', lastname: 'Logistics' },
  { firstname: 'Omid', lastname: 'Finance' },
  { firstname: 'Novan', lastname: 'Software' },
  { firstname: 'Rastak', lastname: 'Consulting' },
  { firstname: 'Tavan', lastname: 'Energy' },
  { firstname: 'Zarrin', lastname: 'Commerce' },
  { firstname: 'Mehr', lastname: 'Insurance' },
  { firstname: 'Saba', lastname: 'Holding' },
  { firstname: 'Padidar', lastname: 'Systems' },
  { firstname: 'Hamrah', lastname: 'Digital' },
  { firstname: 'Kavosh', lastname: 'Research' },
  { firstname: 'Atlas', lastname: 'Transport' },
  { firstname: 'Bahar', lastname: 'Agro' },
  { firstname: 'Darya', lastname: 'Shipping' },
  { firstname: 'Fidar', lastname: 'Networks' },
  { firstname: 'Gostar', lastname: 'Development' },
  { firstname: 'Homa', lastname: 'Aviation' },
  { firstname: 'Iran', lastname: 'Pharma' },
  { firstname: 'Jahan', lastname: 'Mining' },
  { firstname: 'Kimia', lastname: 'Petrochemical' },
  { firstname: 'Lian', lastname: 'Construction' },
  { firstname: 'Mahan', lastname: 'Retail' },
];

function slugifyLatin(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function buildUniqueCredentials(
  firstname: string,
  lastname: string,
  usedUsernames: Set<string>,
): { username: string; email: string } {
  const base = `${slugifyLatin(firstname)}.${slugifyLatin(lastname)}`;
  let username = base;
  let counter = 2;
  while (usedUsernames.has(username)) {
    username = `${base}${counter}`;
    counter += 1;
  }
  usedUsernames.add(username);
  return { username, email: `${username}@${SEED_EMAIL_DOMAIN}` };
}

function buildSeedNationalCode(seedIndex: number): string {
  return String(1_000_000_000 + seedIndex).padStart(10, '0');
}

function buildSeedMobile(seedIndex: number): string {
  return `09${String(100_000_000 + seedIndex).padStart(9, '0')}`;
}

function buildSeedPhone(seedIndex: number): string {
  return `021${String(1_000_000 + seedIndex).padStart(7, '0')}`;
}

function buildSeedBirthDate(seedIndex: number): { year: string; month: string; day: string } {
  const year = String(1365 + (seedIndex % 28));
  const month = String((seedIndex % 12) + 1).padStart(2, '0');
  const day = String((seedIndex % 28) + 1).padStart(2, '0');
  return { year, month, day };
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function buildSeedNickname(firstname: string, seedIndex: number, isCompany: boolean): string {
  const base = slugifyLatin(firstname).replace(/\./g, '');
  if (isCompany) return `${base}_co`;
  const suffix = SEED_NICKNAME_SUFFIXES[seedIndex % SEED_NICKNAME_SUFFIXES.length];
  return suffix ? `${base}${suffix}` : base;
}

function buildSeedCompanyNationalCode(seedIndex: number): string {
  return `8${String(100_000_000 + seedIndex).padStart(9, '0')}`;
}

function buildSeedPortraitPath(isFemale: boolean, seedIndex: number): string {
  const poolSize = isFemale ? 49 : 50;
  const fileNum = String((seedIndex % poolSize) + 1).padStart(2, '0');
  return isFemale
    ? `portraits/female-${fileNum}.jpg`
    : `portraits/male-${fileNum}.jpg`;
}

function buildSeedCompanyPicturePath(companyIndex: number): string {
  const fileNum = String((companyIndex % SEED_COMPANIES.length) + 1).padStart(2, '0');
  return `companies/company-${fileNum}.png`;
}

function isSeedCompanyUser(seedIndex: number): boolean {
  return seedIndex % 4 === 0;
}

/** Built-in platform roles that sample users may receive (not every demo row). */
export const SEED_ELEVATED_PLATFORM_ROLES = ['ADMIN', 'DEVELOPER'] as const;

/** Demo users at these seed indices get a platform role; all others stay role-less for grid/testing. */
export function resolveSeedUserElevatedRole(seedIndex: number): string | null {
  if (seedIndex === 1 || seedIndex === 2) return 'DEVELOPER';
  if (seedIndex === 3) return 'ADMIN';
  return null;
}

export function seedElevatedRolesToRemove(expectedRole: string | null): string[] {
  const expected = expectedRole ? [expectedRole] : [];
  return SEED_ELEVATED_PLATFORM_ROLES.filter((role) => !expected.includes(role));
}

export function buildSeedUsers(adminHash: string, userHash: string): SeedUser[] {
  const usedUsernames = new Set<string>(['admin']);

  const users: SeedUser[] = [
    {
      id: USER_ID_SEQUENCE_START,
      username: 'admin',
      email: 'admin@append.os',
      passwordHash: adminHash,
      isBuiltin: true,
      role: 'ADMIN',
      firstname: 'System',
      lastname: 'Administrator',
      fathername: null,
      grandfathername: null,
      genderCode: SEED_GENDER_MALE,
      nickname: null,
      nationalCode: null,
      birthYear: null,
      birthMonth: null,
      birthDay: null,
      personTypeCode: SEED_PERSON_TYPE_INDIVIDUAL,
      phone: null,
      mobile: null,
      emailVerifiedAt: daysAgoIso(365),
      mobileVerifiedAt: null,
      lastLoginAt: daysAgoIso(1),
      profileImagePath: 'admin.png',
    },
  ];

  for (let i = 1; i < SEED_USER_COUNT; i++) {
    const nameIndex = i - 1;
    const isCompany = isSeedCompanyUser(i);
    const isFemale = !isCompany && i % 2 === 0;
    const company = isCompany ? SEED_COMPANIES[Math.floor(i / 4) - 1] ?? SEED_COMPANIES[nameIndex % SEED_COMPANIES.length] : null;
    const firstname = company
      ? company.firstname
      : (isFemale
        ? SEED_FIRST_NAMES_FEMALE[nameIndex % SEED_FIRST_NAMES_FEMALE.length]
        : SEED_FIRST_NAMES_MALE[nameIndex % SEED_FIRST_NAMES_MALE.length]);
    const lastname = company
      ? company.lastname
      : SEED_LAST_NAMES[(nameIndex + Math.floor(i / SEED_LAST_NAMES.length)) % SEED_LAST_NAMES.length];
    const { username, email } = buildUniqueCredentials(firstname, lastname, usedUsernames);
    const birth = buildSeedBirthDate(i);

    users.push({
      id: USER_ID_SEQUENCE_START + i,
      username,
      email,
      passwordHash: userHash,
      isBuiltin: false,
      role: resolveSeedUserElevatedRole(i),
      firstname,
      lastname,
      fathername: isCompany ? null : SEED_FATHER_NAMES[nameIndex % SEED_FATHER_NAMES.length],
      grandfathername: isCompany ? null : SEED_GRANDFATHER_NAMES[nameIndex % SEED_GRANDFATHER_NAMES.length],
      genderCode: isCompany ? null : (isFemale ? SEED_GENDER_FEMALE : SEED_GENDER_MALE),
      nickname: buildSeedNickname(firstname, i, isCompany),
      nationalCode: isCompany ? buildSeedCompanyNationalCode(i) : buildSeedNationalCode(i),
      birthYear: birth.year,
      birthMonth: birth.month,
      birthDay: birth.day,
      personTypeCode: isCompany ? SEED_PERSON_TYPE_COMPANY : SEED_PERSON_TYPE_INDIVIDUAL,
      phone: buildSeedPhone(i),
      mobile: buildSeedMobile(i),
      emailVerifiedAt: i % 7 === 0 ? null : daysAgoIso(10 + (i % 120)),
      mobileVerifiedAt: i % 5 === 0 ? null : daysAgoIso(5 + (i % 90)),
      lastLoginAt: i % 9 === 0 ? null : daysAgoIso(i % 45),
      profileImagePath: isCompany
        ? buildSeedCompanyPicturePath(Math.floor(i / 4) - 1)
        : buildSeedPortraitPath(isFemale, i),
    });
  }

  return users;
}

async function seedBaseInfoLookups(pool: Pool, actorId: number | null): Promise<void> {
  await pool.query(`
    INSERT INTO base_info (
      id, parent_id, title, title_en, title_fa, title_ar, short_name, view_order, value, is_active, ui_color, ui_html, created_by, updated_by
    ) VALUES
      ('100', NULL, 'Base', 'Base', 'پایه', 'أساسي', NULL, 100, 1, TRUE, NULL, NULL, $1, $1),
      ('100.1', '100', 'Gender', 'Gender', 'جنسیت', 'الجنس', NULL, 1, 1, TRUE, NULL, NULL, $1, $1),
      ('100.1.1', '100.1', 'Male', 'Male', 'مرد', 'ذكر', NULL, 1, 1, TRUE, NULL, '<i data-lucide="Mars"></i>', $1, $1),
      ('100.1.2', '100.1', 'Female', 'Female', 'زن', 'أنثى', NULL, 2, 2, TRUE, NULL, '<i data-lucide="Venus"></i>', $1, $1),
      ('100.2', '100', 'Person Type', 'Person Type', 'نوع شخص', 'نوع الشخص', NULL, 2, 2, TRUE, NULL, NULL, $1, $1),
      ('100.2.1', '100.2', 'Individual', 'Individual', 'حقیقی', 'فرد', NULL, 1, 1, TRUE, NULL, '<i data-lucide="User"></i>', $1, $1),
      ('100.2.2', '100.2', 'Company', 'Company', 'حقوقی', 'شركة', NULL, 2, 2, TRUE, NULL, '<i data-lucide="Building2"></i>', $1, $1),
      ('100.3', '100', 'Feedback Subject', 'Feedback Subject', 'موضوع بازخورد', 'موضوع الملاحظات', NULL, 3, 3, TRUE, NULL, NULL, $1, $1),
      ('100.3.1', '100.3', 'Bug report', 'Bug report', 'گزارش اشکال', 'بلاغ عن خطأ', 'BUG', 1, 1, TRUE, NULL, NULL, $1, $1),
      ('100.3.2', '100.3', 'Suggestion', 'Suggestion', 'پیشنهاد', 'اقتراح', 'SUGGESTION', 2, 2, TRUE, NULL, NULL, $1, $1),
      ('100.3.3', '100.3', 'Question', 'Question', 'پرسش', 'سؤال', 'QUESTION', 3, 3, TRUE, NULL, NULL, $1, $1),
      ('100.3.4', '100.3', 'Praise', 'Praise', 'تقدیر', 'إشادة', 'PRAISE', 4, 4, TRUE, NULL, NULL, $1, $1),
      ('100.6', '100', 'Record change reasons', 'Record change reasons', 'Record change reasons', 'Record change reasons', NULL, 6, 6, TRUE, NULL, NULL, $1, $1),
      ('100.6.0', '100.6', 'General', 'General', 'General', 'General', NULL, 0, 0, TRUE, NULL, NULL, $1, $1),
      ('100.6.20', '100.6', 'Users lock', 'Users lock', 'Users lock', 'Users lock', NULL, 20, 20, TRUE, NULL, NULL, $1, $1),
      ('100.6.21', '100.6', 'Users roles', 'Users roles', 'Users roles', 'Users roles', NULL, 21, 21, TRUE, NULL, NULL, $1, $1),
      ('100.6.22', '100.6', 'Users lifecycle', 'Users lifecycle', 'Users lifecycle', 'Users lifecycle', NULL, 22, 22, TRUE, NULL, NULL, $1, $1),
      ('100.6.1', '100.6.0', 'Correction', 'Correction', 'Correction', 'Correction', NULL, 1, 1, TRUE, NULL, NULL, $1, $1),
      ('100.6.2', '100.6.0', 'User requested', 'User requested', 'User requested', 'User requested', NULL, 2, 2, TRUE, NULL, NULL, $1, $1),
      ('100.6.3', '100.6.0', 'Security', 'Security', 'Security', 'Security', NULL, 3, 3, TRUE, NULL, NULL, $1, $1),
      ('100.6.4', '100.6.21', 'Role assignment', 'Role assignment', 'Role assignment', 'Role assignment', NULL, 4, 4, TRUE, NULL, NULL, $1, $1),
      ('100.6.5', '100.6.21', 'Scope assignment', 'Scope assignment', 'Scope assignment', 'Scope assignment', NULL, 5, 5, TRUE, NULL, NULL, $1, $1),
      ('100.6.6', '100.6.20', 'Lock', 'Lock', 'Lock', 'Lock', NULL, 6, 6, TRUE, NULL, NULL, $1, $1),
      ('100.6.7', '100.6.20', 'Unlock', 'Unlock', 'Unlock', 'Unlock', NULL, 7, 7, TRUE, NULL, NULL, $1, $1),
      ('100.6.8', '100.6.0', 'Reverted', 'Reverted', 'Reverted', 'Reverted', NULL, 8, 8, TRUE, NULL, NULL, $1, $1),
      ('100.6.9', '100.6.22', 'Onboarding', 'Onboarding', 'Onboarding', 'Onboarding', NULL, 9, 9, TRUE, NULL, NULL, $1, $1),
      ('100.6.10', '100.6.22', 'Offboarding', 'Offboarding', 'Offboarding', 'Offboarding', NULL, 10, 10, TRUE, NULL, NULL, $1, $1),
      ('100.6.11', '100.6.0', 'Compliance', 'Compliance', 'Compliance', 'Compliance', NULL, 11, 11, TRUE, NULL, NULL, $1, $1),
      ('100.6.12', '100.6.0', 'Data entry error', 'Data entry error', 'Data entry error', 'Data entry error', NULL, 3, 12, TRUE, NULL, NULL, $1, $1),
      ('100.6.13', '100.6.0', 'Duplicate or merge', 'Duplicate or merge', 'Duplicate or merge', 'Duplicate or merge', NULL, 5, 13, TRUE, NULL, NULL, $1, $1),
      ('100.6.14', '100.6.0', 'Legal or court order', 'Legal or court order', 'Legal or court order', 'Legal or court order', NULL, 9, 14, TRUE, NULL, NULL, $1, $1),
      ('100.6.15', '100.6.0', 'Policy update', 'Policy update', 'Policy update', 'Policy update', NULL, 6, 15, TRUE, NULL, NULL, $1, $1),
      ('100.6.16', '100.6.0', 'Name or identity change', 'Name or identity change', 'Name or identity change', 'Name or identity change', NULL, 4, 16, TRUE, NULL, NULL, $1, $1),
      ('100.6.17', '100.6.0', 'Other', 'Other', 'Other', 'Other', NULL, 11, 17, TRUE, NULL, NULL, $1, $1),
      ('100.6.23', '100.6.20', 'Inactivity', 'Inactivity', 'Inactivity', 'Inactivity', NULL, 3, 23, TRUE, NULL, NULL, $1, $1),
      ('100.6.24', '100.6.20', 'Policy violation', 'Policy violation', 'Policy violation', 'Policy violation', NULL, 4, 24, TRUE, NULL, NULL, $1, $1),
      ('100.6.25', '100.6.20', 'Security incident', 'Security incident', 'Security incident', 'Security incident', NULL, 5, 25, TRUE, NULL, NULL, $1, $1),
      ('100.6.26', '100.6.20', 'Account recovery', 'Account recovery', 'Account recovery', 'Account recovery', NULL, 6, 26, TRUE, NULL, NULL, $1, $1),
      ('100.6.27', '100.6.21', 'Access review', 'Access review', 'Access review', 'Access review', NULL, 3, 27, TRUE, NULL, NULL, $1, $1),
      ('100.6.28', '100.6.21', 'Temporary access', 'Temporary access', 'Temporary access', 'Temporary access', NULL, 4, 28, TRUE, NULL, NULL, $1, $1),
      ('100.6.29', '100.6.21', 'Job change', 'Job change', 'Job change', 'Job change', NULL, 5, 29, TRUE, NULL, NULL, $1, $1),
      ('100.6.30', '100.6.21', 'Least privilege', 'Least privilege', 'Least privilege', 'Least privilege', NULL, 6, 30, TRUE, NULL, NULL, $1, $1),
      ('100.6.31', '100.6.22', 'Hire', 'Hire', 'Hire', 'Hire', NULL, 3, 31, TRUE, NULL, NULL, $1, $1),
      ('100.6.32', '100.6.22', 'Transfer', 'Transfer', 'Transfer', 'Transfer', NULL, 4, 32, TRUE, NULL, NULL, $1, $1),
      ('100.6.33', '100.6.22', 'Contractor ended', 'Contractor ended', 'Contractor ended', 'Contractor ended', NULL, 5, 33, TRUE, NULL, NULL, $1, $1),
      ('100.6.34', '100.6.22', 'Identity verified', 'Identity verified', 'Identity verified', 'Identity verified', NULL, 6, 34, TRUE, NULL, NULL, $1, $1),
      ('100.6.35', '100.6', 'Sample mock', 'Sample mock', 'Sample mock', 'Sample mock', NULL, 35, 35, TRUE, NULL, NULL, $1, $1),
      ('100.6.36', '100.6.35', 'Status change', 'Status change', 'Status change', 'Status change', NULL, 1, 36, TRUE, NULL, NULL, $1, $1),
      ('100.6.37', '100.6.35', 'Approval', 'Approval', 'Approval', 'Approval', NULL, 2, 37, TRUE, NULL, NULL, $1, $1),
      ('100.6.38', '100.6.35', 'Record update', 'Record update', 'Record update', 'Record update', NULL, 3, 38, TRUE, NULL, NULL, $1, $1)
    ON CONFLICT (id) DO NOTHING;
  `, [actorId]);

  // Keep titles current on re-seed (INSERT uses DO NOTHING for existing ids).
  await pool.query(`
    UPDATE base_info AS bi SET
      title = v.title,
      title_en = v.title_en,
      title_fa = v.title_fa,
      title_ar = v.title_ar,
      updated_at = NOW()
    FROM (VALUES
      ('100', 'Base', 'Base', 'پایه', 'أساسي'),
      ('100.1', 'Gender', 'Gender', 'جنسیت', 'الجنس'),
      ('100.1.1', 'Male', 'Male', 'مرد', 'ذكر'),
      ('100.1.2', 'Female', 'Female', 'زن', 'أنثى'),
      ('100.2', 'Person Type', 'Person Type', 'نوع شخص', 'نوع الشخص'),
      ('100.2.1', 'Individual', 'Individual', 'حقیقی', 'فرد'),
      ('100.2.2', 'Company', 'Company', 'حقوقی', 'شركة'),
      ('100.3', 'Feedback Subject', 'Feedback Subject', 'موضوع بازخورد', 'موضوع الملاحظات'),
      ('100.3.1', 'Bug report', 'Bug report', 'گزارش اشکال', 'بلاغ عن خطأ'),
      ('100.3.2', 'Suggestion', 'Suggestion', 'پیشنهاد', 'اقتراح'),
      ('100.3.3', 'Question', 'Question', 'پرسش', 'سؤال'),
      ('100.3.4', 'Praise', 'Praise', 'تقدیر', 'إشادة'),
      ('100.6', 'Record change reasons', 'Record change reasons', 'Record change reasons', 'Record change reasons'),
      ('100.6.1', 'Correction', 'Correction', 'Correction', 'Correction'),
      ('100.6.2', 'User requested', 'User requested', 'User requested', 'User requested'),
      ('100.6.3', 'Security', 'Security', 'Security', 'Security'),
      ('100.6.4', 'Role assignment', 'Role assignment', 'Role assignment', 'Role assignment'),
      ('100.6.5', 'Scope assignment', 'Scope assignment', 'Scope assignment', 'Scope assignment'),
      ('100.6.6', 'Lock', 'Lock', 'Lock', 'Lock'),
      ('100.6.7', 'Unlock', 'Unlock', 'Unlock', 'Unlock'),
      ('100.6.8', 'Reverted', 'Reverted', 'Reverted', 'Reverted'),
      ('100.6.9', 'Onboarding', 'Onboarding', 'Onboarding', 'Onboarding'),
      ('100.6.10', 'Offboarding', 'Offboarding', 'Offboarding', 'Offboarding'),
      ('100.6.11', 'Compliance', 'Compliance', 'Compliance', 'Compliance')
    ) AS v(id, title, title_en, title_fa, title_ar)
    WHERE bi.id = v.id;
  `);

  await pool.query(`
    UPDATE base_info AS bi SET
      parent_id = v.parent_id,
      title = v.title,
      title_en = v.title_en,
      title_fa = v.title_fa,
      title_ar = v.title_ar,
      updated_at = NOW()
    FROM (VALUES
      ('100.6.0', '100.6', 'General', 'General', 'General', 'General'),
      ('100.6.20', '100.6', 'Users lock', 'Users lock', 'Users lock', 'Users lock'),
      ('100.6.21', '100.6', 'Users roles', 'Users roles', 'Users roles', 'Users roles'),
      ('100.6.22', '100.6', 'Users lifecycle', 'Users lifecycle', 'Users lifecycle', 'Users lifecycle'),
      ('100.6.1', '100.6.0', 'Correction', 'Correction', 'Correction', 'Correction'),
      ('100.6.2', '100.6.0', 'User requested', 'User requested', 'User requested', 'User requested'),
      ('100.6.3', '100.6.0', 'Security', 'Security', 'Security', 'Security'),
      ('100.6.4', '100.6.21', 'Role assignment', 'Role assignment', 'Role assignment', 'Role assignment'),
      ('100.6.5', '100.6.21', 'Scope assignment', 'Scope assignment', 'Scope assignment', 'Scope assignment'),
      ('100.6.6', '100.6.20', 'Lock', 'Lock', 'Lock', 'Lock'),
      ('100.6.7', '100.6.20', 'Unlock', 'Unlock', 'Unlock', 'Unlock'),
      ('100.6.8', '100.6.0', 'Reverted', 'Reverted', 'Reverted', 'Reverted'),
      ('100.6.9', '100.6.22', 'Onboarding', 'Onboarding', 'Onboarding', 'Onboarding'),
      ('100.6.10', '100.6.22', 'Offboarding', 'Offboarding', 'Offboarding', 'Offboarding'),
      ('100.6.11', '100.6.0', 'Compliance', 'Compliance', 'Compliance', 'Compliance'),
      ('100.6.12', '100.6.0', 'Data entry error', 'Data entry error', 'Data entry error', 'Data entry error'),
      ('100.6.13', '100.6.0', 'Duplicate or merge', 'Duplicate or merge', 'Duplicate or merge', 'Duplicate or merge'),
      ('100.6.14', '100.6.0', 'Legal or court order', 'Legal or court order', 'Legal or court order', 'Legal or court order'),
      ('100.6.15', '100.6.0', 'Policy update', 'Policy update', 'Policy update', 'Policy update'),
      ('100.6.16', '100.6.0', 'Name or identity change', 'Name or identity change', 'Name or identity change', 'Name or identity change'),
      ('100.6.17', '100.6.0', 'Other', 'Other', 'Other', 'Other'),
      ('100.6.23', '100.6.20', 'Inactivity', 'Inactivity', 'Inactivity', 'Inactivity'),
      ('100.6.24', '100.6.20', 'Policy violation', 'Policy violation', 'Policy violation', 'Policy violation'),
      ('100.6.25', '100.6.20', 'Security incident', 'Security incident', 'Security incident', 'Security incident'),
      ('100.6.26', '100.6.20', 'Account recovery', 'Account recovery', 'Account recovery', 'Account recovery'),
      ('100.6.27', '100.6.21', 'Access review', 'Access review', 'Access review', 'Access review'),
      ('100.6.28', '100.6.21', 'Temporary access', 'Temporary access', 'Temporary access', 'Temporary access'),
      ('100.6.29', '100.6.21', 'Job change', 'Job change', 'Job change', 'Job change'),
      ('100.6.30', '100.6.21', 'Least privilege', 'Least privilege', 'Least privilege', 'Least privilege'),
      ('100.6.31', '100.6.22', 'Hire', 'Hire', 'Hire', 'Hire'),
      ('100.6.32', '100.6.22', 'Transfer', 'Transfer', 'Transfer', 'Transfer'),
      ('100.6.33', '100.6.22', 'Contractor ended', 'Contractor ended', 'Contractor ended', 'Contractor ended'),
      ('100.6.34', '100.6.22', 'Identity verified', 'Identity verified', 'Identity verified', 'Identity verified'),
      ('100.6.35', '100.6', 'Sample mock', 'Sample mock', 'Sample mock', 'Sample mock'),
      ('100.6.36', '100.6.35', 'Status change', 'Status change', 'Status change', 'Status change'),
      ('100.6.37', '100.6.35', 'Approval', 'Approval', 'Approval', 'Approval'),
      ('100.6.38', '100.6.35', 'Record update', 'Record update', 'Record update', 'Record update')
    ) AS v(id, parent_id, title, title_en, title_fa, title_ar)
    WHERE bi.id = v.id;
  `);

  await pool.query(`
    UPDATE base_info AS bi SET
      metadata = v.metadata,
      updated_at = NOW()
    FROM (VALUES
      ('100.6.20', '{"changeReasonApi":"function:fn-users-set-locked"}'),
      ('100.6.21', '{"changeReasonApi":"function:fn-users-update-roles"}'),
      ('100.6.22', '{"changeReasonApi":"function:fn-users-update-profile"}'),
      ('100.6.35', '{"changeReasonApi":"function:platform-sample-mock"}')
    ) AS v(id, metadata)
    WHERE bi.id = v.id;
  `);

  await pool.query(`
    DELETE FROM base_info
    WHERE id LIKE '122.%';
  `);
  await pool.query(`
    DELETE FROM base_info
    WHERE id = '122'
       OR short_name = 'platform.tenant'
       OR ((parent_id IS NULL OR parent_id = '100') AND (title = 'Tenant' OR title_en = 'Tenant'));
  `);

  await pool.query(`
    DELETE FROM base_contact_messages
    WHERE topic_code = '103'
       OR topic_code LIKE '103.%'
       OR topic_code = '104'
       OR topic_code LIKE '104.%';
  `);

  await pool.query(`
    DELETE FROM base_users_attributes
    WHERE definition_id IN (
      SELECT id FROM base_settings_attributes
      WHERE key IN (
            'home_city', 'allowed_cities', 'employee_code', 'marketing_opt_in', 'interest_tags',
            'max_concurrent_sessions', 'feature_flags', 'default_person_type', 'legacy_quota'
          )
         OR base_info_root_id = '103'
         OR base_info_root_id LIKE '103.%'
         OR base_info_root_id = '104'
         OR base_info_root_id LIKE '104.%'
    );
  `);

  await pool.query(`
    DELETE FROM base_roles_attributes
    WHERE definition_id IN (
      SELECT id FROM base_settings_attributes
      WHERE key IN (
            'home_city', 'allowed_cities', 'employee_code', 'marketing_opt_in', 'interest_tags',
            'max_concurrent_sessions', 'feature_flags', 'default_person_type', 'legacy_quota'
          )
         OR base_info_root_id = '103'
         OR base_info_root_id LIKE '103.%'
         OR base_info_root_id = '104'
         OR base_info_root_id LIKE '104.%'
    );
  `);

  await pool.query(`
    DELETE FROM base_settings_attributes
    WHERE key IN (
          'home_city', 'allowed_cities', 'employee_code', 'marketing_opt_in', 'interest_tags',
          'max_concurrent_sessions', 'feature_flags', 'default_person_type', 'legacy_quota'
        )
       OR base_info_root_id = '103'
       OR base_info_root_id LIKE '103.%'
       OR base_info_root_id = '104'
       OR base_info_root_id LIKE '104.%';
  `);

  await pool.query(`
    DELETE FROM base_info
    WHERE id LIKE '103.%' OR id LIKE '104.%';
  `);
  await pool.query(`
    DELETE FROM base_info
    WHERE id IN ('103', '104');
  `);

  await pool.query(`
    UPDATE base_info SET ui_html = CASE id
      WHEN '100.1.1' THEN '<i data-lucide="Mars"></i>'
      WHEN '100.1.2' THEN '<i data-lucide="Venus"></i>'
      WHEN '100.2.1' THEN '<i data-lucide="User"></i>'
      WHEN '100.2.2' THEN '<i data-lucide="Building2"></i>'
      ELSE ui_html
    END
    WHERE id IN ('100.1.1', '100.1.2', '100.2.1', '100.2.2');
  `);
}

async function seedSettingsAttributes(pool: Pool, actorId: number | null): Promise<void> {
  await pool.query(`
    DELETE FROM base_users_attributes
    WHERE definition_id IN (
      SELECT id FROM base_settings_attributes
      WHERE key IN (
        'home_city', 'allowed_cities', 'employee_code', 'marketing_opt_in', 'interest_tags',
        'max_concurrent_sessions', 'feature_flags', 'default_person_type', 'legacy_quota'
      )
    );
  `);
  await pool.query(`
    DELETE FROM base_roles_attributes
    WHERE definition_id IN (
      SELECT id FROM base_settings_attributes
      WHERE key IN (
        'home_city', 'allowed_cities', 'employee_code', 'marketing_opt_in', 'interest_tags',
        'max_concurrent_sessions', 'feature_flags', 'default_person_type', 'legacy_quota'
      )
    );
  `);
  await pool.query(`
    DELETE FROM base_settings_attributes
    WHERE key IN (
      'home_city', 'allowed_cities', 'employee_code', 'marketing_opt_in', 'interest_tags',
      'max_concurrent_sessions', 'feature_flags', 'default_person_type', 'legacy_quota'
    );
  `);

  await pool.query(`
    INSERT INTO base_settings_attributes (
      key,
      label,
      scope,
      source_type,
      base_info_root_id,
      data_type,
      cardinality,
      min_selections,
      max_selections,
      visibility,
      is_required,
      is_active,
      user_editable,
      user_edit_policy,
      is_builtin,
      view_order,
      created_by,
      updated_by
    ) VALUES (
      'accent_theme',
      'Accent Theme',
      'USER',
      'CUSTOM',
      NULL,
      'json',
      'single',
      NULL,
      NULL,
      'CLIENT',
      FALSE,
      TRUE,
      TRUE,
      'ALWAYS',
      TRUE,
      0,
      $1,
      $1
    )
    ON CONFLICT (scope, key) DO UPDATE SET
      label = EXCLUDED.label,
      source_type = EXCLUDED.source_type,
      data_type = EXCLUDED.data_type,
      visibility = EXCLUDED.visibility,
      is_active = EXCLUDED.is_active,
      user_editable = EXCLUDED.user_editable,
      user_edit_policy = EXCLUDED.user_edit_policy,
      is_builtin = EXCLUDED.is_builtin,
      view_order = EXCLUDED.view_order,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = EXCLUDED.updated_by;
  `, [actorId]);

  await pool.query(`
    INSERT INTO base_settings_attributes (
      key,
      label,
      scope,
      source_type,
      base_info_root_id,
      data_type,
      cardinality,
      min_selections,
      max_selections,
      visibility,
      is_required,
      is_active,
      user_editable,
      user_edit_policy,
      is_builtin,
      view_order,
      created_by,
      updated_by
    ) VALUES (
      'theme_presets',
      'Theme Presets',
      'USER',
      'CUSTOM',
      NULL,
      'json',
      'single',
      NULL,
      NULL,
      'CLIENT',
      FALSE,
      TRUE,
      FALSE,
      'NONE',
      TRUE,
      0,
      $1,
      $1
    )
    ON CONFLICT (scope, key) DO UPDATE SET
      label = EXCLUDED.label,
      source_type = EXCLUDED.source_type,
      data_type = EXCLUDED.data_type,
      visibility = EXCLUDED.visibility,
      is_active = EXCLUDED.is_active,
      user_editable = EXCLUDED.user_editable,
      user_edit_policy = EXCLUDED.user_edit_policy,
      is_builtin = EXCLUDED.is_builtin,
      view_order = EXCLUDED.view_order,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = EXCLUDED.updated_by;
  `, [actorId]);

  await pool.query(`
    INSERT INTO base_settings_attributes (
      key,
      label,
      scope,
      source_type,
      base_info_root_id,
      data_type,
      cardinality,
      min_selections,
      max_selections,
      visibility,
      is_required,
      is_active,
      user_editable,
      user_edit_policy,
      is_builtin,
      view_order,
      created_by,
      updated_by
    ) VALUES (
      'shell_experience',
      'Shell Experience',
      'USER',
      'CUSTOM',
      NULL,
      'json',
      'single',
      NULL,
      NULL,
      'CLIENT',
      FALSE,
      TRUE,
      TRUE,
      'ALWAYS',
      TRUE,
      0,
      $1,
      $1
    )
    ON CONFLICT (scope, key) DO UPDATE SET
      label = EXCLUDED.label,
      source_type = EXCLUDED.source_type,
      data_type = EXCLUDED.data_type,
      visibility = EXCLUDED.visibility,
      is_active = EXCLUDED.is_active,
      user_editable = EXCLUDED.user_editable,
      user_edit_policy = EXCLUDED.user_edit_policy,
      is_builtin = EXCLUDED.is_builtin,
      view_order = EXCLUDED.view_order,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = EXCLUDED.updated_by;
  `, [actorId]);

  await pool.query(`
    INSERT INTO base_settings_attributes (
      key,
      label,
      scope,
      source_type,
      base_info_root_id,
      data_type,
      cardinality,
      min_selections,
      max_selections,
      visibility,
      is_required,
      is_active,
      user_editable,
      user_edit_policy,
      is_builtin,
      view_order,
      created_by,
      updated_by
    ) VALUES (
      'grid_column_layouts',
      'Grid Column Layouts',
      'USER',
      'CUSTOM',
      NULL,
      'json',
      'single',
      NULL,
      NULL,
      'CLIENT',
      FALSE,
      TRUE,
      FALSE,
      'NONE',
      TRUE,
      0,
      $1,
      $1
    )
    ON CONFLICT (scope, key) DO UPDATE SET
      label = EXCLUDED.label,
      source_type = EXCLUDED.source_type,
      data_type = EXCLUDED.data_type,
      visibility = EXCLUDED.visibility,
      is_active = EXCLUDED.is_active,
      user_editable = EXCLUDED.user_editable,
      user_edit_policy = EXCLUDED.user_edit_policy,
      is_builtin = EXCLUDED.is_builtin,
      view_order = EXCLUDED.view_order,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = EXCLUDED.updated_by;
  `, [actorId]);

  await pool.query(`
    INSERT INTO base_settings_attributes (
      key,
      label,
      scope,
      source_type,
      base_info_root_id,
      data_type,
      cardinality,
      min_selections,
      max_selections,
      visibility,
      is_required,
      is_active,
      user_editable,
      user_edit_policy,
      is_builtin,
      view_order,
      created_by,
      updated_by
    ) VALUES (
      'dashboard_layout',
      'Dashboard Layout',
      'USER',
      'CUSTOM',
      NULL,
      'json',
      'single',
      NULL,
      NULL,
      'CLIENT',
      FALSE,
      TRUE,
      FALSE,
      'NONE',
      TRUE,
      0,
      $1,
      $1
    )
    ON CONFLICT (scope, key) DO UPDATE SET
      label = EXCLUDED.label,
      source_type = EXCLUDED.source_type,
      data_type = EXCLUDED.data_type,
      visibility = EXCLUDED.visibility,
      is_active = EXCLUDED.is_active,
      user_editable = EXCLUDED.user_editable,
      user_edit_policy = EXCLUDED.user_edit_policy,
      is_builtin = EXCLUDED.is_builtin,
      view_order = EXCLUDED.view_order,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = EXCLUDED.updated_by;
  `, [actorId]);
}

async function syncSeedUserRolesPool(
  pool: Pool,
  userId: number,
  expectedRole: string | null,
): Promise<void> {
  if (expectedRole) {
    await pool.query(
      `INSERT INTO base_user_roles (user_id, role_name) VALUES ($1, $2) ON CONFLICT (user_id, role_name) DO NOTHING`,
      [userId, expectedRole],
    );
  }
  const toRemove = seedElevatedRolesToRemove(expectedRole);
  if (toRemove.length > 0) {
    await pool.query(
      'DELETE FROM base_user_roles WHERE user_id = $1 AND role_name = ANY($2::text[])',
      [userId, toRemove],
    );
  }
}

async function seedUsers(pool: Pool): Promise<void> {
  const adminHash = bcrypt.hashSync('admin123', 10);
  const userHash = bcrypt.hashSync('user12345', 10);
  const seedUsers = buildSeedUsers(adminHash, userHash);
  const pictureCache = new Map<string, ReturnType<typeof loadSeedPicture>>();

  const resolveSeedPicture = (relativePath: string) => {
    if (!pictureCache.has(relativePath)) {
      pictureCache.set(relativePath, loadSeedPicture(relativePath));
    }
    return pictureCache.get(relativePath)!;
  };

  for (const seed of seedUsers) {
    const picture = resolveSeedPicture(seed.profileImagePath);
    let userId: number;

    if (seed.isBuiltin) {
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO base_users (
           id, username, email, password_hash, is_builtin,
           mobile, email_verified_at, mobile_verified_at, last_login_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (username) DO NOTHING
         RETURNING id`,
        [
          seed.id, seed.username, seed.email, seed.passwordHash, seed.isBuiltin,
          seed.mobile, seed.emailVerifiedAt, seed.mobileVerifiedAt, seed.lastLoginAt,
        ],
      );
      userId = Number(inserted.rows[0]?.id || seed.id);
    } else {
      const inserted = await pool.query<{ id: string }>(
        `INSERT INTO base_users (
           username, email, password_hash, is_builtin,
           mobile, email_verified_at, mobile_verified_at, last_login_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (username) DO NOTHING
         RETURNING id`,
        [
          seed.username, seed.email, seed.passwordHash, seed.isBuiltin,
          seed.mobile, seed.emailVerifiedAt, seed.mobileVerifiedAt, seed.lastLoginAt,
        ],
      );
      if (inserted.rows[0]?.id) {
        userId = Number(inserted.rows[0].id);
      } else {
        const existing = await pool.query<{ id: string }>(
          'SELECT id FROM base_users WHERE username = $1 LIMIT 1',
          [seed.username],
        );
        userId = Number(existing.rows[0]?.id || 0);
        if (!userId) continue;
      }
    }

    await syncSeedUserRolesPool(pool, userId, seed.role);
    await pool.query(
      `INSERT INTO base_user_profiles (
         user_id, firstname, lastname, fathername, grandfathername, gender_code,
         nickname, national_code, birth_year, birth_month, birth_day, person_type_code, phone,
         profile_image_body, profile_image_body_xs, profile_image_mime, profile_image_size
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (user_id) DO NOTHING`,
      [
        userId, seed.firstname, seed.lastname, seed.fathername, seed.grandfathername, seed.genderCode,
        seed.nickname, seed.nationalCode, seed.birthYear, seed.birthMonth, seed.birthDay,
        seed.personTypeCode, seed.phone,
        picture.body, picture.bodyXs, picture.mime, picture.size,
      ],
    );
  }
}

/** First auto-generated role id (built-in roles and all new roles). */
export const ROLE_ID_SEQUENCE_START = 1_000;

/** Convert `?` placeholders to PostgreSQL `$1, $2, …` positional params. */
export const toPositionalParams = (sql: string): string => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

async function getSerialSequenceName(
  pool: Pool,
  tableName: string,
  columnName: string,
): Promise<string | null> {
  const result = await pool.query<{ seq: string | null }>(
    'SELECT pg_get_serial_sequence($1, $2) AS seq',
    [tableName, columnName],
  );
  return result.rows[0]?.seq ?? null;
}

function quoteQualifiedIdentifier(identifier: string): string {
  return identifier
    .split('.')
    .map((part) => `"${part.replace(/"/g, '""')}"`)
    .join('.');
}

/** Align a serial sequence definition and next value with the configured minimum start. */
async function configureSerialSequence(
  pool: Pool,
  tableName: string,
  columnName: string,
  minStart: number,
): Promise<void> {
  const sequenceName = await getSerialSequenceName(pool, tableName, columnName);
  if (!sequenceName) return;

  const maxResult = await pool.query<{ max_id: string | null }>(
    `SELECT COALESCE(MAX(${columnName}), 0) AS max_id FROM ${tableName}`,
  );
  const nextId = Math.max(Number(maxResult.rows[0]?.max_id || 0) + 1, minStart);
  const quotedSequence = quoteQualifiedIdentifier(sequenceName);

  await pool.query(
    `ALTER SEQUENCE ${quotedSequence} MINVALUE ${minStart} START WITH ${nextId} RESTART WITH ${nextId}`,
  );
}

let dbInitPromise: Promise<void> | null = null;

export type InitDbOptions = {
  /** When true (default), insert demo users and contact messages. Schema/reference data is always created. */
  seedSampleData?: boolean;
};

export function resetDbInitState(): void {
  dbInitPromise = null;
}

async function runInitDB(pool: Pool, options: InitDbOptions = {}): Promise<void> {
  const seedSampleData = options.seedSampleData === true;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS base_users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
      locked SMALLINT NOT NULL DEFAULT 0,
      locked_at TIMESTAMPTZ,
      locked_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      unlocked_at TIMESTAMPTZ,
      unlocked_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      login_fail_count INTEGER NOT NULL DEFAULT 0,
      login_fail_last_at TIMESTAMPTZ,
      last_login_at TIMESTAMPTZ,
      email_verified_at TIMESTAMPTZ,
      mobile TEXT,
      mobile_verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_base_users_created_at ON base_users(created_at);
    CREATE INDEX IF NOT EXISTS idx_base_users_updated_at ON base_users(updated_at);
    CREATE INDEX IF NOT EXISTS idx_base_users_locked ON base_users(locked);

    CREATE TABLE IF NOT EXISTS base_otp_challenges (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES base_users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      channel TEXT NOT NULL,
      target TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_otp_challenges_user_id ON base_otp_challenges(user_id);
    CREATE INDEX IF NOT EXISTS idx_otp_challenges_expires_at ON base_otp_challenges(expires_at);

    CREATE TABLE IF NOT EXISTS base_info (
      id VARCHAR(64) PRIMARY KEY,
      parent_id VARCHAR(64),
      title TEXT,
      short_name VARCHAR(32),
      view_order NUMERIC(12,4),
      note TEXT,
      metadata TEXT,
      value INTEGER,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      ui_color VARCHAR(16),
      ui_html TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_base_info_parent
        FOREIGN KEY(parent_id) REFERENCES base_info(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_base_info_parent_id ON base_info(parent_id);
    CREATE INDEX IF NOT EXISTS idx_base_info_is_active ON base_info(is_active);
    CREATE INDEX IF NOT EXISTS idx_base_info_parent_order ON base_info(parent_id, view_order, id);

    CREATE TABLE IF NOT EXISTS base_user_profiles (
      user_id BIGINT PRIMARY KEY,
      firstname TEXT,
      lastname TEXT,
      fathername TEXT,
      grandfathername TEXT,
      phone TEXT,
      nickname TEXT,
      national_code VARCHAR(16),
      birth_year VARCHAR(4),
      birth_month VARCHAR(2),
      birth_day VARCHAR(2),
      gender_code VARCHAR(64),
      person_type_code VARCHAR(64),
      company_name TEXT,
      registration_number TEXT,
      website TEXT,
      profile_image_body BYTEA,
      profile_image_body_xs BYTEA,
      profile_image_mime VARCHAR(128),
      profile_image_size INTEGER,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_user_profiles_gender
        FOREIGN KEY(gender_code) REFERENCES base_info(id) ON DELETE SET NULL,
      CONSTRAINT fk_user_profiles_person_type
        FOREIGN KEY(person_type_code) REFERENCES base_info(id) ON DELETE SET NULL,
      CONSTRAINT chk_user_profiles_birth_year
        CHECK (birth_year IS NULL OR birth_year ~ '^[0-9]{1,4}$'),
      CONSTRAINT chk_user_profiles_birth_month
        CHECK (birth_month IS NULL OR birth_month ~ '^(0[1-9]|1[0-2])$'),
      CONSTRAINT chk_user_profiles_birth_day
        CHECK (birth_day IS NULL OR birth_day ~ '^(0[1-9]|[12][0-9]|3[01])$'),
      CONSTRAINT chk_user_profiles_image_size
        CHECK (profile_image_size IS NULL OR profile_image_size >= 0),
      CONSTRAINT fk_user_profiles_user
        FOREIGN KEY(user_id) REFERENCES base_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS base_user_identities (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES base_users(id) ON DELETE CASCADE,
      provider_id TEXT NOT NULL,
      provider_kind TEXT NOT NULL,
      subject TEXT NOT NULL,
      email TEXT,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      profile_json TEXT,
      linked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      UNIQUE (provider_id, subject)
    );

    CREATE INDEX IF NOT EXISTS idx_base_user_identities_user_id ON base_user_identities(user_id);

    ALTER TABLE base_info DROP CONSTRAINT IF EXISTS fk_base_info_parent;
    ALTER TABLE base_info
      ADD CONSTRAINT fk_base_info_parent
      FOREIGN KEY(parent_id) REFERENCES base_info(id) ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE base_user_profiles DROP CONSTRAINT IF EXISTS fk_user_profiles_gender;
    ALTER TABLE base_user_profiles
      ADD CONSTRAINT fk_user_profiles_gender
      FOREIGN KEY(gender_code) REFERENCES base_info(id) ON DELETE SET NULL ON UPDATE CASCADE;

    ALTER TABLE base_user_profiles DROP CONSTRAINT IF EXISTS fk_user_profiles_person_type;
    ALTER TABLE base_user_profiles
      ADD CONSTRAINT fk_user_profiles_person_type
      FOREIGN KEY(person_type_code) REFERENCES base_info(id) ON DELETE SET NULL ON UPDATE CASCADE;

    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS national_code VARCHAR(16);
    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS birth_year VARCHAR(4);
    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS birth_month VARCHAR(2);
    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS birth_day VARCHAR(2);
    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS gender_code VARCHAR(64);
    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS person_type_code VARCHAR(64);
    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS registration_number TEXT;
    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS website TEXT;
    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS profile_image_body BYTEA;
    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS profile_image_body_xs BYTEA;
    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS profile_image_mime VARCHAR(128);
    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS profile_image_size INTEGER;

    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS firstname TEXT;
    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS lastname TEXT;
    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS fathername TEXT;
    ALTER TABLE base_user_profiles ADD COLUMN IF NOT EXISTS grandfathername TEXT;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'base_user_profiles' AND column_name = 'full_name'
      ) THEN
        UPDATE base_user_profiles
        SET firstname = COALESCE(firstname, full_name)
        WHERE firstname IS NULL AND full_name IS NOT NULL;
        ALTER TABLE base_user_profiles DROP COLUMN full_name;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'base_user_profiles' AND column_name = 'avatar_url'
      ) THEN
        ALTER TABLE base_user_profiles DROP COLUMN avatar_url;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS base_roles (
      id BIGSERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS base_user_roles (
      user_id BIGINT NOT NULL,
      role_name TEXT NOT NULL,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, role_name),
      CONSTRAINT fk_user_roles_user
        FOREIGN KEY(user_id) REFERENCES base_users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_roles_role
        FOREIGN KEY(role_name) REFERENCES base_roles(name) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS base_role_mcp_grants (
      id BIGSERIAL PRIMARY KEY,
      role_name TEXT NOT NULL REFERENCES base_roles(name) ON DELETE CASCADE,
      resource_kind TEXT NOT NULL CHECK (resource_kind IN ('builtin_pack', 'external_mcp', 'plugin_mcp')),
      resource_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      UNIQUE (role_name, resource_kind, resource_id)
    );

    CREATE INDEX IF NOT EXISTS idx_role_mcp_grants_role
      ON base_role_mcp_grants(role_name);

    CREATE TABLE IF NOT EXISTS base_settings_attributes (
      id BIGSERIAL PRIMARY KEY,
      key TEXT NOT NULL,
      label TEXT,
      scope TEXT NOT NULL CHECK (scope IN ('USER', 'ROLE')),
      source_type TEXT NOT NULL CHECK (source_type IN ('BASE_INFO', 'CUSTOM', 'PROFILE')),
      base_info_root_id VARCHAR(64),
      profile_field TEXT,
      data_type TEXT CHECK (data_type IN ('string', 'number', 'boolean', 'json', 'base_info_code')),
      cardinality TEXT NOT NULL DEFAULT 'single' CHECK (cardinality IN ('single', 'multi')),
      min_selections INTEGER,
      max_selections INTEGER,
      visibility TEXT NOT NULL DEFAULT 'BOTH' CHECK (visibility IN ('SERVER', 'CLIENT', 'BOTH')),
      is_required BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      view_order NUMERIC(12,4) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      CONSTRAINT uq_settings_attributes_scope_key UNIQUE (scope, key),
      CONSTRAINT fk_settings_attributes_base_info_root
        FOREIGN KEY(base_info_root_id) REFERENCES base_info(id) ON DELETE SET NULL,
      CONSTRAINT chk_settings_attributes_profile
        CHECK (
          (source_type = 'PROFILE' AND scope = 'USER' AND profile_field IS NOT NULL)
          OR (source_type <> 'PROFILE' AND profile_field IS NULL)
        )
    );

    CREATE INDEX IF NOT EXISTS idx_settings_attributes_scope_active
      ON base_settings_attributes(scope, is_active, view_order, id);

    ALTER TABLE base_settings_attributes ADD COLUMN IF NOT EXISTS profile_field TEXT;
    ALTER TABLE base_settings_attributes DROP COLUMN IF EXISTS label_en;
    ALTER TABLE base_settings_attributes DROP COLUMN IF EXISTS label_fa;
    ALTER TABLE base_settings_attributes DROP COLUMN IF EXISTS label_ar;
    ALTER TABLE base_settings_attributes ADD COLUMN IF NOT EXISTS user_editable BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE base_settings_attributes ADD COLUMN IF NOT EXISTS user_edit_policy TEXT NOT NULL DEFAULT 'WHEN_EMPTY';
    ALTER TABLE base_settings_attributes ADD COLUMN IF NOT EXISTS is_builtin BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE base_settings_attributes DROP CONSTRAINT IF EXISTS base_settings_attributes_user_edit_policy_check;
    ALTER TABLE base_settings_attributes
      ADD CONSTRAINT base_settings_attributes_user_edit_policy_check
      CHECK (user_edit_policy IN ('NONE', 'WHEN_EMPTY', 'ALWAYS'));

    UPDATE base_settings_attributes
    SET user_edit_policy = CASE
      WHEN user_editable = TRUE THEN 'WHEN_EMPTY'
      ELSE 'NONE'
    END;

    UPDATE base_settings_attributes
    SET user_editable = (user_edit_policy <> 'NONE');

    ALTER TABLE base_settings_attributes DROP CONSTRAINT IF EXISTS base_settings_attributes_source_type_check;
    ALTER TABLE base_settings_attributes DROP CONSTRAINT IF EXISTS chk_settings_attributes_profile;

    ALTER TABLE base_settings_attributes
      ADD CONSTRAINT base_settings_attributes_source_type_check
      CHECK (source_type IN ('BASE_INFO', 'CUSTOM', 'PROFILE'));

    ALTER TABLE base_settings_attributes
      ADD CONSTRAINT chk_settings_attributes_profile
      CHECK (
        (source_type = 'PROFILE' AND scope = 'USER' AND profile_field IS NOT NULL)
        OR (source_type <> 'PROFILE' AND profile_field IS NULL)
      );

    CREATE TABLE IF NOT EXISTS base_settings_profile_fields (
      profile_field TEXT PRIMARY KEY,
      context_key TEXT NOT NULL,
      label_en TEXT,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      user_edit_policy TEXT NOT NULL DEFAULT 'WHEN_EMPTY',
      visibility TEXT NOT NULL DEFAULT 'BOTH',
      view_order NUMERIC(12,4) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      CONSTRAINT base_settings_profile_fields_user_edit_policy_check
        CHECK (user_edit_policy IN ('NONE', 'WHEN_EMPTY', 'ALWAYS')),
      CONSTRAINT base_settings_profile_fields_visibility_check
        CHECK (visibility IN ('SERVER', 'CLIENT', 'BOTH'))
    );

    CREATE INDEX IF NOT EXISTS idx_settings_profile_fields_active
      ON base_settings_profile_fields(is_active, view_order, profile_field);

    INSERT INTO base_settings_profile_fields (
      profile_field,
      context_key,
      label_en,
      is_active,
      user_edit_policy,
      visibility,
      view_order,
      created_at,
      created_by,
      updated_at,
      updated_by
    )
    SELECT
      profile_field,
      key,
      label_en,
      is_active,
      user_edit_policy,
      visibility,
      view_order,
      created_at,
      created_by,
      updated_at,
      updated_by
    FROM base_settings_attributes
    WHERE source_type = 'PROFILE' AND profile_field IS NOT NULL
    ON CONFLICT (profile_field) DO NOTHING;

    DELETE FROM base_settings_attributes WHERE source_type = 'PROFILE';

    ALTER TABLE base_settings_attributes DROP CONSTRAINT IF EXISTS base_settings_attributes_source_type_check;
    ALTER TABLE base_settings_attributes DROP CONSTRAINT IF EXISTS chk_settings_attributes_profile;

    ALTER TABLE base_settings_attributes
      ADD CONSTRAINT base_settings_attributes_source_type_check
      CHECK (source_type IN ('BASE_INFO', 'CUSTOM'));

    ALTER TABLE base_settings_attributes
      ADD CONSTRAINT chk_settings_attributes_profile
      CHECK (profile_field IS NULL);

    CREATE TABLE IF NOT EXISTS base_users_attributes (
      id BIGSERIAL PRIMARY KEY,
      definition_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      value_text TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      CONSTRAINT uq_user_attributes_definition_user UNIQUE (definition_id, user_id),
      CONSTRAINT fk_user_attributes_definition
        FOREIGN KEY(definition_id) REFERENCES base_settings_attributes(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_attributes_user
        FOREIGN KEY(user_id) REFERENCES base_users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_attributes_user
      ON base_users_attributes(user_id, definition_id);

    CREATE TABLE IF NOT EXISTS base_settings_sections (
      section_key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS base_roles_attributes (
      id BIGSERIAL PRIMARY KEY,
      definition_id BIGINT NOT NULL,
      role_name TEXT NOT NULL,
      value_text TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      CONSTRAINT uq_role_attributes_definition_role UNIQUE (definition_id, role_name),
      CONSTRAINT fk_role_attributes_definition
        FOREIGN KEY(definition_id) REFERENCES base_settings_attributes(id) ON DELETE CASCADE,
      CONSTRAINT fk_role_attributes_role
        FOREIGN KEY(role_name) REFERENCES base_roles(name) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_role_attributes_role
      ON base_roles_attributes(role_name, definition_id);

    CREATE TABLE IF NOT EXISTS base_auth_refresh_tokens (
      id BIGSERIAL PRIMARY KEY,
      token_jti TEXT UNIQUE NOT NULL,
      user_id BIGINT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at BIGINT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      revoked_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      replaced_by_jti TEXT,
      user_agent TEXT,
      ip_address TEXT,
      CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY(user_id) REFERENCES base_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS base_logs_auth_audit (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT,
      email TEXT,
      event_type TEXT NOT NULL,
      success INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      ip_address TEXT,
      user_agent TEXT,
      metadata_json TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_auth_audit_logs_user
        FOREIGN KEY(user_id) REFERENCES base_users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS base_logs_app (
      id BIGSERIAL PRIMARY KEY,
      actor TEXT NOT NULL DEFAULT 'SYSTEM',
      call_success INTEGER,
      failure_reason TEXT,
      duration_ms INTEGER,
      level TEXT NOT NULL,
      context TEXT NOT NULL,
      message TEXT NOT NULL,
      message_size INTEGER NOT NULL DEFAULT 0,
      has_meta INTEGER NOT NULL DEFAULT 0,
      meta_json TEXT,
      meta_size INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON base_logs_app(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_app_logs_level ON base_logs_app(level);
    CREATE INDEX IF NOT EXISTS idx_app_logs_context ON base_logs_app(context);
    CREATE INDEX IF NOT EXISTS idx_app_logs_actor ON base_logs_app(actor);

    CREATE TABLE IF NOT EXISTS base_jobs (
      id BIGSERIAL PRIMARY KEY,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER NOT NULL DEFAULT 0,
      progress_message TEXT,
      payload_json TEXT,
      result_json TEXT,
      error_message TEXT,
      cancel_requested INTEGER NOT NULL DEFAULT 0,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      queued_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON base_jobs(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON base_jobs(created_at DESC);

    CREATE TABLE IF NOT EXISTS base_contact_messages (
      id BIGSERIAL PRIMARY KEY,
      topic_code VARCHAR(64) NOT NULL,
      title TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_contact_messages_topic
        FOREIGN KEY(topic_code) REFERENCES base_info(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON base_contact_messages(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_contact_messages_topic ON base_contact_messages(topic_code);
    CREATE INDEX IF NOT EXISTS idx_contact_messages_created_by ON base_contact_messages(created_by);

    CREATE TABLE IF NOT EXISTS base_ai_chat_sessions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES base_users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      model_id TEXT,
      messages_json TEXT NOT NULL DEFAULT '[]',
      agent_capability_scope_json TEXT,
      context_history_summary TEXT,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_updated
      ON base_ai_chat_sessions(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS base_ai_agent_traces (
      id BIGSERIAL PRIMARY KEY,
      session_id BIGINT REFERENCES base_ai_chat_sessions(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES base_users(id) ON DELETE CASCADE,
      iteration INTEGER NOT NULL,
      model_id TEXT,
      mode TEXT NOT NULL,
      policy_action TEXT,
      tool_name TEXT,
      args_hash TEXT,
      duration_ms INTEGER,
      tokens_estimate INTEGER,
      ok BOOLEAN,
      error TEXT,
      summary TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ai_agent_traces_session
      ON base_ai_agent_traces(session_id, iteration ASC);

    CREATE INDEX IF NOT EXISTS idx_ai_agent_traces_user_created
      ON base_ai_agent_traces(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS base_ai_agent_apply_snapshots (
      id BIGSERIAL PRIMARY KEY,
      session_id BIGINT REFERENCES base_ai_chat_sessions(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES base_users(id) ON DELETE CASCADE,
      proposal_id TEXT NOT NULL,
      change_sets_json TEXT NOT NULL,
      snapshots_json TEXT NOT NULL,
      summary TEXT,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      rolled_back_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_ai_agent_apply_snapshots_session
      ON base_ai_agent_apply_snapshots(session_id, applied_at DESC);

    CREATE INDEX IF NOT EXISTS idx_ai_agent_apply_snapshots_user
      ON base_ai_agent_apply_snapshots(user_id, applied_at DESC);

    CREATE OR REPLACE FUNCTION zz_calculate_hid(
      p_table_name TEXT,
      p_parent_id VARCHAR DEFAULT NULL,
      p_child_digits INTEGER DEFAULT 3,
      p_delimiter CHAR(1) DEFAULT '.'
    ) RETURNS VARCHAR
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_parent_id VARCHAR;
      v_prefix VARCHAR;
      v_start_number INTEGER;
      v_end_number INTEGER;
      v_candidate VARCHAR;
      v_exists INTEGER;
      v_num INTEGER;
    BEGIN
      IF p_table_name IS NULL OR p_table_name <> 'base_info' THEN
        RAISE EXCEPTION 'zz_calculate_hid supports only base_info table.';
      END IF;

      IF p_child_digits IS NULL OR p_child_digits < 1 OR p_child_digits > 9 THEN
        RAISE EXCEPTION 'p_child_digits must be between 1 and 9.';
      END IF;

      IF p_delimiter IS NULL OR length(p_delimiter) <> 1 THEN
        RAISE EXCEPTION 'p_delimiter must be exactly one character.';
      END IF;

      v_parent_id := NULLIF(trim(COALESCE(p_parent_id, '')), '');

      IF v_parent_id IS NULL THEN
        v_prefix := '';
        v_start_number := CAST(power(10, p_child_digits - 1) AS INTEGER);
      ELSE
        v_prefix := v_parent_id || p_delimiter;
        v_start_number := 1;
      END IF;

      v_end_number := CAST(power(10, p_child_digits) - 1 AS INTEGER);

      FOR v_num IN v_start_number..v_end_number LOOP
        v_candidate := v_prefix || lpad(v_num::TEXT, p_child_digits, '0');

        EXECUTE format('SELECT 1 FROM %I WHERE id = $1 LIMIT 1', p_table_name)
          INTO v_exists
          USING v_candidate;

        IF v_exists IS NULL THEN
          RETURN v_candidate;
        END IF;
      END LOOP;

      RAISE EXCEPTION 'No free hierarchical id found for table %, parent %.', p_table_name, v_parent_id;
    END;
    $$;

    CREATE OR REPLACE FUNCTION zz_calculate_hid_digits_count(
      p_table_name TEXT,
      p_parent_id VARCHAR DEFAULT NULL,
      p_delimiter CHAR(1) DEFAULT '.'
    ) RETURNS INTEGER
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_parent_id VARCHAR;
      v_last_id VARCHAR;
    BEGIN
      IF p_table_name IS NULL OR p_table_name <> 'base_info' THEN
        RAISE EXCEPTION 'zz_calculate_hid_digits_count supports only base_info table.';
      END IF;

      IF p_delimiter IS NULL OR length(p_delimiter) <> 1 THEN
        RAISE EXCEPTION 'p_delimiter must be exactly one character.';
      END IF;

      v_parent_id := trim(COALESCE(p_parent_id, ''));

      EXECUTE format(
        'SELECT id FROM %I WHERE COALESCE(parent_id, '''') = $1 ORDER BY id DESC LIMIT 1',
        p_table_name
      )
      INTO v_last_id
      USING v_parent_id;

      IF v_last_id IS NULL THEN
        RETURN 1;
      END IF;

      IF v_parent_id = '' THEN
        RETURN length(v_last_id);
      END IF;

      RETURN length(replace(v_last_id, v_parent_id || p_delimiter, ''));
    END;
    $$;

    CREATE OR REPLACE FUNCTION zz_insert_base_info_node(
      p_parent_id VARCHAR,
      p_child_digits INTEGER,
      p_title TEXT,
      p_title_en TEXT,
      p_title_fa TEXT,
      p_title_ar TEXT,
      p_short_name VARCHAR,
      p_view_order NUMERIC,
      p_note TEXT,
      p_note_en TEXT,
      p_note_fa TEXT,
      p_note_ar TEXT,
      p_metadata TEXT,
      p_value INTEGER,
      p_is_active BOOLEAN,
      p_ui_color VARCHAR,
      p_ui_html TEXT,
      p_actor_id BIGINT
    ) RETURNS VARCHAR
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_id VARCHAR;
      v_parent_id VARCHAR;
    BEGIN
      v_parent_id := NULLIF(trim(COALESCE(p_parent_id, '')), '');
      v_id := zz_calculate_hid('base_info', v_parent_id, COALESCE(p_child_digits, 3), '.');

      INSERT INTO base_info (
        id,
        parent_id,
        title,
        title_en,
        title_fa,
        title_ar,
        short_name,
        view_order,
        note,
        note_en,
        note_fa,
        note_ar,
        metadata,
        value,
        is_active,
        ui_color,
        ui_html,
        created_by,
        updated_by,
        created_at,
        updated_at
      ) VALUES (
        v_id,
        v_parent_id,
        p_title,
        p_title_en,
        p_title_fa,
        p_title_ar,
        p_short_name,
        p_view_order,
        p_note,
        p_note_en,
        p_note_fa,
        p_note_ar,
        p_metadata,
        p_value,
        COALESCE(p_is_active, TRUE),
        p_ui_color,
        p_ui_html,
        p_actor_id,
        p_actor_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );

      RETURN v_id;
    END;
    $$;
  `);

  await pool.query(`
    ALTER TABLE base_users ADD COLUMN IF NOT EXISTS locked SMALLINT NOT NULL DEFAULT 0;
    ALTER TABLE base_users ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
    ALTER TABLE base_users ADD COLUMN IF NOT EXISTS locked_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL;
    ALTER TABLE base_users ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ;
    ALTER TABLE base_users ADD COLUMN IF NOT EXISTS unlocked_by BIGINT REFERENCES base_users(id) ON DELETE SET NULL;
    ALTER TABLE base_users DROP COLUMN IF EXISTS role;
    ALTER TABLE base_users DROP COLUMN IF EXISTS is_active;

    ALTER TABLE base_ai_chat_sessions DROP COLUMN IF EXISTS plan_document_path;
    ALTER TABLE base_ai_chat_sessions DROP COLUMN IF EXISTS session_documents_json;
    ALTER TABLE base_ai_chat_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    ALTER TABLE base_ai_chat_sessions ADD COLUMN IF NOT EXISTS agent_capability_scope_json TEXT;
    ALTER TABLE base_ai_chat_sessions ADD COLUMN IF NOT EXISTS context_history_summary TEXT;
    ALTER TABLE base_ai_chat_sessions ADD COLUMN IF NOT EXISTS total_input_tokens INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE base_ai_chat_sessions ADD COLUMN IF NOT EXISTS total_output_tokens INTEGER NOT NULL DEFAULT 0;
  `);

  await pool.query(`
    CREATE OR REPLACE VIEW base_contact_messages_v AS
    SELECT
      m.id,
      m.topic_code,
      COALESCE(bi.title_fa, bi.title_en, bi.title, m.topic_code) AS topic_label,
      m.title,
      m.note,
      m.created_at,
      m.created_by,
      u.username AS created_by_username
    FROM base_contact_messages m
    LEFT JOIN base_info bi ON bi.id = m.topic_code
    LEFT JOIN base_users u ON u.id = m.created_by;
  `);

  await pool.query(`
    INSERT INTO base_roles (id, name, note) VALUES
      (${ROLE_ID_SEQUENCE_START}, 'ADMIN', 'System administrator'),
      (${ROLE_ID_SEQUENCE_START + 1}, 'DEVELOPER', 'Developer access to platform APIs')
    ON CONFLICT (name) DO NOTHING;
  `);

  await configureSerialSequence(pool, 'base_roles', 'id', ROLE_ID_SEQUENCE_START);

  const adminBeforeSeed = await pool.query('SELECT id FROM base_users WHERE email = $1 LIMIT 1', ['admin@append.os']);
  const adminIdBeforeSeed = Number(adminBeforeSeed.rows[0]?.id || 0);

  await seedBaseInfoLookups(pool, adminIdBeforeSeed > 0 ? adminIdBeforeSeed : null);
  await seedSettingsAttributes(pool, adminIdBeforeSeed > 0 ? adminIdBeforeSeed : null);

  if (seedSampleData) {
    await seedUsers(pool);
    await configureSerialSequence(pool, 'base_users', 'id', USER_ID_SEQUENCE_START);

    const adminAfterSeed = await pool.query<{ id: string }>(
      'SELECT id FROM base_users WHERE email = $1 LIMIT 1',
      ['admin@append.os'],
    );
    const adminActorId = Number(adminAfterSeed.rows[0]?.id || 0) || null;
    await seedRoleMcpGrants(pool, adminActorId);
  } else {
    await configureSerialSequence(pool, 'base_users', 'id', USER_ID_SEQUENCE_START);
    await seedRoleMcpGrants(pool, adminIdBeforeSeed > 0 ? adminIdBeforeSeed : null);
  }

  await pool.query('DELETE FROM base_auth_refresh_tokens WHERE expires_at <= $1', [Date.now()]);
  await pool.query('DELETE FROM base_logs_auth_audit WHERE id NOT IN (SELECT id FROM base_logs_auth_audit ORDER BY id DESC LIMIT 10000)');
  await pool.query('DELETE FROM base_logs_app WHERE id NOT IN (SELECT id FROM base_logs_app ORDER BY id DESC LIMIT 50000)');

}

/** Runs schema bootstrap once per process; concurrent callers share the same in-flight promise. */
export async function ensureDbInitialized(pool: Pool, options: InitDbOptions = {}): Promise<void> {
  if (!dbInitPromise) {
    dbInitPromise = runInitDB(pool, options).catch((error) => {
      dbInitPromise = null;
      throw error;
    });
  }

  await dbInitPromise;
}

export async function initDB(pool: Pool, options: InitDbOptions = {}): Promise<void> {
  await ensureDbInitialized(pool, options);
}
