// crypto.test.mjs — 암호화 왕복 + 엔진 스모크 (node --test)
import { test } from 'node:test';
import assert from 'node:assert';
import { webcrypto as crypto } from 'node:crypto';
import { allocateByDomain, gradeExam, choiceOrder, isCorrect, makeRng } from '../js/engine.js';

const PBKDF2_ITER = 600000;
async function deriveKey(pass, salt, usage) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, usage);
}

test('AES-GCM 왕복: 같은 패스로 복호 성공', async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const msg = JSON.stringify({ hi: '문제', a: [1, 2, 3] });
  const ek = await deriveKey('pw-정답', salt, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, ek, new TextEncoder().encode(msg));
  const dk = await deriveKey('pw-정답', salt, ['decrypt']);
  const pt = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dk, ct));
  assert.strictEqual(pt, msg);
});

test('AES-GCM: 틀린 패스는 실패', async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ek = await deriveKey('right', salt, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, ek, new TextEncoder().encode('x'));
  const dk = await deriveKey('wrong', salt, ['decrypt']);
  await assert.rejects(() => crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dk, ct));
});

test('allocateByDomain: 25문 = 5/5/3/6/6', () => {
  const a = allocateByDomain(25, { 1: 18, 2: 18, 3: 12, 4: 26, 5: 26 });
  assert.strictEqual(a[1] + a[2] + a[3] + a[4] + a[5], 25);
  assert.deepStrictEqual(a, { 1: 5, 2: 5, 3: 3, 4: 6, 5: 6 });
});
test('allocateByDomain: 150문 = 27/27/18/39/39', () => {
  const a = allocateByDomain(150, { 1: 18, 2: 18, 3: 12, 4: 26, 5: 26 });
  assert.strictEqual(a[1] + a[2] + a[3] + a[4] + a[5], 150);
});

test('choiceOrder+isCorrect: 셔플해도 채점 정확', () => {
  const rng = makeRng(42);
  const q = { answer: 2, choices: [{}, {}, {}, {}] };
  for (let i = 0; i < 20; i++) {
    const order = choiceOrder(q, rng);
    const disp = order.indexOf(q.answer); // 정답을 고른 표시 위치
    assert.ok(isCorrect(q, order, disp));
    assert.ok(!isCorrect(q, order, (disp + 1) % 4));
  }
});
test('noShuffle: 항등 순서', () => {
  const order = choiceOrder({ answer: 0, noShuffle: true, choices: [{}, {}, {}, {}] }, makeRng(1));
  assert.deepStrictEqual(order, [0, 1, 2, 3]);
});
test('gradeExam: 도메인 집계', () => {
  const qs = [{ id: 'a', domain: 1, answer: 0, choices: [{}, {}, {}, {}] }, { id: 'b', domain: 1, answer: 1, choices: [{}, {}, {}, {}] }];
  const orders = { a: [0, 1, 2, 3], b: [0, 1, 2, 3] };
  const r = gradeExam(qs, { a: 0, b: 0 }, orders); // a맞음 b틀림
  assert.strictEqual(r.correct, 1);
  assert.strictEqual(r.byDomain[1].correct, 1);
  assert.strictEqual(r.byDomain[1].total, 2);
});
