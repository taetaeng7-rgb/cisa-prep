// router.js — 해시 라우터 (#/study/3 등)
const routes = [];
export function route(pattern, handler) {
  const keys = [];
  const re = new RegExp('^#' + pattern.replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return '([^/?]+)'; }) + '/?(?:\\?(.*))?$');
  routes.push({ re, keys, handler });
}
export function resolve() {
  const hash = location.hash || '#/';
  for (const r of routes) {
    const m = hash.match(r.re);
    if (m) {
      const params = {}; r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      const query = {}; if (m[r.keys.length + 1]) new URLSearchParams(m[r.keys.length + 1]).forEach((v, k) => (query[k] = v));
      return r.handler(params, query);
    }
  }
  location.hash = '#/';
}
export const go = (h) => { location.hash = h; };
export function start() { window.addEventListener('hashchange', resolve); resolve(); }
