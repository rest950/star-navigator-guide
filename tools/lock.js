// 把 private/booking.html＋private/cabin.json（個資明文，.gitignore）加密成 index.html 與 deck3d.html 裡的 `const LOCKED=...` 那一行。
// 明文是 JSON {html, cabin}：html 給「🔒 我的訂位」，cabin 給平面圖與 3D 的「🏠 我們的房間」標記。
// 用法：SN_LOCK_PW='密碼' node tools/lock.js        （不給環境變數就會互動式詢問，輸入不顯示）
// 格式：PBKDF2-SHA256（n 次）→ AES-256-GCM；ct = 密文＋16 bytes tag（跟 WebCrypto 的 decrypt 輸入一致）。
// booking.html 第一行可以放 <!-- guard: A|B|C -->：寫完後檢查這些字串沒有以明文出現在任何會發布的檔案。
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'private', 'booking.html'), CABIN = path.join(ROOT, 'private', 'cabin.json');
const OUTS = ['index.html', 'deck3d.html'].map(f => path.join(ROOT, f));
const ITER = 600000;

function ask(q) {
  return new Promise(res => {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.includes(q)) process.stdout.write(s); };   // 不回顯密碼
    rl.question(q, a => { rl.close(); process.stdout.write('\n'); res(a); });
  });
}

(async () => {
  if (!fs.existsSync(SRC)) { console.error('找不到 ' + SRC); process.exit(1); }
  let raw = fs.readFileSync(SRC, 'utf8');
  const g = raw.match(/^\s*<!--\s*guard:\s*([^>]*?)\s*-->\s*/);
  const guard = g ? g[1].split('|').map(s => s.trim()).filter(Boolean) : [];
  if (g) raw = raw.slice(g[0].length);
  const html = raw.replace(/\n\s*/g, '\n').trim();
  const cabin = fs.existsSync(CABIN) ? JSON.parse(fs.readFileSync(CABIN, 'utf8')) : null;
  if (cabin) delete cabin._note;
  const payload = JSON.stringify({ html, cabin });

  const pw = process.env.SN_LOCK_PW || await ask('密碼：');
  if (pw.length < 8) { console.error('密碼至少 8 個字（密文是公開的，短密碼可以被離線暴力破解）'); process.exit(1); }

  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(pw, salt, ITER, 32, 'sha256');
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(payload, 'utf8'), c.final(), c.getAuthTag()]);

  // 自我檢查：解得回來
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(ct.subarray(-16));
  if (Buffer.concat([d.update(ct.subarray(0, -16)), d.final()]).toString('utf8') !== payload) throw new Error('round-trip failed');

  const line = `const LOCKED={n:${ITER},s:"${salt.toString('base64')}",iv:"${iv.toString('base64')}",ct:"${ct.toString('base64')}"};`;
  for (const OUT of OUTS) {
    const src = fs.readFileSync(OUT, 'utf8');
    if ((src.match(/^const LOCKED=.*$/gm) || []).length !== 1) { console.error(path.basename(OUT) + ' 裡要剛好有一行（行首）const LOCKED='); process.exit(1); }
    fs.writeFileSync(OUT, src.replace(/^const LOCKED=.*$/m, () => line));
  }

  // 明文外洩檢查：會發布的檔案裡不能出現 guard 字串
  const pub = ['index.html', 'deck3d.html', 'sw.js', 'manifest.webmanifest', 'tools/smoke.js', 'tools/lock.js',
    ...fs.readdirSync(ROOT).filter(f => f.endsWith('.md'))];   // 根目錄所有文件（AGENTS.md、CLAUDE.md、README.md…）
  const leaks = [];
  for (const f of pub) {
    const p = path.join(ROOT, f); if (!fs.existsSync(p)) continue;
    const t = fs.readFileSync(p, 'utf8');
    guard.forEach(w => { if (t.includes(w)) leaks.push(`${f}: ${w.slice(0, 2)}…`); });
  }
  if (leaks.length) { console.error('!! 明文外洩：\n' + leaks.join('\n')); process.exit(1); }
  console.log(`LOCKED 已更新 index.html、deck3d.html（${payload.length} 字元 → ${ct.length} bytes，PBKDF2 ${ITER} 次），guard ${guard.length} 項無外洩`);
})().catch(e => { console.error(e); process.exit(1); });
