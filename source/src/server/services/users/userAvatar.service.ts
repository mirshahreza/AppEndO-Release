import { createHash } from 'node:crypto';
import { getUserProfileAvatarXs } from '../../domain/users/userProfileRepository';
import { HttpError } from '../../errors/HttpError';

export async function getUserAvatarXs(userId: number) {
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new HttpError(400, 'Valid user id is required.');
  }

  const avatar = await getUserProfileAvatarXs(userId);
  if (!avatar) {
    throw new HttpError(404, 'Avatar not found.');
  }

  const body = Buffer.isBuffer(avatar.body) ? avatar.body : Buffer.from(avatar.body);
  const etag = `"${createHash('sha256').update(body).digest('hex').slice(0, 16)}"`;

  return {
    body,
    mime: avatar.mime || 'image/jpeg',
    etag,
  };
}
