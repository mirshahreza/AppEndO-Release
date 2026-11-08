import type { UserRecord } from '../../shared/api/queries/users';

export interface NewUserForm {
  username: string;
  email: string;
  password: string;
  roles: string[];
  firstName: string;
  lastName: string;
  fatherName: string;
  grandfatherName: string;
  nickname: string;
  nationalCode: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  genderCode: string;
  personTypeCode: string;
  companyName: string;
  registrationNumber: string;
  website: string;
  profileImageBody: string | null;
  profileImageBodyXs: string | null;
  profileImageMime: string | null;
}

export interface EditUserForm {
  email: string;
  phone: string;
  roles: string[];
  firstName: string;
  lastName: string;
  fatherName: string;
  grandfatherName: string;
  nickname: string;
  nationalCode: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  genderCode: string;
  personTypeCode: string;
  companyName: string;
  registrationNumber: string;
  website: string;
  profileImageBody: string | null;
  profileImageBodyXs: string | null;
  profileImageMime: string | null;
  /** True when the user explicitly removed the existing profile image in this edit session. */
  profileImageRemoved: boolean;
}

export interface ToastState {
  type: 'success' | 'error';
  text: string;
}

export type EditMode = 'profile' | 'roles' | 'attributes';

export type UserSortField = 'created_at' | 'email' | 'full_name';

export type UserTableActionHandlers = {
  onOpenEditProfile: (user: UserRecord) => void;
  onOpenEditRoles: (user: UserRecord) => void;
  onOpenEditAttributes: (user: UserRecord) => void;
  onEditFunctionAccess: (user: UserRecord) => void;
  onStartChangePassword: (user: UserRecord) => void;
  onStartResetPassword: (user: UserRecord) => void;
  onToggleLocked: (user: UserRecord) => void;
  onLoginAs: (user: UserRecord) => void;
  onRequestDelete: (user: UserRecord) => void;
  onOpenHistory: (user: UserRecord) => void;
};
