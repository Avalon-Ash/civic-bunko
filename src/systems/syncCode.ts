import { SYNC_CODE_PREFIX } from '../core/constants/sync';
import type { SyncCredentials } from '../core/types';

const INVALID_OWNER_REPO_RE = /[/\s]/;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
const CONTROL_WHITESPACE_RE = /[\r\n]/;

/** 將 UTF-8 字串編碼為標準 base64（不使用已棄用的 escape／unescape）。 */
export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** 將標準 base64（可含換行與空白）解碼為 UTF-8 字串。 */
export function base64ToUtf8(base64: string): string {
  const clean = base64.replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** 檢查並正規化同步憑證；缺欄位或 owner／repo 含斜線或空白時回傳 null。 */
export function validateSyncCredentials(
  owner: unknown,
  repo: unknown,
  token: unknown,
): SyncCredentials | null {
  if (!isNonEmptyString(owner) || !isNonEmptyString(repo) || !isNonEmptyString(token)) {
    return null;
  }
  if (INVALID_OWNER_REPO_RE.test(owner) || INVALID_OWNER_REPO_RE.test(repo)) {
    return null;
  }
  if (owner === '.' || owner === '..' || repo === '.' || repo === '..') {
    return null;
  }
  if (token.trim().length === 0 || CONTROL_WHITESPACE_RE.test(token)) {
    return null;
  }
  return { owner, repo, token };
}

/** 將同步憑證編碼為同步碼字串。 */
export function encodeSyncCode(cred: SyncCredentials): string {
  const json = JSON.stringify({
    o: cred.owner,
    r: cred.repo,
    t: cred.token,
  });
  const base64url = utf8ToBase64(json)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${SYNC_CODE_PREFIX}${base64url}`;
}

/** 解碼同步碼；去掉前後空白與換行，格式不符或欄位不合法時回傳 null。 */
export function decodeSyncCode(code: string): SyncCredentials | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith(SYNC_CODE_PREFIX)) {
    return null;
  }

  const encoded = trimmed.slice(SYNC_CODE_PREFIX.length);
  if (encoded.length === 0 || encoded.length % 4 === 1 || !BASE64URL_RE.test(encoded)) {
    return null;
  }

  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  let parsed: unknown;
  try {
    const json = base64ToUtf8(padded);
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  return validateSyncCredentials(record.o, record.r, record.t);
}
