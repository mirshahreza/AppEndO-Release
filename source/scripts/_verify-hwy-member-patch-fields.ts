/**
 * One-off: verify PATCH /api/hwy/member-directory/:id persists every writable field on GET getOne.
 * Usage: npx tsx scripts/_verify-hwy-member-patch-fields.ts [memberId]
 */
import {
  HWY_MEMBER_DIRECTORY_PATCH_FIELD_KEYS,
  type HwyMemberDirectoryPatchInput,
} from '../src/domain/hwy/hwyMemberDirectoryPatch';
import { buildHwyMemberDossierEditDraft } from '../src/domain/hwy/hwyMemberDossierEditDraft';
import type { HwyMemberDirectoryDetail } from '../src/domain/hwy/hwyMemberDirectoryDetail';

const BASE = 'http://127.0.0.1:3000';
const LOGIN = {
  identifier: process.env.SMOKE_IDENTIFIER || 'admin',
  password: process.env.SMOKE_PASSWORD || 'admin123',
};

type Detail = HwyMemberDirectoryDetail & Record<string, unknown>;

const detailKeyForPatchKey: Record<(typeof HWY_MEMBER_DIRECTORY_PATCH_FIELD_KEYS)[number], keyof Detail> = {
  firstname: 'firstname',
  lastname: 'lastname',
  fathername: 'fathername',
  grandfathername: 'grandfathername',
  greatGrandfatherName: 'greatGrandfatherName',
  motherFirstName: 'motherFirstName',
  motherFatherName: 'motherFatherName',
  motherGrandfatherName: 'motherGrandfatherName',
  nickname: 'nickname',
  birthYear: 'birthYear',
  birthMonth: 'birthMonth',
  birthDay: 'birthDay',
  genderCode: 'genderCode',
  phone1: 'phone1',
  phone2: 'phone2',
  email: 'email',
  facebookId: 'facebookId',
  twitterId: 'twitterId',
  tiktokId: 'tiktokId',
  addrProvinceId: 'addrProvinceId',
  addrDistrictId: 'addrDistrictId',
  addrSubdistrictId: 'addrSubdistrictId',
  addrQuarterName: 'addrQuarterName',
  addrQuarterNo: 'addrQuarterNo',
  addrAlleyNo: 'addrAlleyNo',
  addrHouseNo: 'addrHouseNo',
  addrNearestLandmark: 'addrNearestLandmark',
  addrMostImportantPlace: 'addrMostImportantPlace',
  addrMaktabId: 'addrMaktabId',
  addrRegionId: 'addrRegionId',
  addrCircleId: 'addrCircleId',
  educationLevelCode: 'educationLevelCode',
  educationLevelInCode: 'educationLevelInCode',
  educationEntryYear: 'educationEntryYear',
  educationEndYear: 'educationEndYear',
  educationBranch: 'educationBranch',
  educationSchool: 'educationSchool',
  educationUniversityCode: 'educationUniversityCode',
  educationUniversityFacultyCode: 'educationUniversityFacultyCode',
  jobTypeCode: 'jobTypeCode',
  jobPlace: 'jobPlace',
};

function normalizeCompare(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(LOGIN),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  if (!cookie) {
    throw new Error('Login did not return cookies');
  }
  return cookie;
}

async function apiGet<T>(cookie: string, path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });
  const json = (await res.json()) as T;
  if (!res.ok) {
    throw new Error(`GET ${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function apiPatch(cookie: string, memberId: string, patch: HwyMemberDirectoryPatchInput): Promise<void> {
  const res = await fetch(`${BASE}/api/hwy/member-directory/${encodeURIComponent(memberId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(patch),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`PATCH failed: ${res.status} ${JSON.stringify(json)}`);
  }
}

async function fetchDetail(cookie: string, memberId: string): Promise<Detail> {
  const payload = await apiGet<{ success?: boolean; data?: Detail }>(
    cookie,
    `/api/hwy/member-directory/${encodeURIComponent(memberId)}?lang=ar`,
  );
  if (!payload.data) {
    throw new Error('getOne returned no data');
  }
  return payload.data;
}

async function fetchListFirstMemberId(cookie: string): Promise<string> {
  const payload = await apiGet<{ data?: { rows?: { id?: unknown }[] } }>(
    cookie,
    '/api/hwy/member-directory?page=1&pageSize=1&lang=ar',
  );
  const id = payload.data?.rows?.[0]?.id;
  if (id == null) {
    throw new Error('List returned no members');
  }
  return String(id);
}

function testValueForField(
  key: (typeof HWY_MEMBER_DIRECTORY_PATCH_FIELD_KEYS)[number],
  original: string,
  tag: string,
): string {
  const idLike = /^addr|^education|^jobType|^gender/.test(key);
  if (idLike && original.trim()) {
    return original;
  }
  if (key === 'birthYear') {
    return '2001';
  }
  if (key === 'birthMonth') {
    return '6';
  }
  if (key === 'birthDay') {
    return '15';
  }
  if (key === 'phone1' || key === 'phone2') {
    return '07709998877';
  }
  if (key === 'email') {
    return `patch-${tag}@appendo.test`;
  }
  if (key.endsWith('Id') || key.endsWith('Code')) {
    return original || '100.2.1';
  }
  return `Pv${tag}${key}`.slice(0, 40);
}

async function main(): Promise<void> {
  const cookie = await login();
  const memberId = process.argv[2]?.trim() || (await fetchListFirstMemberId(cookie));
  console.log(`Member id: ${memberId}`);

  const baseline = await fetchDetail(cookie, memberId);
  const baselineDraft = buildHwyMemberDossierEditDraft(baseline);
  console.log(`Linked userId: ${baseline.userId ?? '(none)'}`);

  const tag = String(Date.now()).slice(-6);
  const failures: string[] = [];
  const skipped: string[] = [];

  for (const key of HWY_MEMBER_DIRECTORY_PATCH_FIELD_KEYS) {
    const draft = { ...baselineDraft };
    const origDraftVal = normalizeCompare(draft[key]);
    const nextVal = testValueForField(key, origDraftVal, tag);
    if (nextVal === origDraftVal && (key.endsWith('Id') || key.endsWith('Code'))) {
      skipped.push(`${key} (kept coded value ${nextVal})`);
    }
    draft[key] = nextVal;

    try {
      await apiPatch(cookie, memberId, draft);
      const after = await fetchDetail(cookie, memberId);
      const detailKey = detailKeyForPatchKey[key];
      const got = normalizeCompare(after[detailKey]);
      const want = normalizeCompare(nextVal);
      if (got !== want) {
        failures.push(`${key}: expected "${want}", got "${got}"`);
      } else {
        console.log(`OK ${key}`);
      }
    } catch (err) {
      failures.push(`${key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('\nRestoring baseline…');
  await apiPatch(cookie, memberId, baselineDraft);
  const restored = await fetchDetail(cookie, memberId);
  if (normalizeCompare(restored.firstname) !== normalizeCompare(baseline.firstname)) {
    failures.push(`restore: firstname did not revert`);
  }

  if (skipped.length) {
    console.log('\nSkipped (kept existing coded ids):', skipped.join(', '));
  }
  if (failures.length) {
    console.error('\nFAILURES:\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log('\nAll writable fields persisted on getOne.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
