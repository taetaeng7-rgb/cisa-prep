// app.js — 컨트롤러: 언록 게이트 · 라우팅 · 세션 · 이벤트 위임
import * as data from './data.js';
import * as store from './store.js';
import * as E from './engine.js';
import * as S from './stats.js';
import * as V from './views.js';
import { route, resolve, go, start } from './router.js';
import { SET_SIZE, MINI_EXAM, WEIGHTS } from './config.js';
import { clearKeyCache } from './crypto.js';

const app = document.getElementById('app');
const mount = (html) => { app.innerHTML = html; window.scrollTo(0, 0); };
let run = null;      // 진행 중 학습/오답 러너 {kind,domain,pool,ids,orders,pos,chosen,correct}
let exam = null;     // 진행 중 모의 {ids,orders,answers,flags,pos,endMs,startedAt}
let timer = null;

// ---------- 테마 ----------
function applyTheme() {
  const t = store.getSettings().theme || 'auto';
  document.documentElement.dataset.theme = t;
}

// ---------- 언록 게이트 ----------
async function ensureLoaded(render) {
  if (data.isLoaded()) return render();
  try {
    if (await data.tryAutoUnlock()) return render();
  } catch (e) { return mount(V.errorScreen('데이터를 불러오지 못했습니다. 새로고침 해주세요.')); }
  mount(V.unlockScreen()); // 캐시 없음 → 패스프레이즈 요청
}

// ---------- 학습/오답 러너 ----------
function buildRunner(kind, pool, label, domain) {
  const rng = E.makeRng((Date.now() ^ (pool.length * 2654435761)) >>> 0);
  const size = store.getSettings().setSize || SET_SIZE;
  const picked = (kind === 'review' || kind === 'flagged') ? pool : E.pickQuestions(pool, size, store.getHistory(), rng);
  const orders = {}; picked.forEach((q) => (orders[q.id] = E.choiceOrder(q, rng)));
  run = { kind, domain, label, ids: picked.map((q) => q.id), orders, pos: 0, chosen: null, correct: 0, wrong: [] };
  store.saveSession('study', run);
  renderRunner();
}
function renderRunner() {
  const q = data.byId(run.ids[run.pos]);
  const flagged = store.getHistory()[q.id]?.flag;
  mount(V.questionCard({ q, order: run.orders[q.id], pos: run.pos, size: run.ids.length, chosen: run.chosen, flagged, label: run.label }));
}
function answer(disp) {
  if (run.chosen != null) return;
  run.chosen = disp;
  const q = data.byId(run.ids[run.pos]);
  const ok = E.isCorrect(q, run.orders[q.id], disp);
  store.recordAnswer(q.id, ok);
  if (ok) run.correct++; else run.wrong.push(q);
  store.saveSession('study', run);
  renderRunner();
}
function nextQuestion() {
  run.pos++; run.chosen = null;
  if (run.pos >= run.ids.length) {
    store.clearSession('study');
    const wrong = run.wrong.slice();
    const done = { correct: run.correct, size: run.ids.length, wrong };
    run = null;
    mount(V.setSummary(done));
  } else { store.saveSession('study', run); renderRunner(); }
}

// ---------- 모의 ----------
function buildExam() {
  const alloc = E.allocateByDomain(MINI_EXAM.count, WEIGHTS);
  const rng = E.makeRng((Date.now() ^ 0x9e3779b9) >>> 0);
  let ids = [], orders = {};
  for (let d = 1; d <= 5; d++) {
    const pool = data.byDomain(d);
    const picked = E.pickQuestions(pool, Math.min(alloc[d], pool.length), store.getHistory(), rng);
    picked.forEach((q) => { ids.push(q.id); orders[q.id] = E.choiceOrder(q, rng); });
  }
  ids = E.shuffle(ids, rng);
  const startedAt = Date.now();
  exam = { ids, orders, answers: {}, flags: {}, pos: 0, startedAt, endMs: startedAt + MINI_EXAM.minutes * 60000 };
  store.saveSession('exam', exam);
  startTimer();
  renderExam();
}
function renderExam() {
  const q = data.byId(exam.ids[exam.pos]);
  const remaining = Math.max(0, Math.round((exam.endMs - Date.now()) / 1000));
  const navStates = exam.ids.map((id, i) => (exam.flags[id] ? 'flag' : exam.answers[id] != null ? 'done' : 'todo') + (i === exam.pos ? ' cur' : ''));
  mount(V.examRun({ q, order: exam.orders[q.id], idx: exam.pos, total: exam.ids.length, chosen: exam.answers[q.id] ?? null, remaining, flagged: !!exam.flags[q.id], navStates }));
}
function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    if (!exam) return clearInterval(timer);
    if (Date.now() >= exam.endMs) { clearInterval(timer); return submitExam(); }
    const el = app.querySelector('.timer');
    if (el) { const r = Math.max(0, Math.round((exam.endMs - Date.now()) / 1000)); el.textContent = `⏱ ${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`; el.classList.toggle('warn', r < 300); }
  }, 1000);
}
function submitExam() {
  clearInterval(timer);
  const questions = exam.ids.map((id) => data.byId(id));
  const result = E.gradeExam(questions, exam.answers, exam.orders);
  questions.forEach((q) => { const disp = exam.answers[q.id]; if (disp != null) store.recordAnswer(q.id, E.isCorrect(q, exam.orders[q.id], disp)); });
  const elapsed = Math.round((Date.now() - exam.startedAt) / 1000);
  const reviewItems = questions.map((q) => ({ q, ok: exam.answers[q.id] != null && E.isCorrect(q, exam.orders[q.id], exam.answers[q.id]) }));
  store.clearSession('exam'); exam = null;
  mount(V.examResult({ result, elapsed, reviewItems }));
}

// ---------- 라우트 ----------
function ddayFrom(examDate) {
  if (!examDate) return null;
  const d = Math.ceil((new Date(examDate + 'T00:00:00') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')) / 86400000);
  return d;
}
route('/', () => ensureLoaded(() => {
  const qs = data.allQuestions(); const h = store.getHistory();
  const stats = S.domainStats(qs, h);
  const sd = store.getSession('study'), se = store.getSession('exam');
  let resume = null;
  if (sd) resume = { kind: 'study', label: `${sd.label} ${sd.pos + 1}/${sd.ids.length}` };
  else if (se) resume = { kind: 'exam', label: `모의 진행 중` };
  const ov = S.overall(qs, h);
  mount(V.homeScreen({
    counts: data.meta().counts, stats, resume,
    reviewCount: S.wrongList(qs, h).length, flaggedCount: S.flaggedList(qs, h).length,
    streak: S.streak(store.getActivity()), dday: ddayFrom(store.getSettings().examDate),
    total: ov.total, seen: ov.seen,
  }));
}));
route('/stats', () => ensureLoaded(() => {
  const qs = data.allQuestions(), h = store.getHistory();
  mount(V.statsScreen({ ov: S.overall(qs, h), dstats: S.domainStats(qs, h), weak: S.weakTopics(qs, h), streak: S.streak(store.getActivity()) }));
}));
route('/settings', () => mount(V.settingsScreen({ settings: store.getSettings() })));
route('/study/:domain', (p) => ensureLoaded(() => {
  const d = p.domain;
  const pool = d === 'all' ? data.allQuestions() : data.byDomain(Number(d));
  if (!pool.length) return go('#/');
  const label = d === 'all' ? '전체' : `D${d}`;
  buildRunner('study', pool, label, d);
}));
route('/review', () => ensureLoaded(() => {
  const items = S.wrongList(data.allQuestions(), store.getHistory());
  mount(V.reviewScreen({ items }));
}));
route('/exam', () => ensureLoaded(() => {
  const alloc = E.allocateByDomain(MINI_EXAM.count, WEIGHTS);
  const ready = [1, 2, 3, 4, 5].every((d) => data.byDomain(d).length >= alloc[d]);
  mount(V.examSetup({ ready, alloc }));
}));

// ---------- 이벤트 위임 ----------
app.addEventListener('change', (e) => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  if (el.dataset.action === 'set-examdate') { store.patchSettings({ examDate: el.value }); }
  else if (el.dataset.action === 'set-setsize') { store.patchSettings({ setSize: Number(el.value) }); }
  else if (el.dataset.action === 'import') {
    const file = el.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => { try { store.importData(JSON.parse(r.result)); alert('가져오기 완료'); go('#/'); resolve(); } catch (err) { alert('가져오기 실패: ' + err.message); } };
    r.readAsText(file);
  }
});
app.addEventListener('submit', async (e) => {
  if (e.target.closest('[data-action="unlock"]')) {
    e.preventDefault();
    const pass = e.target.pass.value;
    mount(V.unlockScreen('여는 중…'));
    try { await data.unlock(pass); resolve(); }
    catch { mount(V.unlockScreen('암호가 맞지 않습니다.')); }
  }
});
app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const a = el.dataset.action;
  switch (a) {
    case 'go': go(el.dataset.href); break;
    case 'reload': location.reload(); break;
    case 'toggle-theme': { const s = store.getSettings(); s.theme = s.theme === 'dark' ? 'light' : s.theme === 'light' ? 'auto' : 'dark'; store.saveSettings(s); applyTheme(); resolve(); break; }
    case 'start-study': buildRunner('study', data.byDomain(Number(el.dataset.domain)), `D${el.dataset.domain}`, el.dataset.domain); break;
    case 'answer': answer(Number(el.dataset.disp)); break;
    case 'next': nextQuestion(); break;
    case 'flag': { store.toggleFlag(el.dataset.id); renderRunner(); break; }
    case 'continue-study': if (run?.domain) buildRunner('study', data.byDomain(Number(run.domain)), `D${run.domain}`, run.domain); else go('#/'); break;
    case 'resume-study': run = store.getSession('study'); if (run) renderRunner(); else go('#/'); break;
    case 'resume-exam': exam = store.getSession('exam'); if (exam) { startTimer(); renderExam(); } else go('#/'); break;
    case 'start-review': { const items = S.wrongList(data.allQuestions(), store.getHistory()); if (items.length) buildRunner('review', items, '오답', null); break; }
    case 'start-flagged': { const items = S.flaggedList(data.allQuestions(), store.getHistory()); if (items.length) buildRunner('flagged', items, '플래그', null); else go('#/'); break; }
    case 'export': { const blob = new Blob([JSON.stringify(store.exportData(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `cisa-prep-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); break; }
    case 'reset': if (confirm('학습 이력을 전부 삭제할까요? 되돌릴 수 없습니다.')) { store.resetAll(); go('#/'); resolve(); } break;
    case 'start-exam': buildExam(); break;
    case 'exam-answer': exam.answers[exam.ids[exam.pos]] = Number(el.dataset.disp); store.saveSession('exam', exam); renderExam(); break;
    case 'exam-nav': exam.pos = Number(el.dataset.idx); renderExam(); break;
    case 'exam-prev': if (exam.pos > 0) { exam.pos--; renderExam(); } break;
    case 'exam-next': if (exam.pos < exam.ids.length - 1) { exam.pos++; renderExam(); } break;
    case 'exam-flag': { const id = exam.ids[exam.pos]; exam.flags[id] = !exam.flags[id]; store.saveSession('exam', exam); renderExam(); break; }
    case 'exam-submit': if (confirm('제출할까요? 미응답 문항은 오답 처리됩니다.')) submitExam(); break;
  }
});

applyTheme();
start();

// PWA: 서비스워커 등록 (오프라인 — 전철 터널 대응)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
