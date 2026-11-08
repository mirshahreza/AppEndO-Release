import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  profileQueryKeys,
  useChangeMyPasswordMutation,
  useDeleteMyAccountMutation,
} from '../shared/api/queries/profile';
import { isPasswordStrong } from '../shared/lib/passwordStrength';

export function useProfileAccount() {
  const queryClient = useQueryClient();
  const changeMyPasswordMutation = useChangeMyPasswordMutation();
  const deleteMyAccountMutation = useDeleteMyAccountMutation();

  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [isActiveSessionsOpen, setIsActiveSessionsOpen] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openMore = () => setIsMoreOpen(true);
  const closeMore = () => setIsMoreOpen(false);

  const openChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setChangePasswordError(null);
    setIsChangePasswordOpen(true);
  };
  const closeChangePassword = () => {
    setIsChangePasswordOpen(false);
    setChangePasswordError(null);
  };

  const openDeleteAccount = () => {
    setDeletePassword('');
    setDeleteAcknowledged(false);
    setDeleteError(null);
    setIsDeleteAccountOpen(true);
  };
  const closeDeleteAccount = () => {
    setIsDeleteAccountOpen(false);
    setDeleteError(null);
  };

  const openActiveSessions = () => setIsActiveSessionsOpen(true);
  const closeActiveSessions = () => setIsActiveSessionsOpen(false);

  const submitChangePassword = async () => {
    if (!isPasswordStrong(newPassword)) {
      setChangePasswordError('Password must meet all strength requirements.');
      return { success: false as const, requiresLogout: false as const };
    }
    if (newPassword !== confirmPassword) {
      setChangePasswordError('Passwords do not match.');
      return { success: false as const, requiresLogout: false as const };
    }

    setChangePasswordError(null);
    try {
      const { data } = await changeMyPasswordMutation.mutateAsync({
        currentPassword,
        newPassword,
      });

      if (data.success) {
        closeChangePassword();
        return { success: true as const, requiresLogout: true as const };
      }

      setChangePasswordError(typeof data.error === 'string' ? data.error : 'Failed to change password.');
      return { success: false as const, requiresLogout: false as const };
    } catch {
      setChangePasswordError('Network error.');
      return { success: false as const, requiresLogout: false as const };
    }
  };

  const submitDeleteAccount = async () => {
    if (!deleteAcknowledged) {
      setDeleteError('Please confirm that you understand the consequences.');
      return { success: false as const, requiresLogout: false as const };
    }
    if (!deletePassword) {
      setDeleteError('Password is required to delete your account.');
      return { success: false as const, requiresLogout: false as const };
    }

    setDeleteError(null);
    try {
      const { data } = await deleteMyAccountMutation.mutateAsync({ password: deletePassword });

      if (data.success) {
        void queryClient.removeQueries({ queryKey: profileQueryKeys.all });
        closeDeleteAccount();
        return { success: true as const, requiresLogout: true as const };
      }

      setDeleteError(typeof data.error === 'string' ? data.error : 'Failed to delete account.');
      return { success: false as const, requiresLogout: false as const };
    } catch {
      setDeleteError('Network error.');
      return { success: false as const, requiresLogout: false as const };
    }
  };

  return {
    isMoreOpen,
    isChangePasswordOpen,
    isDeleteAccountOpen,
    isActiveSessionsOpen,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    changePasswordError,
    deletePassword,
    setDeletePassword,
    deleteAcknowledged,
    setDeleteAcknowledged,
    deleteError,
    openMore,
    closeMore,
    openChangePassword,
    closeChangePassword,
    openDeleteAccount,
    closeDeleteAccount,
    openActiveSessions,
    closeActiveSessions,
    submitChangePassword,
    submitDeleteAccount,
    isChangingPassword: changeMyPasswordMutation.isPending,
    isDeletingAccount: deleteMyAccountMutation.isPending,
  };
}
