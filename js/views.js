// views.js — HTML 빌더 (순수: 상태 → HTML 문자열). 바인딩은 app.js가 위임 처리.
import { DOMAINS, domainMeta } from './config.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 마크다운 표 + 개행을 안전하게 렌더
export function renderRich(text) {
  const lines = String(text ?? '').split('\n');
  let html = '', i = 0, buf = [];
  const flush = () => { if (buf.length) { html += `<p>${buf.map(esc).join('<br>')}</p>`; buf = []; } };
  while (i < lines.length) {
    const line = lines[i];
    if (line.includes('|') && lines[i + 1] && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      flush();
      const cell = (r) => r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
      const head = cell(line); i += 2; const rows = [];
      while (i < lines.length && lines[i].includes('|')) { rows.push(cell(lines[i])); i++; }
      html += '<div class="tbl-wrap"><table><thead><tr>' + head.map((h) => `<th>${esc(h)}</th>`).join('') + '</tr></thead><tbody>'
        + rows.map((r) => '<tr>' + r.map((c) => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
      continue;
    }
    if (line.trim() === '') { flush(); } else { buf.push(line); }
    i++;
  }
  flush();
  return html;
}

const LETTERS = ['A', 'B', 'C', 'D'];
const bar = (pct, color) => `<span class="bar"><span style="width:${pct ?? 0}%;background:${color}"></span></span>`;

export function tabbar(active) {
  const t = (href, icon, label, key) => `<a class="tab${active === key ? ' on' : ''}" data-action="go" data-href="${href}"><span>${icon}</span>${label}</a>`;
  return `<nav class="tabbar">${t('#/', '🏠', '홈', 'home')}${t('#/review', '📕', '오답', 'review')}${t('#/exam', '⏱', '모의', 'exam')}</nav>`;
}

export function unlockScreen(errMsg) {
  return `<div class="unlock"><div class="unlock-card">
    <h1>cisa-prep</h1><p class="muted">CISA 문제은행 — 잠금 해제</p>
    <form data-action="unlock"><input type="password" name="pass" placeholder="패스프레이즈" autocomplete="current-password" autofocus>
    <button type="submit">열기</button></form>
    ${errMsg ? `<p class="err">${esc(errMsg)}</p>` : ''}
    <p class="muted small">본인 학습 전용. 최초 1회만 입력하면 이후 자동으로 열립니다.</p>
  </div></div>`;
}

export function homeScreen({ counts, stats, resume, reviewCount }) {
  const cards = DOMAINS.map((d) => {
    const n = counts[d.id] || 0;
    const s = stats[d.id] || {};
    const acc = s.accuracy == null ? '–' : s.accuracy + '%';
    const disabled = n === 0;
    return `<button class="dcard${disabled ? ' off' : ''}" ${disabled ? '' : `data-action="start-study" data-domain="${d.id}"`}>
      <span class="dtag" style="background:${d.color}">D${d.id}</span>
      <span class="dname">${d.name}</span>
      <span class="dmeta">${disabled ? '추출 대기 중' : `${n}문 · 정답률 ${acc} · 푼 ${s.seen || 0}`}</span>
      ${disabled ? '' : bar(s.accuracy, d.color)}
    </button>`;
  }).join('');
  const resumeHtml = resume
    ? `<button class="resume" data-action="resume-${resume.kind}">▶ 이어하기 — ${resume.label}</button>` : '';
  return `<header class="top"><h1>cisa-prep</h1><button class="ghost" data-action="toggle-theme">🌓</button></header>
    <main class="home">
      ${resumeHtml}
      <h2 class="sec">도메인</h2>
      <div class="dgrid">${cards}</div>
      <div class="quick">
        <button class="qbtn" data-action="go" data-href="#/review">📕 오답노트 <b>${reviewCount}</b></button>
        <button class="qbtn" data-action="go" data-href="#/exam">⏱ 미니 모의 25문</button>
      </div>
    </main>${tabbar('home')}`;
}

// 학습/오답 러너의 문항 카드
export function questionCard({ q, order, pos, size, chosen, flagged, label }) {
  const graded = chosen != null;
  const opts = order.map((origIdx, disp) => {
    const c = q.choices[origIdx];
    let cls = 'opt';
    if (graded) {
      if (origIdx === q.answer) cls += ' correct';
      else if (disp === chosen) cls += ' wrong';
    }
    return `<button class="${cls}" ${graded ? 'disabled' : `data-action="answer" data-disp="${disp}"`}>
      <span class="lbl">${LETTERS[disp]}</span><span>${esc(c.ko)}</span></button>`;
  }).join('');
  const expl = graded ? `<div class="expl">
      <div class="expl-head">${order[chosen] === q.answer ? '<span class="ok">✅ 정답</span>' : '<span class="no">✗ 오답</span>'} · 정답 ${LETTERS[order.indexOf(q.answer)]}</div>
      ${q.explanationTitle ? `<div class="expl-title">${esc(q.explanationTitle)}</div>` : ''}
      ${renderRich(q.explanation.ko)}
      <div class="ref">📄 ${esc(q.ref)}${q.srcId ? ` · ${esc(q.srcId)}` : ''}</div>
    </div>
    <div class="runner-foot"><button class="next" data-action="next">${pos + 1 < size ? '다음 →' : '결과 보기'}</button></div>` : '';
  return `<header class="runner-top">
      <button class="ghost" data-action="go" data-href="#/">✕</button>
      <span class="prog">${label} ${pos + 1}/${size}</span>
      <button class="ghost${flagged ? ' flagged' : ''}" data-action="flag" data-id="${q.id}">${flagged ? '🚩' : '⚑'}</button>
    </header>
    <div class="progbar"><span style="width:${((pos) / size) * 100}%"></span></div>
    <main class="runner">
      <div class="qhead">${q.srcId ? `<span class="qid">[${esc(q.srcId)}]</span>` : ''}${flagChips(q)}</div>
      <div class="qtext">${renderRich(q.question.ko)}</div>
      <div class="opts">${opts}</div>
      ${expl}
    </main>`;
}
function flagChips(q) {
  if (!q.flags) return '';
  const map = { table: '표', figure: '그림', uncertain: '검수' };
  return q.flags.map((f) => `<span class="chip">${map[f] || f}</span>`).join('');
}

export function setSummary({ correct, size, wrong }) {
  return `<main class="summary"><div class="summary-card">
    <div class="big">${correct} / ${size}</div><p class="muted">이번 세트 정답</p>
    ${wrong.length ? `<div class="wrong-list"><h3>틀린 문항</h3>${wrong.map((q) => `<div class="wl">${q.srcId ? `[${esc(q.srcId)}] ` : ''}${esc((q.explanationTitle || q.question.ko).slice(0, 40))}</div>`).join('')}</div>` : '<p class="ok">전부 정답! 🎉</p>'}
    <div class="summary-actions">
      <button data-action="continue-study">계속하기</button>
      <button class="ghost" data-action="go" data-href="#/review">오답 다시</button>
      <button class="ghost" data-action="go" data-href="#/">홈</button>
    </div>
  </div></main>${tabbar('home')}`;
}

export function reviewScreen({ items }) {
  const body = items.length
    ? `<button class="primary" data-action="start-review">전부 다시 풀기 (${items.length})</button>
       <div class="rlist">${items.map((q) => `<div class="ritem"><span class="dtag sm" style="background:${domainMeta(q.domain).color}">D${q.domain}</span>${q.srcId ? `[${esc(q.srcId)}] ` : ''}${esc((q.explanationTitle || q.question.ko).slice(0, 44))}</div>`).join('')}</div>`
    : `<div class="empty"><p>아직 틀린 문제가 없습니다 🎉</p><button data-action="go" data-href="#/">학습 시작</button></div>`;
  return `<header class="top"><h1>오답노트</h1></header><main class="review">${body}</main>${tabbar('review')}`;
}

export function examSetup({ ready, alloc }) {
  const rows = Object.entries(alloc).map(([d, n]) => `<span>D${d} <b>${n}</b></span>`).join('');
  return `<header class="top"><h1>미니 모의</h1></header>
    <main class="exam-setup"><div class="card">
      <p class="big">25문 · 40분</p><p class="muted">시험 비중 배분</p>
      <div class="alloc">${rows}</div>
      ${ready ? '<button class="primary" data-action="start-exam">시작</button>' : '<p class="err">문항이 부족합니다.</p>'}
    </div></main>${tabbar('exam')}`;
}

export function examRun({ q, order, idx, total, chosen, remaining, flagged, navStates }) {
  const opts = order.map((origIdx, disp) => `<button class="opt${chosen === disp ? ' sel' : ''}" data-action="exam-answer" data-disp="${disp}">
      <span class="lbl">${LETTERS[disp]}</span><span>${esc(q.choices[origIdx].ko)}</span></button>`).join('');
  const nav = navStates.map((st, i) => `<button class="navcell ${st}" data-action="exam-nav" data-idx="${i}">${i + 1}</button>`).join('');
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0'), ss = String(remaining % 60).padStart(2, '0');
  return `<header class="runner-top exam">
      <span class="timer${remaining < 300 ? ' warn' : ''}">⏱ ${mm}:${ss}</span>
      <span class="prog">Q${idx + 1}/${total}</span>
      <button class="ghost${flagged ? ' flagged' : ''}" data-action="exam-flag">${flagged ? '🚩' : '⚑'}</button>
    </header>
    <main class="runner">
      <div class="qhead">${q.srcId ? `<span class="qid">[${esc(q.srcId)}]</span>` : ''}</div>
      <div class="qtext">${renderRich(q.question.ko)}</div>
      <div class="opts">${opts}</div>
      <div class="navgrid">${nav}</div>
      <div class="runner-foot two">
        <button class="ghost" data-action="exam-prev">← 이전</button>
        <button class="ghost" data-action="exam-next">다음 →</button>
        <button class="primary" data-action="exam-submit">제출</button>
      </div>
    </main>`;
}

export function examResult({ result, elapsed, reviewItems }) {
  const pct = Math.round((result.correct / result.total) * 100);
  const worst = Object.entries(result.byDomain).filter(([, v]) => v.total).sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))[0]?.[0];
  const rows = DOMAINS.map((d) => {
    const v = result.byDomain[d.id]; if (!v || !v.total) return '';
    const p = Math.round((v.correct / v.total) * 100);
    return `<div class="drow"><span>D${d.id} ${d.short}</span>${bar(p, d.color)}<b>${p}%${String(d.id) === worst ? ' ⚠' : ''}</b></div>`;
  }).join('');
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0'), ss = String(elapsed % 60).padStart(2, '0');
  return `<header class="top"><h1>모의 결과</h1></header>
    <main class="result">
      <div class="score">${pct}% <span class="muted">(${result.correct}/${result.total})</span></div>
      <p class="muted">소요 ${mm}:${ss}</p>
      <div class="drows">${rows}</div>
      <h3 class="sec">문항 리뷰</h3>
      <div class="rlist">${reviewItems.map((r) => `<div class="ritem ${r.ok ? 'ok' : 'no'}">${r.ok ? '✓' : '✗'} ${r.q.srcId ? `[${esc(r.q.srcId)}] ` : ''}${esc((r.q.explanationTitle || r.q.question.ko).slice(0, 40))}</div>`).join('')}</div>
      <div class="summary-actions"><button data-action="go" data-href="#/">홈</button></div>
    </main>${tabbar('exam')}`;
}

export function errorScreen(msg) {
  return `<main class="empty"><p>${esc(msg)}</p><button data-action="reload">다시 시도</button></main>`;
}
