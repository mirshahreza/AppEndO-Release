import type { ServerFunctionItem } from './types';
import { normalizeFunctionForEditor } from './templates';

export const BUILTIN_DEVELOPER_ACCESS_CONTROL = {
  accessMode: 'specific' as const,
  allowRoles: ['DEVELOPER'],
  allowUsers: [],
  denyRoles: [],
  denyUsers: [],
};

const BUILTIN_ADMIN_DEVELOPER_ACCESS_CONTROL = {
  accessMode: 'specific' as const,
  allowRoles: ['ADMIN', 'DEVELOPER'],
  allowUsers: [],
  denyRoles: [],
  denyUsers: [],
};

const BUILTIN_ADMIN_ACCESS_CONTROL = {
  accessMode: 'specific' as const,
  allowRoles: ['ADMIN'],
  allowUsers: [],
  denyRoles: [],
  denyUsers: [],
};

export const BUILTIN_AUTHENTICATED_ACCESS_CONTROL = {
  accessMode: 'authenticated' as const,
  allowRoles: [],
  allowUsers: [],
  denyRoles: [],
  denyUsers: [],
};

export const BUILTIN_PUBLIC_ACCESS_CONTROL = {
  accessMode: 'public' as const,
  allowRoles: [],
  allowUsers: [],
  denyRoles: [],
  denyUsers: [],
};

export const INITIAL_FUNCTIONS: ServerFunctionItem[] = [
  {
    id: 'fn-auth-login',
    name: 'login',
    folder: 'auth',
    method: 'POST',
    path: '/api/auth/login',
    code: `// POST /api/auth/login
async function handler() {
  const payload = req.body || {};
  if (!payload.email || !payload.password) {
    return res.status(400).json({ success: false, error: "email and password are required" });
  }

  const result = await db.query("SELECT * FROM base_users WHERE email = ? LIMIT 1", [payload.email]);
  const user = result?.[0] || null;
  if (!user) {
    return res.status(401).json({ success: false, error: "Invalid credentials" });
  }
  if (user.locked) {
    return res.status(403).json({ success: false, error: "Account is locked" });
  }
  return res.json({ success: true, user });
}

handler();`,
    testPayload: `{\n  "email": "admin@append.os",\n  "password": "admin123"\n}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    cacheEnabled: false,
    cacheTtlMs: 3600000,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-auth-loginas',
    name: 'loginas',
    folder: 'auth',
    method: 'POST',
    path: '/api/auth/loginas/:id',
    code: `// POST /api/auth/loginas/:id
// Admin impersonation: issues a session for the target user without password check.
// Production traffic is handled by the native auth route with JWT + refresh cookies.
async function handler() {
  const actorRoles = Array.isArray(req.auth?.roles) ? req.auth.roles : [];
  const actorRole = String(req.auth?.role || '').toUpperCase();
  const normalizedRoles = actorRoles.map((r) => String(r).toUpperCase());
  const canLoginAs = actorRole === 'ADMIN' || normalizedRoles.includes('ADMIN');
  if (!canLoginAs) {
    return res.status(403).json({ success: false, error: 'Forbidden. Admin role required.' });
  }

  const targetUserId = Number(req.params?.id || req.body?.userId || 0);
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ success: false, error: 'Valid target user id is required.' });
  }

  const users = await db.query(
    "SELECT u.id, u.email, u.username, u.locked, " +
    "COALESCE(array_agg(ur.role_name ORDER BY ur.role_name) FILTER (WHERE ur.role_name IS NOT NULL), ARRAY[]::TEXT[]) AS roles " +
    "FROM base_users u " +
    "LEFT JOIN base_user_roles ur ON ur.user_id = u.id " +
    "WHERE u.id = ? " +
    "GROUP BY u.id, u.email, u.username, u.locked",
    [targetUserId]
  );
  const targetUser = users?.[0] || null;
  if (!targetUser) {
    return res.status(404).json({ success: false, error: 'Target user not found.' });
  }

  return res.json({
    success: true,
    impersonation: true,
    actorUserId: req.auth?.userId || null,
    user: targetUser,
  });
}

handler();`,
    testPayload: `{\n  "params": {\n    "id": 100000\n  }\n}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    cacheEnabled: false,
    cacheTtlMs: 3600000,
    isBuiltIn: true,
    accessControl: BUILTIN_ADMIN_ACCESS_CONTROL
  },
  {
    id: 'fn-profile-get',
    name: 'get-profile',
    folder: 'profile',
    method: 'GET',
    path: '/api/profile',
    code: `// GET /api/profile
async function handler() {
  const userId = Number(req.query?.userId || 1);
  const result = await db.query(
    "SELECT u.id, u.email, " +
    "COALESCE(array_agg(ur.role_name ORDER BY ur.role_name) FILTER (WHERE ur.role_name IS NOT NULL), ARRAY[]::TEXT[]) AS roles " +
    "FROM base_users u " +
    "LEFT JOIN base_user_roles ur ON ur.user_id = u.id " +
    "WHERE u.id = ? " +
    "GROUP BY u.id, u.email",
    [userId]
  );
  return res.json({ success: true, profile: result?.[0] || null });
}

handler();`,
    testPayload: `{
  "query": {
    "userId": 1
  }
}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-profile-save',
    name: 'save-profile',
    folder: 'profile',
    method: 'PUT',
    path: '/api/profile',
    code: `// PUT /api/profile
async function handler() {
  const payload = req.body || {};
  if (!payload.userId) {
    return res.status(400).json({ success: false, error: "userId is required" });
  }

  await db.query("UPDATE base_user_profiles SET firstname = ?, lastname = ?, phone = ? WHERE user_id = ?", [
    payload.firstName || null,
    payload.lastName || null,
    payload.phone || null,
    payload.userId
  ]);

  return res.json({ success: true });
}

handler();`,
    testPayload: `{\n  "userId": 1,\n  "firstName": "Admin",\n  "lastName": "User",\n  "phone": "+989120000000"\n}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-profile-update-my-account',
    name: 'update-my-account',
    folder: 'profile',
    method: 'PUT',
    path: '/api/profile/me',
    code: `// PUT /api/profile/me
// Self-service account update. Target user is always derived from req.auth.userId.
async function handler() {
  const actorUserId = Number(req.auth?.userId || 0);
  if (!actorUserId) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const payload = req.body || {};
  if (Object.prototype.hasOwnProperty.call(payload, 'email') && !String(payload.email || '').trim()) {
    return res.status(400).json({ success: false, error: 'email is required.' });
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'email')) {
    await db.query('UPDATE base_users SET email = ? WHERE id = ?', [String(payload.email).trim(), actorUserId]);
  }

  await db.query(
    'UPDATE base_user_profiles SET firstname = ?, lastname = ?, fathername = ?, grandfathername = ?, phone = ?, nickname = ?, national_code = ?, birth_year = ?, birth_month = ?, birth_day = ?, gender_code = ?, person_type_code = ?, updated_by = ? WHERE user_id = ?',
    [
      payload.firstName || payload.firstname || null,
      payload.lastName || payload.lastname || null,
      payload.fatherName || payload.fathername || null,
      payload.grandfatherName || payload.grandfathername || null,
      payload.phone || null,
      payload.nickname || null,
      payload.nationalCode || payload.national_code || null,
      payload.birthYear || payload.birth_year || null,
      payload.birthMonth || payload.birth_month || null,
      payload.birthDay || payload.birth_day || null,
      payload.genderCode || payload.gender_code || null,
      payload.personTypeCode || payload.person_type_code || null,
      actorUserId,
      actorUserId,
    ],
  );

  return res.json({ success: true });
}

handler();`,
    testPayload: `{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+989120000000"
}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_AUTHENTICATED_ACCESS_CONTROL
  },
  {
    id: 'fn-auth-change-my-password',
    name: 'change-my-password',
    folder: 'auth',
    method: 'POST',
    path: '/api/auth/change-password',
    code: `// POST /api/auth/change-password
// Self-service password change. Target user is always derived from req.auth.userId.
async function handler() {
  const actorUserId = Number(req.auth?.userId || 0);
  if (!actorUserId) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const payload = req.body || {};
  if (!payload.currentPassword || !payload.newPassword) {
    return res.status(400).json({ success: false, error: 'currentPassword and newPassword are required.' });
  }
  if (String(payload.newPassword).length < 8) {
    return res.status(400).json({ success: false, error: 'New password must be at least 8 characters.' });
  }

  const users = await db.query('SELECT id, password_hash FROM base_users WHERE id = ? LIMIT 1', [actorUserId]);
  const user = users?.[0] || null;
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  return res.json({ success: true, message: 'Password changed successfully. Please login again.' });
}

handler();`,
    testPayload: `{
  "currentPassword": "old-password",
  "newPassword": "new-password-123"
}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_AUTHENTICATED_ACCESS_CONTROL
  },
  {
    id: 'fn-auth-delete-account',
    name: 'delete-my-account',
    folder: 'auth',
    method: 'DELETE',
    path: '/api/auth/account',
    code: `// DELETE /api/auth/account
// Self-service account deletion. Target user is always derived from req.auth.userId.
async function handler() {
  const actorUserId = Number(req.auth?.userId || 0);
  if (!actorUserId) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const payload = req.body || {};
  if (!payload.password) {
    return res.status(400).json({ success: false, error: 'password is required.' });
  }

  const users = await db.query('SELECT id, is_builtin FROM base_users WHERE id = ? LIMIT 1', [actorUserId]);
  const user = users?.[0] || null;
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }
  if (user.is_builtin) {
    return res.status(400).json({ success: false, error: 'Built-in accounts cannot be deleted.' });
  }

  const roleRows = await db.query('SELECT role_name FROM base_user_roles WHERE user_id = ?', [actorUserId]);
  const roleNames = (roleRows || []).map((row) => String(row.role_name || '').trim().toUpperCase());
  if (roleNames.some((name) => name === 'ADMIN' || name === 'DEVELOPER')) {
    return res.status(400).json({ success: false, error: 'Accounts with ADMIN or DEVELOPER roles cannot be deleted.' });
  }

  await db.query('DELETE FROM base_user_profiles WHERE user_id = ?', [actorUserId]);
  await db.query('DELETE FROM base_users WHERE id = ?', [actorUserId]);

  return res.json({ success: true, message: 'Your account and all associated data have been permanently deleted.' });
}

handler();`,
    testPayload: `{
  "password": "current-password"
}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_AUTHENTICATED_ACCESS_CONTROL
  },
  {
    id: 'fn-users-list',
    name: 'list-users',
    folder: 'users',
    method: 'GET',
    path: '/api/users',
    code: `// GET /api/users
async function handler() {
  const users = await db.query(
    "SELECT u.id, u.email, u.created_at, " +
    "COALESCE(array_agg(ur.role_name ORDER BY ur.role_name) FILTER (WHERE ur.role_name IS NOT NULL), ARRAY[]::TEXT[]) AS roles " +
    "FROM base_users u " +
    "LEFT JOIN base_user_roles ur ON ur.user_id = u.id " +
    "GROUP BY u.id, u.email, u.created_at " +
    "ORDER BY u.id DESC"
  );
  return res.json({ success: true, items: users || [] });
}

handler();`,
    testPayload: `{}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-users-create',
    name: 'create-user',
    folder: 'users',
    method: 'POST',
    path: '/api/users',
    code: `// POST /api/users
async function handler() {
  const payload = req.body || {};
  if (!payload.email || !payload.password) {
    return res.status(400).json({ success: false, error: "email and password are required" });
  }
  const username = (payload.username || payload.email.split('@')[0] || '').trim().toLowerCase();
  const result = await db.query(
    "INSERT INTO base_users (username, email, password_hash) VALUES (?, ?, ?) RETURNING id, email",
    [username, payload.email, payload.password]
  );
  const created = result?.[0] || null;
  if (created?.id) {
    await db.query("INSERT INTO base_user_roles (user_id, role_name) VALUES (?, ?)", [created.id, payload.role || 'DEVELOPER']);
  }
  return res.status(201).json({ success: true, user: created });
}

handler();`,
    testPayload: `{\n  "email": "newuser@example.com",\n  "password": "secret123",\n  "role": "DEVELOPER"\n}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-users-update',
    name: 'update-user',
    folder: 'users',
    method: 'PUT',
    path: '/api/users/:id',
    code: `// PUT /api/users/:id
async function handler() {
  const userId = Number(req.params?.id);
  const payload = req.body || {};
  if (!userId) {
    return res.status(400).json({ success: false, error: "user id is required" });
  }
  if (payload.email) {
    await db.query("UPDATE base_users SET email = ? WHERE id = ?", [payload.email, userId]);
  }
  if (payload.role) {
    await db.query("DELETE FROM base_user_roles WHERE user_id = ?", [userId]);
    await db.query("INSERT INTO base_user_roles (user_id, role_name) VALUES (?, ?)", [userId, payload.role]);
  }
  return res.json({ success: true });
}

handler();`,
    testPayload: `{\n  "params": { "id": 2 },\n  "email": "updated@example.com",\n  "role": "ADMIN"\n}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-users-update-profile',
    name: 'update-user-profile',
    folder: 'users',
    method: 'PUT',
    path: '/api/users/:id/profile',
    code: `// PUT /api/users/:id/profile
async function handler() {
  const userId = Number(req.params?.id);
  const payload = req.body || {};
  if (!userId) {
    return res.status(400).json({ success: false, error: "user id is required" });
  }
  await db.query(
    "UPDATE base_user_profiles SET firstname = ?, lastname = ?, nickname = ?, gender_code = ? WHERE user_id = ?",
    [payload.firstName || null, payload.lastName || null, payload.nickname || null, payload.genderCode || null, userId]
  );
  return res.json({ success: true });
}

handler();`,
    testPayload: `{
  "params": { "id": 2 },
  "body": { "firstName": "Updated", "lastName": "Profile", "nickname": "U2", "genderCode": "100001" }
}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-users-update-roles',
    name: 'update-user-roles',
    folder: 'users',
    method: 'PUT',
    path: '/api/users/:id/roles',
    code: `// PUT /api/users/:id/roles
async function handler() {
  const userId = Number(req.params?.id);
  const payload = req.body || {};
  const roles = Array.isArray(payload.roles) ? payload.roles : [];
  if (!userId) {
    return res.status(400).json({ success: false, error: "user id is required" });
  }
  await db.query("DELETE FROM base_user_roles WHERE user_id = ?", [userId]);
  for (const roleName of roles) {
    await db.query("INSERT INTO base_user_roles (user_id, role_name) VALUES (?, ?)", [userId, String(roleName)]);
  }
  return res.json({ success: true });
}

handler();`,
    testPayload: `{
  "params": { "id": 2 },
  "body": { "roles": ["DEVELOPER", "ADMIN"] }
}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-users-delete',
    name: 'delete-user',
    folder: 'users',
    method: 'DELETE',
    path: '/api/users/:id',
    code: `// DELETE /api/users/:id
async function handler() {
  const userId = Number(req.params?.id);
  if (!userId) {
    return res.status(400).json({ success: false, error: "user id is required" });
  }
  if (userId === 1) {
    return res.status(403).json({ success: false, error: "default admin user cannot be deleted" });
  }
  await db.query("DELETE FROM base_users WHERE id = ?", [userId]);
  return res.json({ success: true });
}

handler();`,
    testPayload: `{\n  "params": { "id": 2 }\n}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-roles-list',
    name: 'list-roles',
    folder: 'roles',
    method: 'GET',
    path: '/api/roles',
    code: `// GET /api/roles
async function handler() {
  const roles = await db.query(
    "SELECT r.id, r.name, r.note, r.created_at, r.created_by, " +
    "creator.username AS created_by_username, r.updated_at, r.updated_by, " +
    "updater.username AS updated_by_username " +
    "FROM base_roles r " +
    "LEFT JOIN base_users creator ON creator.id = r.created_by " +
    "LEFT JOIN base_users updater ON updater.id = r.updated_by " +
    "ORDER BY r.name ASC"
  );
  return res.json({ success: true, items: roles || [] });
}

handler();`,
    testPayload: `{}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-roles-create',
    name: 'create-role',
    folder: 'roles',
    method: 'POST',
    path: '/api/roles',
    code: `// POST /api/roles
async function handler() {
  const payload = req.body || {};
  if (!payload.name) {
    return res.status(400).json({ success: false, error: "name is required" });
  }
  const result = await db.query(
    "INSERT INTO base_roles (name, note) VALUES (?, ?) RETURNING id, name, note",
    [payload.name.toUpperCase(), payload.note || null]
  );
  return res.status(201).json({ success: true, role: result?.[0] || null });
}

handler();`,
    testPayload: `{\n  "name": "MODERATOR",\n  "note": "Content moderator role"\n}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-roles-update',
    name: 'update-role',
    folder: 'roles',
    method: 'PUT',
    path: '/api/roles/:id',
    code: `// PUT /api/roles/:id
async function handler() {
  const roleId = Number(req.params?.id);
  const payload = req.body || {};
  if (!roleId) {
    return res.status(400).json({ success: false, error: "role id is required" });
  }
  await db.query(
    "UPDATE base_roles SET note = ? WHERE id = ?",
    [payload.note || null, roleId]
  );
  return res.json({ success: true });
}

handler();`,
    testPayload: `{\n  "params": { "id": 3 },\n  "note": "Updated note"\n}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-roles-delete',
    name: 'delete-role',
    folder: 'roles',
    method: 'DELETE',
    path: '/api/roles/:id',
    code: `// DELETE /api/roles/:id
async function handler() {
  const roleId = Number(req.params?.id);
  if (!roleId) {
    return res.status(400).json({ success: false, error: "role id is required" });
  }
  const role = await db.query("SELECT name FROM base_roles WHERE id = ?", [roleId]);
  if (!role?.[0]) {
    return res.status(404).json({ success: false, error: "role not found" });
  }
  if (role[0].name === 'ADMIN' || role[0].name === 'DEVELOPER') {
    return res.status(403).json({ success: false, error: "base roles ADMIN and DEVELOPER cannot be deleted" });
  }
  await db.query("DELETE FROM base_roles WHERE id = ?", [roleId]);
  return res.json({ success: true });
}

handler();`,
    testPayload: `{\n  "params": { "id": 3 }\n}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-functions-list',
    name: 'list-functions',
    folder: 'functions',
    method: 'GET',
    path: '/api/functions',
    code: `// GET /api/functions
const fs = require("fs");
const path = require("path");

async function handler() {
  const customDir = path.join(process.cwd(), "workspace/server-functions/custom");
  if (!fs.existsSync(customDir)) {
    return res.json({ success: true, items: [] });
  }
  const items = fs.readdirSync(customDir)
    .filter((name) => name.endsWith(".metadata.json"))
    .map((name) => {
      const raw = JSON.parse(fs.readFileSync(path.join(customDir, name), "utf8"));
      return { id: raw.id, name: raw.name, method: raw.method, path: raw.path, folder: raw.folder };
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return res.json({ success: true, items });
}

handler();`,
    testPayload: `{}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-functions-create',
    name: 'create-function',
    folder: 'functions',
    method: 'POST',
    path: '/api/functions',
    code: `// POST /api/functions
const fs = require("fs");
const path = require("path");

function sanitizeSegment(value) {
  return String(value || "unnamed").trim().toLowerCase()
    .replace(/\\s+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "") || "unnamed";
}

function buildBaseName(folder, name) {
  return \`\${sanitizeSegment(folder)}.\${sanitizeSegment(name)}\`;
}

async function handler() {
  const payload = req.body || {};
  if (!payload.name || !payload.folder || !payload.method || !payload.path || !payload.code) {
    return res.status(400).json({ success: false, error: "name, folder, method, path, and code are required" });
  }
  const customDir = path.join(process.cwd(), "workspace/server-functions/custom");
  fs.mkdirSync(customDir, { recursive: true });
  const id = buildBaseName(payload.folder, payload.name);
  const language = payload.language === "js" ? "js" : "ts";
  const sourceFile = \`\${id}.\${language}\`;
  const metadataFile = \`\${id}.metadata.json\`;
  const now = new Date().toISOString();
  const metadata = {
    schema: "append-server-function-metadata",
    schemaVersion: "2.0.0",
    id,
    name: payload.name,
    folder: payload.folder,
    method: String(payload.method).toUpperCase(),
    path: payload.path,
    sourceFile,
    language,
    testPayload: payload.testPayload || "{}",
    runtimeVersion: payload.runtimeVersion || "v20.x",
    memoryLimit: payload.memoryLimit ?? 128,
    timeoutMs: payload.timeoutMs ?? 1500,
    cacheEnabled: Boolean(payload.cacheEnabled),
    cacheTtlMs: payload.cacheTtlMs ?? 180000,
    cacheByParam: Boolean(payload.cacheByParam),
    cacheByUser: Boolean(payload.cacheByUser),
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    updatedBy: null,
  };
  fs.writeFileSync(path.join(customDir, sourceFile), payload.code, "utf8");
  fs.writeFileSync(path.join(customDir, metadataFile), JSON.stringify(metadata, null, 2), "utf8");
  return res.status(201).json({ success: true, id });
}

handler();`,
    testPayload: `{\n  "name": "my-fn",\n  "folder": "custom",\n  "method": "GET",\n  "path": "/api/custom/my-fn",\n  "code": "res.json({ ok: true });"\n}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-functions-update',
    name: 'update-function',
    folder: 'functions',
    method: 'PUT',
    path: '/api/functions/:id',
    code: `// PUT /api/functions/:id
const fs = require("fs");
const path = require("path");

function findMetadataPath(customDir, fnId) {
  for (const name of fs.readdirSync(customDir)) {
    if (!name.endsWith(".metadata.json")) continue;
    const metadataPath = path.join(customDir, name);
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    if (metadata.id === fnId) return metadataPath;
  }
  return null;
}

async function handler() {
  const fnId = req.params?.id;
  const payload = req.body || {};
  if (!fnId) {
    return res.status(400).json({ success: false, error: "function id is required" });
  }
  const customDir = path.join(process.cwd(), "workspace/server-functions/custom");
  const metadataPath = findMetadataPath(customDir, fnId);
  if (!metadataPath) {
    return res.status(404).json({ success: false, error: "Function not found." });
  }
  const existing = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  const sourcePath = path.join(customDir, existing.sourceFile);
  if (payload.code !== undefined) {
    fs.writeFileSync(sourcePath, payload.code, "utf8");
  }
  const updated = {
    ...existing,
    name: payload.name ?? existing.name,
    folder: payload.folder ?? existing.folder,
    method: payload.method ? String(payload.method).toUpperCase() : existing.method,
    path: payload.path ?? existing.path,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(metadataPath, JSON.stringify(updated, null, 2), "utf8");
  return res.json({ success: true });
}

handler();`,
    testPayload: `{\n  "params": { "id": "fn-abc123" },\n  "name": "updated-fn",\n  "code": "res.json({ updated: true });"\n}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-functions-delete',
    name: 'delete-function',
    folder: 'functions',
    method: 'DELETE',
    path: '/api/functions/:id',
    code: `// DELETE /api/functions/:id
const fs = require("fs");
const path = require("path");

function findMetadataPath(customDir, fnId) {
  for (const name of fs.readdirSync(customDir)) {
    if (!name.endsWith(".metadata.json")) continue;
    const metadataPath = path.join(customDir, name);
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    if (metadata.id === fnId) return { metadataPath, metadata };
  }
  return null;
}

async function handler() {
  const fnId = req.params?.id;
  if (!fnId) {
    return res.status(400).json({ success: false, error: "function id is required" });
  }
  const customDir = path.join(process.cwd(), "workspace/server-functions/custom");
  const match = findMetadataPath(customDir, fnId);
  if (!match) {
    return res.status(404).json({ success: false, error: "Function not found." });
  }
  fs.unlinkSync(match.metadataPath);
  const sourcePath = path.join(customDir, match.metadata.sourceFile);
  if (fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath);
  return res.json({ success: true });
}

handler();`,
    testPayload: `{\n  "params": { "id": "fn-abc123" }\n}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-plugins-list',
    name: 'list-plugins',
    folder: 'plugins',
    method: 'GET',
    path: '/api/plugins',
    code: `// GET /api/plugins
const fs = require("fs");
const path = require("path");

async function handler() {
  const settingsPath = path.join(process.cwd(), "settings.json");
  const settings = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath, "utf8"))
    : {};
  const items = Array.isArray(settings.plugins) ? settings.plugins : [];
  return res.json({ success: true, items });
}

handler();`,
    testPayload: `{}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-plugins-create',
    name: 'create-package',
    folder: 'plugins',
    method: 'POST',
    path: '/api/plugins',
    code: `// POST /api/plugins
const fs = require("fs");
const path = require("path");

async function handler() {
  const payload = req.body || {};
  if (!payload.name || !payload.zipFileName) {
    return res.status(400).json({ success: false, error: "name and zipFileName are required" });
  }
  if (!payload.zipFileName.toLowerCase().endsWith('.zip')) {
    return res.status(400).json({ success: false, error: "zipFileName must end with .zip" });
  }

  const settingsPath = path.join(process.cwd(), "settings.json");
  const settings = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath, "utf8"))
    : {};

  const items = Array.isArray(settings.plugins) ? settings.plugins : [];
  const id = \`package-\${Math.random().toString(36).slice(2, 10)}\`;

  items.unshift({
    id,
    name: payload.name,
    zip_file_name: payload.zipFileName,
    created_at: new Date().toISOString()
  });

  settings.plugins = items;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  return res.status(201).json({ success: true, id });
}

handler();`,
    testPayload: `{\n  "name": "My Package",\n  "zipFileName": "my-package-v1.0.zip"\n}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-plugins-delete',
    name: 'delete-package',
    folder: 'plugins',
    method: 'DELETE',
    path: '/api/packages/:id',
    code: `// DELETE /api/packages/:id
const fs = require("fs");
const path = require("path");

async function handler() {
  const packageId = req.params?.id;
  if (!packageId) {
    return res.status(400).json({ success: false, error: "package id is required" });
  }

  const settingsPath = path.join(process.cwd(), "settings.json");
  const settings = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath, "utf8"))
    : {};

  const items = Array.isArray(settings.plugins) ? settings.plugins : [];
  const nextItems = items.filter((item) => item.id !== packageId);

  if (nextItems.length === items.length) {
    return res.status(404).json({ success: false, error: "package not found" });
  }

  settings.plugins = nextItems;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  return res.json({ success: true });
}

handler();`,
    testPayload: `{\n  "params": { "id": "package-abc123" }\n}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-cache-list',
    name: 'list-cache',
    folder: 'cache',
    method: 'GET',
    path: '/api/cache',
    code: `// GET /api/cache
async function handler() {
  // Runtime server uses CacheManager directly.
  // This built-in preview snippet avoids direct DB table access.
  return res.json({ success: true, message: "Cache list is served by CacheManager runtime endpoint." });
}

handler();`,
    testPayload: `{}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-cache-evict-key',
    name: 'evict-cache-key',
    folder: 'cache',
    method: 'DELETE',
    path: '/api/cache/:key',
    code: `// DELETE /api/cache/:key
async function handler() {
  const cacheKey = req.params?.key;
  if (!cacheKey) {
    return res.status(400).json({ success: false, error: "cache key is required" });
  }
  // Runtime server uses CacheManager directly.
  return res.json({ success: true, message: "Cache key eviction is handled by CacheManager runtime endpoint." });
}

handler();`,
    testPayload: `{\n  "params": { "key": "tenant_settings_corp_0" }\n}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-cache-evict-all',
    name: 'evict-all-cache',
    folder: 'cache',
    method: 'DELETE',
    path: '/api/cache',
    code: `// DELETE /api/cache
async function handler() {
  // Runtime server uses CacheManager directly.
  return res.json({ success: true, message: "Cache flush is handled by CacheManager runtime endpoint." });
}

handler();`,
    testPayload: `{}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-settings-get',
    name: 'get-settings',
    folder: 'settings',
    method: 'GET',
    path: '/api/settings',
    code: `// GET /api/settings
async function handler() {
  // Settings are stored in settings.json on the server filesystem
  return res.json({ success: true, message: "Use the System Config page to read settings." });
}

handler();`,
    testPayload: `{}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  },
  {
    id: 'fn-settings-save',
    name: 'save-settings',
    folder: 'settings',
    method: 'POST',
    path: '/api/settings',
    code: `// POST /api/settings
async function handler() {
  const payload = req.body || {};
  // Settings are persisted to settings.json on the server filesystem
  // Validated fields: serverFunctionVmMode, serverFunctionRamAllocation, serverFunctionTimeout, serverFunctionAutoLogging
  return res.json({ success: true, message: "Use the System Config page to save settings." });
}

handler();`,
    testPayload: `{\n  "serverFunctionVmMode": "v20.x",\n  "serverFunctionRamAllocation": 128,\n  "serverFunctionTimeout": 1500,\n  "serverFunctionAutoLogging": true\n}`,
    memoryLimit: 128,
    timeoutMs: 1500,
    runtimeVersion: 'v20.x',
    useGlobalConfig: true,
    enableLogs: true,
    isBuiltIn: true,
    accessControl: BUILTIN_DEVELOPER_ACCESS_CONTROL
  }
];

/** Normalized built-in catalog used while the API catalog query is loading or unavailable. */
export const FALLBACK_EDGE_FUNCTIONS: ServerFunctionItem[] = INITIAL_FUNCTIONS.map(normalizeFunctionForEditor);
