import { useEffect, useState } from 'react';
import type { UserRecord } from '../../../shared/api/queries/users';
import { EMPTY_EDIT_FORM, EMPTY_FORM } from '../constants';
import { PERSON_TYPE_COMPANY, PERSON_TYPE_INDIVIDUAL } from '../../../shared/profile/personType';
import type { EditMode, EditUserForm, NewUserForm, ToastState } from '../types';
import { encodeProfileImageFieldFromFile } from '../../../shared/lib/profileImageField';
import { normalizeRoleSelection, setRoleInSelection } from '../utils';

export function useUsersModals() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPersonTypeCode, setCreatePersonTypeCode] = useState<string | null>(null);
  const [form, setForm] = useState<NewUserForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editMode, setEditMode] = useState<EditMode | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm>(EMPTY_EDIT_FORM);
  const [attributeValues, setAttributeValues] = useState<Record<number, unknown>>({});
  const [editError, setEditError] = useState<string | null>(null);

  const [changePasswordUser, setChangePasswordUser] = useState<UserRecord | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);

  const [resetPasswordUser, setResetPasswordUser] = useState<UserRecord | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const [deleteUser, setDeleteUser] = useState<UserRecord | null>(null);
  const [lockConfirmUser, setLockConfirmUser] = useState<UserRecord | null>(null);
  const [isLoggingInAs, setIsLoggingInAs] = useState<number | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (type: ToastState['type'], text: string) => setToast({ type, text });

  const setCreateRoleChecked = (role: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      roles: setRoleInSelection(prev.roles, role, checked),
    }));
  };

  const setEditRoleChecked = (role: string, checked: boolean) => {
    setEditForm((prev) => ({
      ...prev,
      roles: setRoleInSelection(prev.roles, role, checked),
    }));
  };

  const onCreateImageSelected = async (file?: File | null) => {
    if (!file) {
      setForm((prev) => ({ ...prev, profileImageBody: null, profileImageBodyXs: null, profileImageMime: null }));
      return;
    }
    const encoded = await encodeProfileImageFieldFromFile(file);
    setForm((prev) => ({
      ...prev,
      profileImageBody: encoded.profileImageBody ?? null,
      profileImageBodyXs: encoded.profileImageBodyXs ?? null,
      profileImageMime: encoded.profileImageMime ?? null,
    }));
  };

  const onEditImageSelected = async (file?: File | null) => {
    if (!file) {
      setEditForm((prev) => ({
        ...prev,
        profileImageBody: null,
        profileImageBodyXs: null,
        profileImageMime: null,
        profileImageRemoved: true,
      }));
      return;
    }
    const encoded = await encodeProfileImageFieldFromFile(file);
    setEditForm((prev) => ({
      ...prev,
      profileImageBody: encoded.profileImageBody ?? null,
      profileImageBodyXs: encoded.profileImageBodyXs ?? null,
      profileImageMime: encoded.profileImageMime ?? null,
      profileImageRemoved: false,
    }));
  };

  const openEditByMode = (u: UserRecord, mode: EditMode) => {

    setEditingUser(u);
    setEditMode(mode);
    setEditError(null);
    setEditForm({
      phone: '',
      firstName: u.firstname ?? '',
      lastName: u.lastname ?? '',
      fatherName: u.fathername ?? '',
      grandfatherName: u.grandfathername ?? '',
      roles: normalizeRoleSelection(u.roles),
      nickname: u.nickname ?? '',
      nationalCode: u.national_code ?? '',
      birthYear: u.birth_year ?? '',
      birthMonth: u.birth_month ?? '',
      birthDay: u.birth_day ?? '',
      genderCode: u.gender_code ?? '',
      personTypeCode: u.person_type_code ?? '',
      companyName: u.company_name ?? '',
      registrationNumber: u.registration_number ?? '',
      website: u.website ?? '',
      profileImageBody: null,
      profileImageBodyXs: null,
      profileImageMime: null,
      profileImageRemoved: false,
    });
  };

  const openEditProfile = (u: UserRecord) => openEditByMode(u, 'profile');
  const openEditRoles = (u: UserRecord) => openEditByMode(u, 'roles');
  const openEditAttributes = (u: UserRecord) => {
    setEditingUser(u);
    setEditMode('attributes');
    setEditError(null);
    setAttributeValues({});
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEditMode(null);
    setEditForm(EMPTY_EDIT_FORM);
    setAttributeValues({});
    setEditError(null);
  };

  const openCreateModal = (personTypeCode: string) => {
    setCreatePersonTypeCode(personTypeCode);
    setShowCreateModal(true);
    setFormError(null);
    setForm({
      ...EMPTY_FORM,
      personTypeCode,
    });
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreatePersonTypeCode(null);
  };

  const openCreateIndividualModal = () => openCreateModal(PERSON_TYPE_INDIVIDUAL);
  const openCreateCompanyModal = () => openCreateModal(PERSON_TYPE_COMPANY);

  const startChangePassword = (u: UserRecord) => {
    setChangePasswordUser(u);
    setNewPassword('');
    setConfirmPassword('');
    setChangePasswordError(null);
  };

  const startResetPassword = (u: UserRecord) => {
    setResetPasswordUser(u);
    setResetError(null);
  };

  return {
    openEditByMode,
    toast,
    showToast,
    showCreateModal,
    setShowCreateModal,
    createPersonTypeCode,
    closeCreateModal,
    form,
    setForm,
    formError,
    setFormError,
    editingUser,
    editMode,
    editForm,
    setEditForm,
    attributeValues,
    setAttributeValues,
    editError,
    setEditError,
    changePasswordUser,
    setChangePasswordUser,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    changePasswordError,
    setChangePasswordError,
    resetPasswordUser,
    setResetPasswordUser,
    resetError,
    setResetError,
    deleteUser,
    setDeleteUser,
    lockConfirmUser,
    setLockConfirmUser,
    isLoggingInAs,
    setIsLoggingInAs,
    setCreateRoleChecked,
    setEditRoleChecked,
    onCreateImageSelected,
    onEditImageSelected,
    openCreateModal,
    openCreateIndividualModal,
    openCreateCompanyModal,
    openEditProfile,
    openEditRoles,
    openEditAttributes,
    cancelEdit,
    startChangePassword,
    startResetPassword,
  };
}

export type UsersModalsState = ReturnType<typeof useUsersModals>;
