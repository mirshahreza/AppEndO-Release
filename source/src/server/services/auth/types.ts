export type AuthUser = {
  id: number;
  email: string;
  role: string;
  roles: string[];
};

export type AuthAuditEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_AS'
  | 'LOGIN_FAILED'
  | 'LOGIN_BLOCKED'
  | 'LOGIN_RATE_LIMITED'
  | 'REFRESH_SUCCESS'
  | 'REFRESH_FAILED'
  | 'LOGOUT'
  | 'CHANGE_PASSWORD'
  | 'SESSION_REVOKE'
  | 'SESSION_REVOKE_ALL'
  | 'DELETE_ACCOUNT'
  | 'REGISTER_SUCCESS'
  | 'REGISTER_FAILED'
  | 'FORGOT_PASSWORD'
  | 'RESET_PASSWORD'
  | 'OTP_SENT'
  | 'OTP_VERIFIED'
  | 'OTP_FAILED'
  | 'EMAIL_VERIFIED'
  | 'OAUTH_LOGIN_SUCCESS'
  | 'OAUTH_LOGIN_FAILED'
  | 'OAUTH_LINK_DENIED'
  | 'IMPERSONATE_START'
  | 'IMPERSONATE_END';

export type SessionCookies = {
  accessToken: string;
  refreshToken: string;
};
