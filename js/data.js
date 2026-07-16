// data.js — questions.enc fetch → 복호 → 인덱스
import { unlockWithCache, unlockWithPassphrase } from './crypto.js';

let _buf = null;      // 원본 암호문 (복호 재시도용)
let _payload = null;  // { version, counts, questions:[...] }
let _byId = new Map();
let _byDomain = new Map();

export async function fetchBundle() {
  if (_buf) return _buf;
  const res = await fetch('data/questions.enc', { cache: 'no-store' });
  if (!res.ok) throw new Error('FETCH_FAILED');
  _buf = await res.arrayBuffer();
  return _buf;
}

function index(payload) {
  _payload = payload;
  _byId = new Map(); _byDomain = new Map();
  for (const q of payload.questions) {
    _byId.set(q.id, q);
    if (!_byDomain.has(q.domain)) _byDomain.set(q.domain, []);
    _byDomain.get(q.domain).push(q);
  }
}

// 캐시 키로 자동 복호 시도 (성공 시 true)
export async function tryAutoUnlock() {
  await fetchBundle();
  const p = await unlockWithCache(_buf);
  if (p) { index(p); return true; }
  return false;
}
// 패스프레이즈로 복호 (실패 시 throw)
export async function unlock(passphrase) {
  await fetchBundle();
  const p = await unlockWithPassphrase(_buf, passphrase);
  index(p);
  return true;
}

// 개념(RM) 번들 — 같은 salt/키를 쓰므로 캐시 키로 자동 복호(지연 로드)
let _concepts = null;
export async function loadConcepts() {
  if (_concepts) return _concepts;
  const res = await fetch('data/concepts.enc', { cache: 'no-store' });
  if (!res.ok) throw new Error('NO_CONCEPTS');
  const buf = await res.arrayBuffer();
  const p = await unlockWithCache(buf);
  if (!p) throw new Error('LOCKED');
  _concepts = p;
  return _concepts;
}
export const concepts = () => _concepts;

export const isLoaded = () => !!_payload;
export const meta = () => ({ version: _payload?.version, counts: _payload?.counts || {}, builtDomains: _payload?.builtDomains || [] });
export const allQuestions = () => _payload?.questions || [];
export const byId = (id) => _byId.get(id);
export const byDomain = (d) => _byDomain.get(d) || [];
export const domainCount = (d) => (_byDomain.get(d) || []).length;
