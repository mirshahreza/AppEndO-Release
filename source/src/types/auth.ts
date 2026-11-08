export interface AuthSession {
  jti: string;
  userId: number;
  createdAt: string;
  createdBy?: number | null;
  expiresAt: number;
  revokedAt: string | null;
  updatedAt?: string | null;
  updatedBy?: number | null;
  replacedByJti: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  isCurrent: boolean;
}

export interface AuthAuditLog {
  id: number;
  userId: number | null;
  email: string | null;
  eventType: string;
  success: boolean;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
  createdBy?: number | null;
  updatedAt?: string | null;
  updatedBy?: number | null;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}
