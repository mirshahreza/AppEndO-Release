import path from 'node:path';
import { createRequire } from 'node:module';
import {
  RDP_HUB_DEFAULT_DISPLAY_HEIGHT,
  RDP_HUB_DEFAULT_DISPLAY_WIDTH,
  parseRdpHubDisplaySize,
} from '../../../shared/api/contracts/rdp-hub/validation';
import { resolveRemoteHubLibraryPath } from '../remote-hubs/requireRemoteHubLibrary';
import { resolveCredentialMasterKey } from '../../domain/security/credentialVault/credentialCrypto';
import { getRdpHubConnection } from './rdpHubStore';

type GuacamoleLiteCrypt = new (
  cipher: string,
  key: Buffer,
) => {
  encrypt: (json: object) => string;
  decrypt: (token: string) => unknown;
};

function loadGuacamoleLiteCrypt(): GuacamoleLiteCrypt {
  const guacamoleLitePath = resolveRemoteHubLibraryPath('guacamole-lite');
  return createRequire(guacamoleLitePath)('./lib/Crypt.js') as GuacamoleLiteCrypt;
}

export const RDP_HUB_TICKET_TTL_MS = 90_000;
export const GUACAMOLE_LITE_CIPHER = 'AES-256-CBC';

export type RdpHubGuacamoleTicketClaims = {
  connection: {
    type: 'rdp';
    settings: Record<string, unknown>;
  };
  connectionId: string;
  expiration: number;
  userId: number;
};

export function encryptGuacamoleLiteToken(
  payload: object,
  key: Buffer = resolveCredentialMasterKey(),
): string {
  return new (loadGuacamoleLiteCrypt())(GUACAMOLE_LITE_CIPHER, key).encrypt(payload);
}

export function decryptGuacamoleLiteToken(
  token: string,
  key: Buffer = resolveCredentialMasterKey(),
): unknown {
  return new (loadGuacamoleLiteCrypt())(GUACAMOLE_LITE_CIPHER, key).decrypt(token);
}

export function createRdpHubSessionTicket(
  connectionId: string,
  userId: number,
  display?: { width?: unknown; height?: unknown },
): { token: string; expiresAt: string } | null {
  const connection = getRdpHubConnection(connectionId);
  if (!connection) {
    return null;
  }

  const width = parseRdpHubDisplaySize(display?.width, RDP_HUB_DEFAULT_DISPLAY_WIDTH);
  const height = parseRdpHubDisplaySize(display?.height, RDP_HUB_DEFAULT_DISPLAY_HEIGHT);
  const expiration = Date.now() + RDP_HUB_TICKET_TTL_MS;
  const claims: RdpHubGuacamoleTicketClaims = {
    connection: {
      type: 'rdp',
      settings: {
        width,
        height,
        dpi: 96,
      },
    },
    connectionId: connection.id,
    expiration,
    userId,
  };

  return {
    token: encryptGuacamoleLiteToken(claims),
    expiresAt: new Date(expiration).toISOString(),
  };
}
