const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isValidEmail = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return EMAIL_PATTERN.test(trimmed);
};

export const validateMembershipForm = (input: {
  email: string;
  password: string;
}): string | null => {
  const email = input.email.trim();
  const password = input.password;

  if (!email || !password.trim()) {
    return 'users.validation.emailPasswordRequired';
  }
  if (!isValidEmail(email)) {
    return 'users.validation.emailInvalid';
  }
  if (password.length < 8) {
    return 'users.validation.passwordMinLength';
  }
  return null;
};
