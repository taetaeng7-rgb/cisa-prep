// crypto.js — questions.enc 복호 (encrypt.mjs와 포맷 호환)
// 포맷: MAGIC(8 "CISAENC1") | ver(1) | saltLen(1) | salt | ivLen(1) | iv | ct(+GCM tag)
const PBKDF2_ITER = 600000;
const CACHE_KEY = 'cisaprep.v1.keycache';

const toHex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function parseBundle(buf) {
  const u8 = new Uint8Array(buf);
  const magic = new TextDecoder().decode(u8.slice(0, 8));
  if (magic !== 'CISAENC1') throw new Error('BAD_FORMAT');
  let o = 8;
  const ver = u8[o++];
  const saltLen = u8[o++];
  const salt = u8.slice(o, o + saltLen); o += saltLen;
  const ivLen = u8[o++];
  const iv = u8.slice(o, o + ivLen); o += ivLen;
  const ct = u8.slice(o);
  return { ver, salt, iv, ct, saltHex: toHex(salt) };
}

async function deriveKey(passphrase, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']
  );
}

async function decryptWithKey(key, parsed) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: parsed.iv }, key, parsed.ct);
  return JSON.parse(new TextDecoder().decode(pt));
}

// 패스프레이즈로 언록 → 성공 시 파생 키를 캐시(다음 실행 무입력)
export async function unlockWithPassphrase(buf, passphrase) {
  const parsed = parseBundle(buf);
  const key = await deriveKey(passphrase, parsed.salt);
  const payload = await decryptWithKey(key, parsed); // 실패 시 throw
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  localStorage.setItem(CACHE_KEY, JSON.stringify({ saltHex: parsed.saltHex, key: b64(raw) }));
  return payload;
}

// 캐시된 키로 언록 (없거나 salt 불일치·실패 시 null)
export async function unlockWithCache(buf) {
  const parsed = parseBundle(buf);
  const cached = localStorage.getItem(CACHE_KEY);
  if (!cached) return null;
  try {
    const { saltHex, key } = JSON.parse(cached);
    if (saltHex !== parsed.saltHex) return null;
    const ck = await crypto.subtle.importKey('raw', unb64(key), { name: 'AES-GCM' }, false, ['decrypt']);
    return await decryptWithKey(ck, parsed);
  } catch { return null; }
}

export function clearKeyCache() { localStorage.removeItem(CACHE_KEY); }
