// stats.js — 순수 함수: 이력 → 도메인·토픽 정답률·오답·스트릭
export function domainStats(questions, history) {
  const out = {};
  for (let d = 1; d <= 5; d++) out[d] = { total: 0, seen: 0, correct: 0 };
  questions.forEach((q) => {
    const s = out[q.domain]; if (!s) return;
    s.total++;
    const h = history[q.id];
    if (h && h.a > 0) { s.seen++; if (h.last === 'r') s.correct++; }
  });
  for (let d = 1; d <= 5; d++) out[d].accuracy = out[d].seen ? Math.round((out[d].correct / out[d].seen) * 100) : null;
  return out;
}
export function overall(questions, history) {
  let seen = 0, correct = 0;
  questions.forEach((q) => { const h = history[q.id]; if (h && h.a > 0) { seen++; if (h.last === 'r') correct++; } });
  return { total: questions.length, seen, correct, accuracy: seen ? Math.round((correct / seen) * 100) : null };
}
// 토픽별 정답률 (topic 필드가 있는 문항만)
export function topicStats(questions, history) {
  const m = {};
  questions.forEach((q) => {
    if (!q.topic) return;
    const key = `${q.domain}|${q.topic}`;
    m[key] = m[key] || { domain: q.domain, topic: q.topic, total: 0, seen: 0, correct: 0 };
    m[key].total++;
    const h = history[q.id];
    if (h && h.a > 0) { m[key].seen++; if (h.last === 'r') m[key].correct++; }
  });
  return Object.values(m).map((t) => ({ ...t, accuracy: t.seen ? Math.round((t.correct / t.seen) * 100) : null }));
}
// 약점 토픽: 5문 이상 풀었고 정답률 낮은 순
export function weakTopics(questions, history, minSeen = 3, limit = 8) {
  return topicStats(questions, history).filter((t) => t.seen >= minSeen).sort((a, b) => a.accuracy - b.accuracy).slice(0, limit);
}
export function wrongList(questions, history) {
  return questions.filter((q) => history[q.id]?.last === 'w').sort((a, b) => (history[a.id]?.at || 0) - (history[b.id]?.at || 0));
}
export function flaggedList(questions, history) {
  return questions.filter((q) => history[q.id]?.flag);
}
// 연속 학습일(오늘 또는 어제 기준으로 끊김 없이)
export function streak(activity) {
  const days = new Set(Object.keys(activity || {}));
  if (!days.size) return 0;
  const d = new Date(); let n = 0;
  const iso = (x) => x.toISOString().slice(0, 10);
  if (!days.has(iso(d))) d.setDate(d.getDate() - 1); // 오늘 아직 안 했으면 어제부터
  while (days.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
