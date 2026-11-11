import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useOptionalCulture } from '@/core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '@/core/culture/cultureShellKeys';
import {
  type UserRecord,
  applyUsersListProfileImagePatch,
  useChangePasswordMutation,
  useCreateUserMutation,
  useDeleteUserMutation,
  useResetPasswordMutation,
  useSetUserLockedMutation,
  useUpdateUserProfileMutation,
  useUpdateUserRolesMutation,
} from '@/shared/api/queries/users';
import {
  buildAttributeValuesPayload,
  fetchUserAttributes,
  useUpdateUserAttributesMutation,
} from '@/shared/api/queries/attributeValues';
import { EMPTY_FORM } from '../constants';
import { ensureRoles, userHasAdminRole, userHasRestrictedActions } from '../utils';
import { validateMembershipForm } from '../userFormValidation';
import type { UsersModalsState } from './useUsersModals';

type UseUsersMutationsInput = UsersModalsState & {
  isAdmin: boolean;
  loginAs: (userId: number) => Promise<boolean>;
};

export function useUsersMutations(input: UseUsersMutationsInput) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const culture = useOptionalCulture();
  const toastText = (key: string) => (
    culture?.ready ? culture.t(key) : CULTURE_ACTION_FALLBACK_LABELS[key] ?? key
  );

  const {
    isAdmin,
    loginAs,
    showToast,
    form,
    setForm,
    setShowCreateModal,
    setFormError,
    editingUser,
    editForm,
    attributeValues,
    cancelEdit,
    setEditError,
    changePasswordUser,
    setChangePasswordUser,
    newPassword,
    setNewPassword,
    setConfirmPassword,
    confirmPassword,
    setChangePasswordError,
    resetPasswordUser,
    setResetPasswordUser,
    setResetError,
    deleteUser,
    setDeleteUser,
    lockConfirmUser,
    setLockConfirmUser,
    setIsLoggingInAs,
    openEditProfile,
    openEditRoles,
    openEditAttributes,
  } = input;

  const createUserMutation = useCreateUserMutation();
  const updateUserProfileMutation = useUpdateUserProfileMutation();
  const updateUserRolesMutation = useUpdateUserRolesMutation();
  const updateUserAttributesMutation = useUpdateUserAttributesMutation();
  const changePasswordMutation = useChangePasswordMutation();
  const resetPasswordMutation = useResetPasswordMutation();
  const deleteUserMutation = useDeleteUserMutation();
  const setUserLockedMutation = useSetUserLockedMutation();

  const handleCreate = async () => {
    const membershipError = validateMembershipForm(form);
    if (membershipError) {
      setFormError(toastText(membershipError));
      return;
    }

    setFormError(null);
    try {
      const { data, response } = await createUserMutation.mutateAsync({
        email: form.email.trim(),
        password: form.password,
        roles: ensureRoles(form.roles),
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        fatherName: form.fatherName.trim() || undefined,
        grandfatherName: form.grandfatherName.trim() || undefined,
        nickname: form.nickname.trim() || undefined,
        nationalCode: form.nationalCode.trim() || undefined,
        birthYear: form.birthYear.trim() || undefined,
        birthMonth: form.birthMonth.trim() || undefined,
        birthDay: form.birthDay.trim() || undefined,
        genderCode: form.genderCode || undefined,
        personTypeCode: form.personTypeCode || undefined,
        profileImageBody: form.profileImageBody || undefined,
        profileImageBodyXs: form.profileImageBodyXs || undefined,
        profileImageMime: form.profileImageMime || undefined,
      });
      if (data.success) {
        setForm(EMPTY_FORM);
        setShowCreateModal(false);
        showToast('success', toastText('feedback.userCreated'));
      } else {
        setFormError(
          (typeof data.error === 'string' ? data.error : undefined)
            ?? (response.status === 413 ? 'Uploaded image is too large.' : 'Failed to create user.'),
        );
      }
    } catch {
      setFormError('Network error.');
    }
  };

  const saveUserProfile = async () => {
    if (!editingUser) return;

    setEditError(null);
    try {
      const profileImagePayload = editForm.profileImageRemoved
        ? {
            profileImageBody: null,
            profileImageBodyXs: null,
            profileImageMime: null,
          }
        : editForm.profileImageBody
          ? {
              profileImageBody: editForm.profileImageBody,
              profileImageBodyXs: editForm.profileImageBodyXs ?? undefined,
              profileImageMime: editForm.profileImageMime ?? undefined,
            }
          : {};

      const { data, response } = await updateUserProfileMutation.mutateAsync({
        userId: editingUser.id,
        payload: {
          firstName: editForm.firstName.trim() || undefined,
          lastName: editForm.lastName.trim() || undefined,
          fatherName: editForm.fatherName.trim() || undefined,
          grandfatherName: editForm.grandfatherName.trim() || undefined,
          nickname: editForm.nickname.trim() || undefined,
          nationalCode: editForm.nationalCode.trim() || undefined,
          birthYear: editForm.birthYear.trim() || undefined,
          birthMonth: editForm.birthMonth.trim() || undefined,
          birthDay: editForm.birthDay.trim() || undefined,
          genderCode: editForm.genderCode || undefined,
          personTypeCode: editForm.personTypeCode || undefined,
          ...profileImagePayload,
        },
      });
      if (data.success) {
        if (editForm.profileImageRemoved || editForm.profileImageBody) {
          applyUsersListProfileImagePatch(
            queryClient,
            editingUser.id,
            profileImagePayload,
            data.profile,
          );
        }
        cancelEdit();
        showToast('success', toastText('feedback.profileUpdated'));
      } else {
        setEditError(
          (typeof data.error === 'string' ? data.error : undefined)
            ?? (response.status === 413 ? 'Uploaded image is too large.' : 'Failed to update profile.'),
        );
      }
    } catch {
      setEditError('Network error.');
    }
  };

  const saveUserRoles = async () => {
    if (!editingUser) return;

    setEditError(null);
    try {
      const { data } = await updateUserRolesMutation.mutateAsync({
        userId: editingUser.id,
        payload: { roles: ensureRoles(editForm.roles) },
      });
      if (data.success) {
        cancelEdit();
        showToast('success', toastText('feedback.rolesUpdated'));
      } else {
        setEditError(typeof data.error === 'string' ? data.error : 'Failed to update roles.');
      }
    } catch {
      setEditError('Network error.');
    }
  };

  const saveUserAttributes = async () => {
    if (!editingUser) return;

    setEditError(null);
    try {
      const userId = Number(editingUser.id);
      const attributesData = await fetchUserAttributes(userId);
      const { data } = await updateUserAttributesMutation.mutateAsync({
        userId,
        payload: buildAttributeValuesPayload(attributesData.items, attributeValues),
      });
      if (data.success) {
        cancelEdit();
        showToast('success', toastText('feedback.attributesUpdated'));
      } else {
        setEditError(typeof data.error === 'string' ? data.error : 'Failed to update attributes.');
      }
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Network error.');
    }
  };

  const submitChangePassword = async () => {
    if (!changePasswordUser) return;
    if (newPassword.length < 8) {
      setChangePasswordError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePasswordError('Passwords do not match.');
      return;
    }

    setChangePasswordError(null);
    try {
      const { data } = await changePasswordMutation.mutateAsync({
        userId: changePasswordUser.id,
        payload: { newPassword },
      });
      if (data.success) {
        setChangePasswordUser(null);
        setNewPassword('');
        setConfirmPassword('');
        showToast('success', toastText('feedback.passwordChanged'));
      } else {
        setChangePasswordError(typeof data.error === 'string' ? data.error : 'Failed to change password.');
      }
    } catch {
      setChangePasswordError('Network error.');
    }
  };

  const submitResetPassword = async () => {
    if (!resetPasswordUser) return;

    setResetError(null);
    try {
      const { data } = await resetPasswordMutation.mutateAsync(resetPasswordUser.id);
      if (data.success) {
        setResetPasswordUser(null);
        showToast('success', 'Password reset initiated. New random password was generated and sent by system.');
      } else {
        setResetError(typeof data.error === 'string' ? data.error : 'Failed to reset password.');
      }
    } catch {
      setResetError('Network error.');
    }
  };

  const handleLoginAs = async (user: UserRecord) => {
    if (!isAdmin || userHasAdminRole(user)) return;
    setIsLoggingInAs(user.id);
    try {
      const ok = await loginAs(user.id);
      if (ok) {
        showToast('success', `Logged in as ${user.email}.`);
        navigate('/');
      } else {
        showToast('error', 'Login as failed.');
      }
    } finally {
      setIsLoggingInAs(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteUser) return;

    if (userHasRestrictedActions(deleteUser)) {
      setDeleteUser(null);
      showToast('error', userHasAdminRole(deleteUser) ? 'ADMIN users cannot be deleted.' : 'Built-in users cannot be deleted.');
      return;
    }

    const userId = deleteUser.id;
    try {
      const { data } = await deleteUserMutation.mutateAsync(userId);
      if (!data.success) {
        showToast('error', typeof data.error === 'string' ? data.error : 'Could not delete user.');
        return;
      }
      setDeleteUser(null);
      showToast('success', toastText('feedback.userDeleted'));
    } catch {
      showToast('error', toastText('feedback.networkError'));
    }
  };

  const handleToggleLocked = (user: UserRecord) => {
    if (userHasRestrictedActions(user)) return;
    setLockConfirmUser(user);
  };

  const confirmToggleLocked = async () => {
    if (!lockConfirmUser || userHasRestrictedActions(lockConfirmUser)) return;

    const nextLocked = !lockConfirmUser.locked;
    try {
      const { data } = await setUserLockedMutation.mutateAsync({
        userId: lockConfirmUser.id,
        locked: nextLocked,
      });
      if (data.success) {
        setLockConfirmUser(null);
        showToast('success', nextLocked ? toastText('feedback.userLocked') : toastText('feedback.userUnlocked'));
      } else {
        showToast('error', typeof data.error === 'string' ? data.error : 'Could not update locked state.');
      }
    } catch {
      showToast('error', toastText('feedback.networkError'));
    }
  };

  const isEditSaving =
    updateUserProfileMutation.isPending
    || updateUserRolesMutation.isPending
    || updateUserAttributesMutation.isPending;

  return {
    handleCreate,
    createUserMutation,
    saveUserProfile,
    saveUserRoles,
    saveUserAttributes,
    isEditSaving,
    submitChangePassword,
    changePasswordMutation,
    submitResetPassword,
    resetPasswordMutation,
    confirmDelete,
    handleToggleLocked,
    confirmToggleLocked,
    setUserLockedMutation,
    handleLoginAs,
    openEditProfile,
    openEditRoles,
    openEditAttributes,
    setDeleteUser: wrapRequestDelete(setDeleteUser),
    deleteUserMutation,
  };
}

function wrapRequestDelete(
  setDeleteUser: (user: UserRecord | null) => void,
): (user: UserRecord | null) => void {
  return (user) => {
    if (user == null) {
      setDeleteUser(null);
      return;
    }
    if (userHasRestrictedActions(user)) return;
    setDeleteUser(user);
  };
}
