import type { EdgeColumnHistory } from '../../../shared/api/contracts/record-events';
import { HWY_MEMBER_DIRECTORY_PATCH_FIELD_KEYS } from '../../../domain/hwy/hwyMemberDirectoryPatch';

const track = (): EdgeColumnHistory => ({ track: true });
const trackRedact = (): EdgeColumnHistory => ({ track: true, redact: true });

/** Legacy `HWY_Members_ChangeHistory` JSON keys → record-event field + redact. */
export const HWY_MEMBER_LEGACY_CHANGE_JSON_FIELD_MAP: Record<
  string,
  { field: string; redact?: boolean }
> = {
  FirstName: { field: 'firstname' },
  LastName: { field: 'lastname' },
  FatherName: { field: 'fathername' },
  GrandFatherName: { field: 'grandfathername' },
  Phone1: { field: 'phone1', redact: true },
  Phone2: { field: 'phone2', redact: true },
  AddrStateId: { field: 'addrProvinceId' },
  EducationLevelId: { field: 'educationLevelCode' },
  JobTypeId: { field: 'jobTypeCode' },
};

export const HWY_MEMBER_HISTORY_COLUMN_MARKS: Record<string, EdgeColumnHistory> = {
  firstname: track(),
  lastname: track(),
  fathername: track(),
  grandfathername: track(),
  greatGrandfatherName: track(),
  motherFirstName: track(),
  motherFatherName: track(),
  motherGrandfatherName: track(),
  nickname: track(),
  birthYear: track(),
  birthMonth: track(),
  birthDay: track(),
  genderCode: track(),
  phone1: trackRedact(),
  phone2: trackRedact(),
  email: trackRedact(),
  facebookId: track(),
  twitterId: track(),
  tiktokId: track(),
  addrProvinceId: track(),
  addrDistrictId: track(),
  addrSubdistrictId: track(),
  addrQuarterName: track(),
  addrQuarterNo: track(),
  addrAlleyNo: track(),
  addrHouseNo: track(),
  addrNearestLandmark: track(),
  addrMostImportantPlace: track(),
  addrMaktabId: track(),
  addrRegionId: track(),
  addrCircleId: track(),
  educationLevelCode: track(),
  educationLevelInCode: track(),
  educationEntryYear: track(),
  educationEndYear: track(),
  educationBranch: track(),
  educationSchool: track(),
  educationUniversityCode: track(),
  educationUniversityFacultyCode: track(),
  jobTypeCode: track(),
  jobPlace: track(),
  membership_status_code: track(),
};

for (const key of HWY_MEMBER_DIRECTORY_PATCH_FIELD_KEYS) {
  if (!HWY_MEMBER_HISTORY_COLUMN_MARKS[key]) {
    HWY_MEMBER_HISTORY_COLUMN_MARKS[key] = track();
  }
}

export type HwyMemberHistorySnapshot = Record<string, string | null>;

const readTrimmed = (value: unknown): string | null => {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
};

/** Map a `hwy_members` row (snake_case DB) to camelCase history snapshot keys. */
export function hwyMemberRowToHistorySnapshot(row: Record<string, unknown>): HwyMemberHistorySnapshot {
  return {
    firstname: readTrimmed(row.first_name),
    lastname: readTrimmed(row.family_name),
    fathername: readTrimmed(row.father_name),
    grandfathername: readTrimmed(row.grandfather_name),
    greatGrandfatherName: readTrimmed(row.great_grandfather_name),
    motherFirstName: readTrimmed(row.mother_first_name),
    motherFatherName: readTrimmed(row.mother_father_name),
    motherGrandfatherName: readTrimmed(row.mother_grandfather_name),
    nickname: readTrimmed(row.nickname),
    birthYear: readTrimmed(row.birth_year),
    birthMonth: readTrimmed(row.birth_month),
    birthDay: readTrimmed(row.birth_day),
    genderCode: readTrimmed(row.gender_code),
    phone1: readTrimmed(row.phone1),
    phone2: readTrimmed(row.phone2),
    email: readTrimmed(row.email),
    facebookId: readTrimmed(row.facebook_id),
    twitterId: readTrimmed(row.twitter_id),
    tiktokId: readTrimmed(row.tiktok_id),
    addrProvinceId: readTrimmed(row.addr_province_id),
    addrDistrictId: row.addr_district_id != null ? String(row.addr_district_id) : null,
    addrSubdistrictId: row.addr_subdistrict_id != null ? String(row.addr_subdistrict_id) : null,
    addrQuarterName: readTrimmed(row.addr_quarter_name),
    addrQuarterNo: readTrimmed(row.addr_quarter_no),
    addrAlleyNo: readTrimmed(row.addr_alley_no),
    addrHouseNo: readTrimmed(row.addr_house_no),
    addrNearestLandmark: readTrimmed(row.addr_nearest_landmark),
    addrMostImportantPlace: readTrimmed(row.addr_most_important_place),
    addrMaktabId: readTrimmed(row.addr_maktab_id),
    addrRegionId: readTrimmed(row.addr_region_id),
    addrCircleId: readTrimmed(row.addr_circle_id),
    educationLevelCode: readTrimmed(row.education_level_code),
    educationLevelInCode: readTrimmed(row.education_level_in_code),
    educationEntryYear: readTrimmed(row.education_entry_year),
    educationEndYear: readTrimmed(row.education_end_year),
    educationBranch: readTrimmed(row.education_branch),
    educationSchool: readTrimmed(row.education_school),
    educationUniversityCode: readTrimmed(row.education_university_code),
    educationUniversityFacultyCode: readTrimmed(row.education_university_faculty_code),
    jobTypeCode: readTrimmed(row.job_type_code),
    jobPlace: readTrimmed(row.job_place),
    membership_status_code: readTrimmed(row.membership_status_code),
  };
}

export const HWY_MEMBER_HISTORY_SNAPSHOT_SQL = `
  first_name, family_name, father_name, grandfather_name,
  great_grandfather_name, mother_first_name, mother_father_name, mother_grandfather_name,
  nickname, birth_year, birth_month, birth_day, gender_code,
  phone1, phone2, email, facebook_id, twitter_id, tiktok_id,
  addr_province_id, addr_district_id, addr_subdistrict_id,
  addr_quarter_name, addr_quarter_no, addr_alley_no, addr_house_no,
  addr_nearest_landmark, addr_most_important_place,
  addr_maktab_id, addr_region_id, addr_circle_id,
  education_level_code, education_level_in_code, education_entry_year, education_end_year,
  education_branch, education_school, education_university_code, education_university_faculty_code,
  job_type_code, job_place, membership_status_code
`;
