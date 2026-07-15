// store.js — localStorage (진도·세션·설정). 키 프리픽스 cisaprep.v1
const P = 'cisaprep.v1.';
const get = (k, d) => { try { const v = localStorage.getItem(P + k); return v ? JSON.parse(v) : d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); return true; } catch { return false; } };
const del = (k) => localStorage.removeItem(P + k);

// 문항 이력: { [id]: { a: 시도, c: 정답, last: 'w'|'r', at: ms, flag: bool } }
export const getHistory = () => get('history', {});
export function recordAnswer(id, correct) {
  const h = getHistory();
  const e = h[id] || { a: 0, c: 0, last: null, at: 0, flag: false };
  e.a += 1; if (correct) e.c += 1;
  e.last = correct ? 'r' : 'w'; e.at = Date.now();
  h[id] = e; set('history', h);
  return e;
}
export function toggleFlag(id) {
  const h = getHistory(); const e = h[id] || { a: 0, c: 0, last: null, at: 0, flag: false };
  e.flag = !e.flag; h[id] = e; set('history', h); return e.flag;
}

// 진행 중 세션
export const getSession = (kind) => get('session.' + kind, null);
export const saveSession = (kind, s) => set('session.' + kind, s);
export const clearSession = (kind) => del('session.' + kind);

// 설정
export const getSettings = () => get('settings', { theme: 'auto' });
export const saveSettings = (s) => set('settings', s);

export function resetAll() {
  Object.keys(localStorage).filter((k) => k.startsWith(P)).forEach((k) => localStorage.removeItem(k));
}
