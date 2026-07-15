// stats.js — 순수 함수: 이력 → 도메인 정답률·오답 목록
export function domainStats(questions, history) {
  const out = {};
  for (let d = 1; d <= 5; d++) out[d] = { total: 0, seen: 0, correct: 0 };
  questions.forEach((q) => {
    const s = out[q.domain]; if (!s) return;
    s.total++;
    const h = history[q.id];
    if (h && h.a > 0) { s.seen++; if (h.last === 'r') s.correct++; }
  });
  // accuracy: 푼 것 중 마지막이 정답인 비율
  for (let d = 1; d <= 5; d++) out[d].accuracy = out[d].seen ? Math.round((out[d].correct / out[d].seen) * 100) : null;
  return out;
}
export function wrongList(questions, history) {
  return questions
    .filter((q) => history[q.id]?.last === 'w')
    .sort((a, b) => (history[a.id]?.at || 0) - (history[b.id]?.at || 0));
}
export function flaggedList(questions, history) {
  return questions.filter((q) => history[q.id]?.flag);
}
