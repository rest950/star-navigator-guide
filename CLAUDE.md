# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案性質

麗星郵輪探索星號（Star Navigator）設施導覽＋單一航次（2026/11/29 基隆出發神戶・高知 5 晚）攻略的**零相依性靜態站台 / PWA**。無 package.json、無 build step、無測試框架、無 CI。架構沿用姊妹專案 `../costa-serena-guide`（同一套 render / 覆蓋層 / SW 模式），多了「行程」與「港口」兩種模式。

主體是 `index.html`（CSS + 資料 + JS 全內嵌），另有 `sw.js`、`manifest.webmanifest`、`icons/`、`tools/smoke.js`。預計部署為 GitHub Pages：`https://rest950.github.io/star-navigator-guide/`。

## 開發指令

```bash
open index.html                 # 直接預覽（file:// 即可）
python3 -m http.server 8000     # 需要 SW / http:// 時
node tools/smoke.js             # 改完資料或邏輯必跑；輸出 ALL CLEAN 才算過
```

`smoke.js` 是唯一的自動檢查（沒有單一測試可跑，失敗時 exit 1）。它用假 DOM 跑每個 render 函式，抓輸出裡的 `undefined` / `NaN` / `[object Object]` / `>null<`，並檢查 `fac.id` 重複與 `f<deck>_` 前綴、`cat` 列舉、`CHECKS` id 重複、`DAYS[].port` 存在於 `PORTS`、`aboardGuess` 區間。它的前提：

- JS 必須留在 `index.html` 裡**唯一一個無屬性的 `<script>`**（用 regex 從第一個 `<script>` 抓到最後一個 `</script>`）。
- 假 DOM 只認 `STATIC` 白名單裡的 id；init / render 期間新增的靜態元素要加進白名單，否則 `getElementById` 回 null 直接炸。render 後才出現的動態元素（`aboardCd` 等）在程式裡一律 null-guard。
- 新的 render 函式或資料常數要加進 smoke 的 `return {...}` 才會被檢查；狀態用 `A.set('portId', k)` 切換。

## 資料區塊（`<script>` 開頭，資料在上、邏輯在下）

| 常數 | 內容 |
|---|---|
| `D` | 甲板與設施，Deck 13 → 4。**一項設施一行**（不是 minified），單點修正用精準字串比對即可 |
| `QF` | 速覽頁「依需求直達」與搜尋主題篩選共用；Deck 清單由 `qfDecks()` 推導，**不要寫死** |
| `DINE_NOTE` | 餐飲 modal 開頭說明；餐廳清單本身由 `renderDine()` 從 `D` 推導 |
| `TRIP` / `DAYS` | 航程首頁的 hero、雙時鐘說明與 Day 1–6 |
| `PORTS` | 港口頁（`kobe`、`kochi`）：碼頭交通、各區塊 HTML、路線、連結 |
| `CHECKS` / `INFO` | 行前清單、船上實用資訊 |

```
Deck = { id, num, zh, en, icon, gold, desc, nature, tags[], fac[] }
Fac  = { id, zh, en, cat, loc, free, vip?, icon, desc, tips }
```

不可破壞的約束：

1. **`D` 陣列順序即畫面順序**（13 → 4）；swipe 換層直接用 index 前後移動。
2. **`fac.id` 是 localStorage key**（`sn_stars`），命名 `f<deck>_<n>`；**`CHECKS` 的 item id** 是 `sn_checks` 的 key；**`PORTS` 的 key** 是 `sn_aboard`（使用者輸入的回船時間）的 key。發布後改 id 會孤兒化使用者的收藏、勾選與回船時間。
   - `PORTS` 的 key 必須等於該筆的 `id` 欄位，且只能是 `[a-z]+`（`routeFromHash` 的 regex，不符就退回行程頁）。
   - Deck 的 `id`（數字）用於 `deckId` 與 `#/deck/<n>`，`num`（字串）用於顯示與 `fac.id` 前綴；兩者值相同，保持一致。
3. **`cat` 封閉列舉**（dining / pool / entertainment / bar / spa / kids / service / shopping / cabin）。新增分類要同步：`D`、搜尋 chip 的 `data-cat`、`pillCls()`、`QF`。`pool` 在這艘船代表「泳池・戶外甲板」（瞭望台、悠閒大道也歸這類）。
4. `vip:true` = 皇宮貴賓限定，卡片顯示「皇宮限定」；`cat:"cabin"` 不顯示價格標籤。
5. localStorage 一律 `sn_` 前綴：與 Costa 版同在 `rest950.github.io`，**localStorage 與 Cache Storage 都是整個網域共用**。

### 資料基準

- 甲板圖：官方**台灣出發版**手冊 `https://media.stardreamcruises.com/SNA_Ship_Brochure_Ex_TWN_TC.pdf`（第 7–10 頁；名稱以此為準，例：甜品匯、悠閒大道、醇夢雪茄廊、星空廊）。一般版 `sna-ship-brochure-tc-v1.pdf` 與英文版名稱不同，英文名取英文版。官方**沒有** SVG / JSON 甲板圖。
- 免費餐廳只有手冊打 `*` 的三間（星夢、百味軒、麗都自助及燒烤）；其餘一律當付費。
- 2026 年手冊未更新的變動：Deck 8 船尾「火鍋」已改「泰悅」泰式自助（PTT 2026/6）。手冊是基準不是唯一真相，改名前先查最近的心得。
- 費用、Wi-Fi、規則：`SNA_Cruise-Guide_TC.pdf`（2025/6 版）；日本出國稅 2026/7/1 起 ¥3,000。
- 航程：官方航程表 V9.2（2026/10/2）；神戶靠泊點以神戶觀光局客船入港表為準（神戸ポートターミナル，新港第4突堤）。

## 時間處理（最容易出錯）

- 船上全程用**母港時間（UTC+8）**，日本港口是 UTC+9。所有計算用固定時差，**不要用手機時區**（手機到日本會自動跳時區）：`twToday()`、`hm(ts, tz)`、`portTs(p, hhmm)`。
- `PORTS.*.arr/dep/aboardGuess` 都是**日本時間**。`portTs` 把早於抵港時間的 HH:MM 視為隔天（神戶 01:00 離港）。`smoke.js` 會檢查 `aboardGuess` 落在停靠區間內。
- 行程文字裡的時間一律標明是「船上」還是「日本」；郵報上寫的是船上時間。
- `tripStatus()` 用台灣日期判斷「今天」；跨日時 `tick()` 會自動重繪行程頁。

## 渲染與狀態

無框架，全部 `innerHTML` 字串樣板。狀態：`mode`（trip / port / overview / single / starred）、`deckId`、`portId`、`filter`、`stars`、`checks`、`aboard`。狀態變更後呼叫 `render()`。

- 行程、港口、清單、資訊卡用原生 `<details class="card">`，展開狀態不需要 JS。
- **就地更新、不整頁重繪**：`toggleStar()`（`.btn-star[data-fac]`）、`toggleCheck()`（`[data-ckg]` 進度條）、`setAboard()`（回船時間與換算）。整頁重繪會把使用者展開的卡片全部收合。
- 搜尋 overlay 與 `#mainContent` 同時存在 DOM，卡片 id 帶 `scope` 前綴（搜尋用 `s_`）；展開用 `toggleFac(this)` + `closest()`。
- Deck bar：全域 swipe 要排除 `NO_SWIPE`；`renderDeckBar()` 只在 chip 數量不符時重建，`centeredDeck` 守衛避免每次 render 把捲動拉回。swipe 換層用 `syncHash(true)`（replaceState），不堆 history。

## 網址路由與覆蓋層

`#/`（行程）、`#/ship`（速覽）、`#/deck/<n>`、`#/port/<id>`、`#/starred`；無效值一律退回行程頁。
覆蓋層（搜尋、三個 modal）一律走 `ovOpen()` / `ovBack()`；`popstate` 優先序是「**先關覆蓋層、再回上一個畫面**」，改動時務必保持。`file://` 下 `canHist` 為 false 時退回直接關閉。

## 硬編碼、不由 `D` 衍生的內容

改設施資料時不會自動連動，需手動同步：動線 modal（`#navModal`）、關於 modal（`#aboutModal`，含船舶規格與免責，與 README 重複）、`DAYS` / `PORTS` 文字裡提到的設施名稱與 Deck 號碼。

改靠港時間時同理：`PORTS.*.arr/dep` 只驅動倒數計算，`times` pills（船上與日本兩組）、`when`、`routeNote`、`DAYS` 的 `times` / `sub` / `plan` 都是手寫的時間字串，要一起改。

## 版本號與離線快取

`APP_VERSION` / `DATA_DATE` 在資料區開頭；`sw.js` 的 `VERSION` 必須一起 bump。SW 清舊快取**只刪 `star-navigator-` 前綴**——Costa 版的舊 SW 會刪光全網域快取，這是兩站同網域時要防的坑。

- 策略是 stale-while-revalidate；新增靜態檔案（圖示等）要加進 `sw.js` 的 `SHELL`，否則首次離線打不開。
- 更新流程跨兩個檔案：新 SW 裝好後**不自動 `skipWaiting`**，頁面顯示 `#updateBar`，使用者按下才 `applyUpdate()` → `SKIP_WAITING` → `controllerchange` 重載（避免閱讀中被抽換）。
- SW 只在 `http(s):` 下註冊；`fetch` 不攔同網域但不在本站 scope 下的路徑（留給 Costa 版自己的 SW）。

## CSS

- `overflow-x: hidden` 只能放在 `html`，放 `body` 會讓 `.deck-bar` 的 sticky 失效。
- 高度受限的 flex column 捲動區（`.search-results`、`.modal-sheet-body`）的直接子元素必須 `flex-shrink: 0`。
- 色彩集中在 `:root` token；金色與底色另有 `--gold-rgb` / `--bg-rgb` 供 `rgba()` 使用。

## 版面驗證

不要用讀 CSS 的方式猜，用 headless Chrome 量：Chrome 視窗最小寬度約 500px，`--window-size=390` **得不到 390px 版面**——改做一個 probe 頁，用 390px 寬的 iframe 載入 `index.html`，加 `--allow-file-access-from-files` 就能在 probe 裡打開所有 `<details>` 再截圖。probe 檔放 scratchpad，不要留在 repo。

## 內容規範

- 全站 zh-TW；設施保留官方中文與英文名稱。
- 設施卡片不寫死營業時間與價格；港口頁可以寫（規劃需要），但要附查詢時間，並把未確認的事寫成「未確認／以郵報為準」。
- 本站內容綁定 11/29 航次；換航次時改 `TRIP` / `DAYS` / `PORTS`，`D` 可沿用。
