import type { UserRecord } from '../../shared/api/queries/users';
import {
  USERS_PROFILE_CHANGE_REASON,
  type ChangeReasonDialogGate,
} from '../../shared/api/contracts/record-events';
import type { EditUserForm } from './types';

const PROFILE_FORM_BASELINE: Array<{
  form: keyof Pick<
    EditUserForm,
    | 'firstName'
    | 'lastName'
    | 'fatherName'
    | 'grandfatherName'
    | 'nickname'
    | 'nationalCode'
    | 'genderCode'
    | 'personTypeCode'
    | 'companyName'
    | 'registrationNumber'
    | 'website'
    | 'birthYear'
    | 'birthMonth'
    | 'birthDay'
  >;
  fromUser: (user: UserRecord) => string;
}> = [
  { form: 'firstName', fromUser: (user) => user.firstname ?? '' },
  { form: 'lastName', fromUser: (user) => user.lastname ?? '' },
  { form: 'fatherName', fromUser: (user) => user.fathername ?? '' },
  { form: 'grandfatherName', fromUser: (user) => user.grandfathername ?? '' },
  { form: 'nickname', fromUser: (user) => user.nickname ?? '' },
  { form: 'nationalCode', fromUser: (user) => user.national_code ?? '' },
  { form: 'genderCode', fromUser: (user) => user.gender_code ?? '' },
  { form: 'personTypeCode', fromUser: (user) => user.person_type_code ?? '' },
  { form: 'companyName', fromUser: (user) => user.company_name ?? '' },
  { form: 'registrationNumber', fromUser: (user) => user.registration_number ?? '' },
  { form: 'website', fromUser: (user) => user.website ?? '' },
  { form: 'birthYear', fromUser: (user) => user.birth_year ?? '' },
  { form: 'birthMonth', fromUser: (user) => user.birth_month ?? '' },
  { form: 'birthDay', fromUser: (user) => user.birth_day ?? '' },
];

const normalize = (value: string): string => value.trim();

export const listChangedUserProfileFormFields = (
  user: UserRecord,
  form: EditUserForm,
): string[] => (
  PROFILE_FORM_BASELINE
    .filter((row) => normalize(String(form[row.form] ?? '')) !== normalize(row.fromUser(user)))
    .map((row) => row.form)
);

const hasProfileImageChange = (form: EditUserForm): boolean => (
  Boolean(form.profileImageBody) || form.profileImageRemoved
);

const askToGate = (ask: 'off' | 'optional' | 'required' | undefined): ChangeReasonDialogGate => {
  if (ask === 'required') return 'required';
  if (ask === 'optional') return 'optional';
  return 'skip';
};

export const resolveUserProfileChangeReasonGate = (
  user: UserRecord,
  form: EditUserForm,
  ask: 'off' | 'optional' | 'required' | undefined = USERS_PROFILE_CHANGE_REASON.reasonAsk,
): ChangeReasonDialogGate => {
  const dirty = listChangedUserProfileFormFields(user, form).length > 0 || hasProfileImageChange(form);
  if (!dirty) return 'skip';
  return askToGate(ask);
};

export const roleSetsEqual = (left: readonly string[], right: readonly string[]): boolean => {
  const a = [...left].map((role) => role.toUpperCase()).sort();
  const b = [...right].map((role) => role.toUpperCase()).sort();
  return a.length === b.length && a.every((role, index) => role === b[index]);
};
