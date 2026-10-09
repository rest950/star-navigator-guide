/* 探索星號導覽 — 離線快取
   船上網路要付費、外海常斷，整份 app 必須能離線開啟。
   策略：stale-while-revalidate — 先回快取（開得快、離線也開得起來），
   同時在背景抓新版寫回快取，下次開啟即為新版；有新版時由頁面提示重新載入。
   改版時務必同步 bump VERSION（與 index.html 的 APP_VERSION 一致），否則舊快取不會被清掉。
   ⚠️ 與 Costa 版同在 rest950.github.io 網域，Cache Storage 是整個網域共用的：
   清舊快取時只能刪自己前綴（PREFIX）的，否則會把別的站的離線快取一起刪掉。 */
const VERSION = '1.1.1';
const PREFIX = 'star-navigator-';
const CACHE = PREFIX + VERSION;
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', e => {
  // 單一檔案的 app，任一項失敗就整批失敗會太脆弱，逐項容錯
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.all(SHELL.map(u => c.add(u).catch(() => null)))
  ));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 頁面按下「更新」時才接手，避免使用者閱讀到一半被抽換
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;            // 外連（地圖、官網、Windy）不攔
  // 同網域但不在本站路徑下（例如 Costa 版）不攔，交給它自己的 SW
  if (sameOrigin && !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;

  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: sameOrigin });
    const net = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }   // 背景更新，不擋畫面
    return (await net) || cache.match('./index.html');
  }));
});
