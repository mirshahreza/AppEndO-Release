import { useEffect, useState } from 'react';
import type { UserRecord } from '@/shared/api/queries/users';
import { EMPTY_EDIT_FORM, EMPTY_FORM } from '../constants';
import type { EditMode, EditUserForm, NewUserForm, ToastState } from '../types';
import { encodeProfileImageFieldFromFile } from '@/shared/lib/profileImageField';
import { ensureRoles, userHasRestrictedActions } from '../utils';

export function useUsersModals() {
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  const toggleCreateRole = (nextRole: string) => {
    setForm((prev) => {
      const normalizedRole = nextRole.toUpperCase();
      const hasRole = prev.roles.includes(normalizedRole);
      const nextRoles = hasRole
        ? prev.roles.filter((r) => r !== normalizedRole)
        : [...prev.roles, normalizedRole];

      return {
        ...prev,
        roles: ensureRoles(nextRoles),
      };
    });
  };

  const toggleEditRole = (nextRole: string) => {
    setEditForm((prev) => {
      const normalizedRole = nextRole.toUpperCase();
      const hasRole = prev.roles.includes(normalizedRole);
      const nextRoles = hasRole
        ? prev.roles.filter((r) => r !== normalizedRole)
        : [...prev.roles, normalizedRole];

      return {
        ...prev,
        roles: ensureRoles(nextRoles),
      };
    });
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
    if (userHasRestrictedActions(u)) return;

    setEditingUser(u);
    setEditMode(mode);
    setEditError(null);
    setEditForm({
      phone: '',
      firstName: u.firstname ?? '',
      lastName: u.lastname ?? '',
      fatherName: u.fathername ?? '',
      grandfatherName: u.grandfathername ?? '',
      roles: ensureRoles(u.roles),
      nickname: u.nickname ?? '',
      nationalCode: u.national_code ?? '',
      birthYear: u.birth_year ?? '',
      birthMonth: u.birth_month ?? '',
      birthDay: u.birth_day ?? '',
      genderCode: u.gender_code ?? '',
      personTypeCode: u.person_type_code ?? '',
      profileImageBody: null,
      profileImageBodyXs: null,
      profileImageMime: null,
      profileImageRemoved: false,
    });
  };

  const openEditProfile = (u: UserRecord) => openEditByMode(u, 'profile');
  const openEditRoles = (u: UserRecord) => openEditByMode(u, 'roles');
  const openEditAttributes = (u: UserRecord) => {
    if (userHasRestrictedActions(u)) return;
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

  const openCreateModal = () => {
    setShowCreateModal(true);
    setFormError(null);
    setForm(EMPTY_FORM);
  };

  const startChangePassword = (u: UserRecord) => {
    if (userHasRestrictedActions(u)) return;
    setChangePasswordUser(u);
    setNewPassword('');
    setConfirmPassword('');
    setChangePasswordError(null);
  };

  const startResetPassword = (u: UserRecord) => {
    if (userHasRestrictedActions(u)) return;
    setResetPasswordUser(u);
    setResetError(null);
  };

  return {
    toast,
    showToast,
    showCreateModal,
    setShowCreateModal,
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
    toggleCreateRole,
    toggleEditRole,
    onCreateImageSelected,
    onEditImageSelected,
    openCreateModal,
    openEditProfile,
    openEditRoles,
    openEditAttributes,
    cancelEdit,
    startChangePassword,
    startResetPassword,
  };
}

export type UsersModalsState = ReturnType<typeof useUsersModals>;
