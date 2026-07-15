// guard.mjs — 평문 유출 가드 (G01~G03). public repo push 전 필수.
// 사용: node tools/guard.mjs  (cisa-prep 루트에서). 위반 시 exit 1.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

let fail = 0;
const bad = (m) => { console.error('  ✗', m); fail++; };

// 추적/스테이징된 파일 목록
let files = [];
try { files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean); } catch {}

// G01: 평문 문항 JSON 유입
const plainJson = files.filter((f) => /(^|\/)(extracted-|domain[1-5])\.?.*\.json$/.test(f) || /^data\/.*\.json$/.test(f));
for (const f of plainJson) {
  try { const t = readFileSync(f, 'utf8'); if (t.includes('"question"') && t.includes('"answer"')) bad(`G01 평문 문항 JSON 추적됨: ${f}`); }
  catch {}
}
if (files.some((f) => /extracted-d[1-5]\.json$/.test(f))) bad('G01 extracted-*.json 이 public repo에 있음');

// G02: questions.enc 가 실제 암호문인지
if (existsSync('data/questions.enc')) {
  const buf = readFileSync('data/questions.enc');
  const magic = buf.slice(0, 8).toString('latin1');
  if (magic !== 'CISAENC1') bad('G02 questions.enc 매직 헤더 불일치(평문 오복사?)');
  // 엔트로피 대략 체크: 앞부분에 '{' '한글' JSON 흔적 없어야
  if (buf.slice(0, 200).includes(Buffer.from('"question"'))) bad('G02 questions.enc 안에 평문 흔적');
} else bad('G02 data/questions.enc 없음 — 먼저 암호화');

// G03: 비밀값·PDF
if (files.some((f) => /\.env$/.test(f))) bad('G03 .env 추적됨');
if (files.some((f) => /\.pdf$/i.test(f))) bad('G03 PDF 추적됨');

if (fail) { console.error(`\n가드 실패: ${fail}건 — push 중단`); process.exit(1); }
console.log('가드 통과 (G01~G03): 평문/비밀값 유출 없음');
