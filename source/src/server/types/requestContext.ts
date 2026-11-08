export type RequestDbContext = {
  headers: Record<string, unknown>;
  query: Record<string, unknown>;
  body: unknown;
};

export type AuthAuditContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type ActorContext = {
  userId: number;
  email?: string;
  role?: string;
  isAdmin: boolean;
};
