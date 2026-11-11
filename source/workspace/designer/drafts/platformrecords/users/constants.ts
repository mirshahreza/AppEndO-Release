import type { EditUserForm, NewUserForm } from './types';

export {
  DEFAULT_GRID_PAGE_SIZE as DEFAULT_PAGE_SIZE,
  GRID_PAGE_SIZES as PAGE_SIZES,
} from '@/src/shared/lib/gridPagingConstants';

export const DEFAULT_AVAILABLE_ROLES = ['ADMIN', 'USER', 'DEVELOPER'];

export const SORT_OPTIONS = [
  { value: 'created_at', label: 'Created' },
  { value: 'email', label: 'Email' },
  { value: 'full_name', label: 'Profile' },
] as const;

export const USER_SORT_FIELDS = SORT_OPTIONS.map((option) => option.value);

export const EMPTY_FORM: NewUserForm = {
  username: '',
  email: '',
  password: '',
  roles: ['USER'],
  firstName: '',
  lastName: '',
  fatherName: '',
  grandfatherName: '',
  nickname: '',
  nationalCode: '',
  birthYear: '',
  birthMonth: '',
  birthDay: '',
  genderCode: '',
  personTypeCode: '',
  profileImageBody: null,
  profileImageBodyXs: null,
  profileImageMime: null,
};

export const EMPTY_EDIT_FORM: EditUserForm = {
  email: '',
  phone: '',
  roles: ['USER'],
  firstName: '',
  lastName: '',
  fatherName: '',
  grandfatherName: '',
  nickname: '',
  nationalCode: '',
  birthYear: '',
  birthMonth: '',
  birthDay: '',
  genderCode: '',
  personTypeCode: '',
  profileImageBody: null,
  profileImageBodyXs: null,
  profileImageMime: null,
  profileImageRemoved: false,
};

export const ACTION_BUTTON_BASE_CLASS =
  'h-5 w-5 inline-flex items-center justify-center rounded-sm transition-colors cursor-pointer disabled:opacity-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-transparent';

export { CREATE_EDIT_MODAL_BODY_CLASS } from '@/src/shared/ui/surfaceClasses';
