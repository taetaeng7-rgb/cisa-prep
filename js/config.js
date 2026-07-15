// config.js — 상수 (시험 표준·도메인·모의 구성·색)
export const DOMAINS = [
  { id: 1, short: '감사', name: '감사 프로세스', color: '#4F46E5' },
  { id: 2, short: '거버넌스', name: 'IT 거버넌스·관리', color: '#0D9488' },
  { id: 3, short: '개발', name: '도입·개발·구현', color: '#D97706' },
  { id: 4, short: '운영', name: '운영·복원력', color: '#0284C7' },
  { id: 5, short: '보안', name: '정보자산 보호', color: '#BE123C' },
];
export const WEIGHTS = { 1: 18, 2: 18, 3: 12, 4: 26, 5: 26 }; // 시험 출제 비중(%)
export const SET_SIZE = 10;          // 학습 세트 크기(=통근 20분)
export const MINI_EXAM = { count: 25, minutes: 40 };  // 미니 모의
export const FULL_EXAM = { count: 150, minutes: 240 }; // 풀 모의(전량 추출 후)
export const domainMeta = (id) => DOMAINS.find((d) => d.id === id);
