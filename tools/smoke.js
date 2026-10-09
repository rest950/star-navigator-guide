// 無框架 smoke test：抽出 index.html 的 <script>，用假的 document/localStorage 跑所有 render 函式。
// 用法：node tools/smoke.js        （改完資料或邏輯後跑一次；輸出 ALL CLEAN 才算過）
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];

const STATIC = new Set(('mainContent deckBar deckBarScroll verLabel verDetail btnTop updateBar tabTr tabOv tabSg tabSt tabMore ' +
  'starBadge moreMenu searchOverlay searchInput searchClear searchChips searchResults navModal navModalBg navBody ' +
  'dineModal dineModalBg dineBody aboutModal aboutModalBg dBtnTr dBtnOv dBtnSg dBtnSt dBtnSp').split(' '));
const els = {};
function el(id) {
  if (!STATIC.has(id)) return null;
  return els[id] || (els[id] = {
    id, innerHTML: '', textContent: '', value: '', style: {}, dataset: {}, children: [], childElementCount: 0,
    classList: { _s: new Set(), add(c) { this._s.add(c) }, remove(c) { this._s.delete(c) },
      toggle(c, f) { const on = f === undefined ? !this._s.has(c) : f; on ? this._s.add(c) : this._s.delete(c); return on }, contains(c) { return this._s.has(c) } },
    querySelector: () => null, querySelectorAll: () => [], insertAdjacentHTML() {}, focus() {}, scrollIntoView() {}, contains: () => false,
  });
}
const listeners = {};
Object.assign(global, {
  document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener: (t, f) => (listeners[t] = listeners[t] || []).push(f), hidden: false },
  window: { addEventListener() {}, scrollTo() {} },
  location: { hash: '', protocol: 'file:' },
  history: { replaceState() {}, pushState() {}, back() {}, state: null },
  localStorage: { _d: {}, getItem(k) { return this._d[k] || null }, setItem(k, v) { this._d[k] = v } },
  scrollY: 0, setInterval: () => 0, setTimeout: () => 0,   // navigator 用 Node 內建的（沒有 serviceWorker）
});

const A = new Function(src + `
return {D,QF,PLAN,DAYS,PORTS,CHECKS,INFO,SPEND,renderTrip,renderPort,renderOverview,renderSingle,renderStarred,renderDine,renderSpend,portTs,routeFromHash,
  set:(k,v)=>{eval(k+"=v")}};`)();
(listeners.DOMContentLoaded || []).forEach(f => f());

let problems = 0;
const fail = m => { problems++; console.log('!!', m); };
function check(name, html) {
  const bad = ['undefined', 'NaN', '[object Object]', '>null<'].filter(w => html.includes(w));
  bad.length ? fail(`${name} contains ${bad.join(',')}`) : console.log('ok', name);
}
check('trip', A.renderTrip());
for (const k of Object.keys(A.PORTS)) { A.set('portId', k); check('port ' + k, A.renderPort()); }
check('overview', A.renderOverview());
for (const d of A.D) {
  A.set('deckId', d.id); const h = A.renderSingle(); check('deck ' + d.num, h);
  // 平面圖每塊區域都要有字（區塊太小時 planLabel 會回空字串）
  h.split('<g class="pz').slice(1).map(s => s.slice(0, s.indexOf('</g>'))).filter(g => !g.includes('<text'))
    .forEach(g => fail(`deck ${d.num} plan zone ${(/data-f="(\w+)"/.exec(g) || [])[1] || 'deco'} too small for its label`));
}
check('starred', A.renderStarred());
check('dine', A.renderDine());
check('spend', A.renderSpend());

const CATS = new Set('dining pool entertainment bar spa kids service shopping cabin'.split(' '));
const ids = A.D.flatMap(d => d.fac.map(f => f.id));
ids.filter((x, i) => ids.indexOf(x) !== i).forEach(x => fail('duplicate fac.id ' + x));
A.D.forEach(d => d.fac.forEach(f => { if (!CATS.has(f.cat)) fail(`${f.id} unknown cat ${f.cat}`); if (!f.id.startsWith('f' + d.num + '_')) fail(`${f.id} not under deck ${d.num}`); }));
const cks = A.CHECKS.flatMap(g => g.items.map(i => i.id));
cks.filter((x, i) => cks.indexOf(x) !== i).forEach(x => fail('duplicate check id ' + x));
A.DAYS.forEach(d => { if (d.port && !A.PORTS[d.port]) fail(`day ${d.n} port ${d.port} missing`); });
for (const [k, p] of Object.entries(A.PLAN)) {
  if (!A.D.some(d => d.id === +k)) fail(`plan deck ${k} not in D`);
  p.z.forEach(z => {
    if (z.f ? !ids.includes(z.f) : !z.d) fail(`plan ${k} zone ${z.f || '?'} invalid`);
    if (z.x < 0 || z.x + z.w > 160 || z.y < p.t || z.y + z.h > p.b) fail(`plan ${k} zone ${z.f || z.d} outside hull`);
  });
}
const onPlan = new Set(Object.entries(A.PLAN).flatMap(([k, p]) => p.z.filter(z => z.f && z.f.startsWith('f' + k + '_')).map(z => z.f)));
const offPlan = ids.filter(x => !onPlan.has(x));
A.SPEND.forEach(g => g.cards.forEach(c => { if (c.fac ? !ids.includes(c.fac) : !(c.icon && c.title)) fail(`spend card ${c.fac || c.title} invalid`); }));
for (const p of Object.values(A.PORTS)) {
  const arr = A.portTs(p, p.arr), dep = A.portTs(p, p.dep), ab = A.portTs(p, p.aboardGuess);
  if (!(arr < ab && ab < dep)) fail(`${p.id} aboardGuess ${p.aboardGuess} not within ${p.arr}–${p.dep}`);
}
console.log(`${ids.length} facilities, ${cks.length} checklist items, ${onPlan.size} on deck plans${offPlan.length ? ' (not drawn: ' + offPlan.join(' ') + ')' : ''}`);
console.log(problems ? `PROBLEMS: ${problems}` : 'ALL CLEAN');
process.exit(problems ? 1 : 0);
