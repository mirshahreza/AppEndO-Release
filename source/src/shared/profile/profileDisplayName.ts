import { isCompanyPersonType } from './personType';

export const formatProfileDisplayName = (user: {
  person_type_code?: string | null;
  personTypeCode?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  company_name?: string | null;
  companyName?: string | null;
}): string | null => {
  const personTypeCode = user.person_type_code ?? user.personTypeCode ?? null;
  const companyName = (user.company_name ?? user.companyName)?.trim();
  if (isCompanyPersonType(personTypeCode) && companyName) {
    return companyName;
  }

  const parts = [user.firstname, user.lastname]
    .map((part) => part?.trim())
    .filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' ');
  }

  return companyName || null;
};
