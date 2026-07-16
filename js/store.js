// store.js — localStorage (진도·세션·설정·활동). 키 프리픽스 cisaprep.v1
const P = 'cisaprep.v1.';
const get = (k, d) => { try { const v = localStorage.getItem(P + k); return v ? JSON.parse(v) : d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); return true; } catch { return false; } };
const del = (k) => localStorage.removeItem(P + k);
const today = () => new Date().toISOString().slice(0, 10);

// 문항 이력: { [id]: { a: 시도, c: 정답, last: 'w'|'r', at: ms, flag: bool } }
export const getHistory = () => get('history', {});
export function recordAnswer(id, correct) {
  const h = getHistory();
  const e = h[id] || { a: 0, c: 0, last: null, at: 0, flag: false };
  e.a += 1; if (correct) e.c += 1;
  e.last = correct ? 'r' : 'w'; e.at = Date.now();
  h[id] = e; set('history', h);
  const act = getActivity(); act[today()] = (act[today()] || 0) + 1; set('activity', act);
  return e;
}
export function toggleFlag(id) {
  const h = getHistory(); const e = h[id] || { a: 0, c: 0, last: null, at: 0, flag: false };
  e.flag = !e.flag; h[id] = e; set('history', h); return e.flag;
}
export const getActivity = () => get('activity', {}); // { 'YYYY-MM-DD': 푼 문항수 }

// 진행 중 세션
export const getSession = (kind) => get('session.' + kind, null);
export const saveSession = (kind, s) => set('session.' + kind, s);
export const clearSession = (kind) => del('session.' + kind);

// 설정
export const getSettings = () => ({ theme: 'auto', setSize: 10, examDate: '', ...get('settings', {}) });
export const saveSettings = (s) => set('settings', s);
export const patchSettings = (patch) => { const s = getSettings(); saveSettings({ ...s, ...patch }); };

// 내보내기/가져오기 (기기 변경 대비)
export function exportData() {
  const out = {};
  Object.keys(localStorage).filter((k) => k.startsWith(P) && !k.includes('keycache')).forEach((k) => { out[k] = localStorage.getItem(k); });
  return { _app: 'cisa-prep', _v: 1, _at: new Date().toISOString(), data: out };
}
export function importData(obj) {
  if (!obj || obj._app !== 'cisa-prep' || !obj.data) throw new Error('형식이 올바르지 않습니다');
  Object.entries(obj.data).forEach(([k, v]) => { if (k.startsWith(P)) localStorage.setItem(k, v); });
}
export function resetAll() {
  Object.keys(localStorage).filter((k) => k.startsWith(P)).forEach((k) => localStorage.removeItem(k));
}
