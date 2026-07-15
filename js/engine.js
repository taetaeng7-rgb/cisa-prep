// engine.js — 순수 함수: 샘플링·셔플·채점·도메인 배분 (RNG 주입, 테스트 대상)

// 시드 RNG (mulberry32)
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// 총 N문을 도메인 비중대로 배분(반올림 잔여는 뒤 도메인에 보정)
export function allocateByDomain(total, weights) {
  const ids = Object.keys(weights).map(Number);
  const sum = ids.reduce((s, d) => s + weights[d], 0);
  const alloc = {}; let used = 0;
  ids.forEach((d) => { alloc[d] = Math.round((total * weights[d]) / sum); used += alloc[d]; });
  let diff = total - used; let i = ids.length - 1;
  while (diff !== 0 && i >= 0) { const d = ids[i]; if (diff > 0) { alloc[d]++; diff--; } else if (alloc[d] > 0) { alloc[d]--; diff++; } i--; if (i < 0 && diff !== 0) i = ids.length - 1; }
  return alloc;
}

// 우선순위 정렬: 미풀이 > 최근 오답 > 오래된 정답, 동순위 셔플
export function prioritize(pool, history, rng) {
  const rank = (q) => { const h = history[q.id]; if (!h || h.a === 0) return 0; if (h.last === 'w') return 1; return 2; };
  const buckets = [[], [], []];
  shuffle(pool, rng).forEach((q) => buckets[rank(q)].push(q));
  buckets[2].sort((a, b) => (history[a.id]?.at || 0) - (history[b.id]?.at || 0));
  return [...buckets[0], ...buckets[1], ...buckets[2]];
}
export function pickQuestions(pool, count, history, rng) {
  return prioritize(pool, history, rng).slice(0, count);
}

// 보기 셔플: order[displayIdx] = 원본 인덱스. noShuffle이면 항등
export function choiceOrder(q, rng) {
  if (q.noShuffle) return [0, 1, 2, 3];
  return shuffle([0, 1, 2, 3], rng);
}
// 표시 인덱스 선택 → 원본 정답과 대조
export function isCorrect(q, order, displayIdx) { return order[displayIdx] === q.answer; }

// 모의 채점: answers = { id: displayIdx }, orders = { id: [..] }
export function gradeExam(questions, answers, orders) {
  const byDomain = {};
  let correct = 0;
  questions.forEach((q) => {
    const d = q.domain; byDomain[d] = byDomain[d] || { correct: 0, total: 0 };
    byDomain[d].total++;
    const disp = answers[q.id];
    const ok = disp != null && isCorrect(q, orders[q.id], disp);
    if (ok) { correct++; byDomain[d].correct++; }
  });
  return { correct, total: questions.length, byDomain };
}
