# AGENTS.md

給所有 AI coding agent（Claude Code、Codex、Antigravity、Cursor、Copilot…）的專案說明。**這份是唯一來源（SSOT）**，其他 agent 專用檔只能指向這裡，規則見文末「本文件的維護」。

## 1. 專案概要

麗星郵輪探索星號（Star Navigator）設施導覽＋單一航次（2026/11/29 基隆出發神戶・高知 5 晚）攻略的**零相依性靜態站台 / PWA**。無 package.json、無 build step、無測試框架、無 lint、無 CI。部署在 GitHub Pages：`https://rest950.github.io/star-navigator-guide/`（`main` 分支）。

架構沿用姊妹專案 `../costa-serena-guide`（同一套 render / 覆蓋層 / SW 模式），多了「行程」「港口」「自費價目」三種模式。

| 檔案 | 用途 |
|---|---|
| `index.html` | 主體：CSS + 資料 + JS 全內嵌 |
| `deck3d.html` | 獨立的 3D 甲板模型（three.js r128） |
| `vendor/three/` | three.js 與 OrbitControls，本機一份供離線用 |
| `sw.js` / `manifest.webmanifest` / `icons/` | PWA 離線快取與安裝 |
| `tools/smoke.js` | 唯一的自動檢查 |
| `tools/lock.js` | 個資加密（見 §8） |
| `README.md` | 給人看的介紹；不寫實作細節 |
| `docs/`、`private/` | **`.gitignore`、不進 repo**：手冊與船票 PDF、個資明文 |

## 2. 指令與驗證

```bash
open index.html                 # 直接預覽（file:// 即可）
python3 -m http.server 8000     # 需要 SW / http:// 時
node tools/smoke.js             # 改完資料或邏輯必跑；輸出 ALL CLEAN 才算過（失敗 exit 1）
```

`smoke.js` 用假 DOM 跑每個 render 函式，抓輸出裡的 `undefined` / `NaN` / `[object Object]` / `>null<`，並檢查：

- `fac.id` 不重複且有 `f<deck>_` 前綴、`cat` 在列舉內、`CHECKS` id 不重複
- `DAYS[].port` 存在於 `PORTS`、`aboardGuess` 落在停靠區間內
- `SPEND` 卡片的 `fac` 存在於 `D`
- `PLAN` 區塊的 `f` 存在於 `D`、在船形範圍內、標籤放得下（區塊太小 `planLabel` 會回空字串）
- 🏠 房間標記只出現在該層；`index.html` 與 `deck3d.html` 的 `LOCKED` 都已加密
- `deck3d.html` 的設施名稱等於 `D` 同層的 `zh`
- 最後列出沒畫上平面圖、沒放進 3D 的設施（只提示、不算失敗）

smoke 的前提，改程式時不能破壞：

- JS 必須留在 `index.html` 裡**唯一一個無屬性的 `<script>`**（regex 從第一個 `<script>` 抓到最後一個 `</script>`）。
- 假 DOM 只認 `STATIC` 白名單裡的 id；init / render 期間新增的靜態元素要加進白名單，否則 `getElementById` 回 null 直接炸。render 後才出現的動態元素（`aboardCd` 等）在程式裡一律 null-guard。
- 新的 render 函式或資料常數要加進 smoke 的 `return {...}` 才會被檢查；狀態用 `A.set('portId', k)` 切換。

**版面驗證**：不要讀 CSS 猜，用 headless Chrome 量。Chrome 視窗最小寬約 500px，`--window-size=390` 得不到 390px 版面——改做 probe 頁，用 390px 寬的 iframe 載入 `index.html`，加 `--allow-file-access-from-files` 就能在 probe 裡打開所有 `<details>` 再截圖。probe 檔放暫存目錄，不要留在 repo。

## 3. 改動對照表（改 A 必須同步 B）

| 改了什麼 | 要一起改 |
|---|---|
| 任何發布內容 | `index.html` 的 `APP_VERSION` / `DATA_DATE` ＋ `sw.js` 的 `VERSION`（必須相同） |
| 新增靜態檔（圖示等） | `sw.js` 的 `SHELL`，否則首次離線打不開 |
| 新增設施 | `PLAN` 補一塊區塊（否則平面圖沒有它、卡片也沒有「平面圖位置」）；非客房設施補進 `deck3d.html` |
| 設施改名 | `deck3d.html` 的名稱與說明（smoke 會抓）、`#navModal` 動線、`DAYS` / `PORTS` 文字、`SPEND` 裡沒有 `fac` 的卡片（甜點・咖啡小標寫死店名與 Deck）；舊名寫進 `desc` 結尾讓搜尋找得到 |
| 新增 `cat` 分類 | `D`、搜尋 chip 的 `data-cat`、`pillCls()`、`QF`、smoke 的 `CATS` |
| 靠港時間 | `PORTS.*.arr/dep` 只驅動倒數；`times` pills（船上與日本兩組）、`when`、`routeNote`、`DAYS` 的 `times` / `sub` / `plan` 都是手寫字串 |
| 船舶規格、免責 | `#aboutModal` 與 `README.md` 兩處 |
| `private/` 個資 | 重跑 `tools/lock.js`（見 §8） |
| 換航次 | `TRIP` / `DAYS` / `PORTS`；`D` 可沿用 |

## 4. 資料模型（`index.html` 的 `<script>` 開頭，資料在上、邏輯在下）

| 常數 | 內容 |
|---|---|
| `D` | 甲板與設施，Deck 13 → 4。**一項設施一行**（不是 minified），單點修正用精準字串比對即可 |
| `PLAN` | Deck 頁互動平面圖，key 是 Deck `id`，值 `{t,b,bow?,lift?,z[]}`。座標 x 0–160（左舷→右舷）、y 0–400（船頭→船尾），十層共用同一框；電梯 y 預設 `LIFT_Y`（123/241/313），換層時上下對齊。區塊 `{f,x,y,w,h,t?}` 可點、同設施可多塊，`f` 指向別層＝跨層連結；`{d,…}` 是不可點的地標 |
| `QF` | 速覽頁「依需求直達」與搜尋主題篩選共用；Deck 清單由 `qfDecks()` 推導，**不要寫死** |
| `DINE_NOTE` | 餐飲 modal 開頭說明；餐廳清單由 `renderDine()` 從 `D` 推導 |
| `TRIP` / `DAYS` | 航程首頁的 hero、雙時鐘說明與 Day 1–6 |
| `PORTS` | 港口頁（`kobe`、`kochi`）：碼頭交通、各區塊 HTML、路線、連結 |
| `CHECKS` / `INFO` | 行前清單、船上實用資訊 |
| `SPEND_NOTE` / `SPEND` | 自費價目頁：付款與固定費用、飲料套餐、Wi-Fi、付費餐廳菜單、酒吧、其他。卡片給 `fac` 就由 `D` 推導名稱、圖示與位置；`rows` 的 `{h}` 是小標、`{n,p,s?,u?}` 是品項 |

```
Deck = { id, num, zh, en, icon, gold, desc, nature, tags[], fac[] }
Fac  = { id, zh, en, cat, loc, free, vip?, icon, desc, tips }
```

不可破壞的約束：

1. **`D` 陣列順序即畫面順序**（13 → 4）；swipe 換層直接用 index 前後移動。
2. **id 就是使用者資料的 key，發布後改 id 會孤兒化使用者的收藏、勾選與回船時間**：`fac.id` → `sn_stars`（命名 `f<deck>_<n>`）、`CHECKS` item id → `sn_checks`、`PORTS` key → `sn_aboard`。
   - `PORTS` 的 key 必須等於該筆 `id` 欄位，且只能是 `[a-z]+`（`routeFromHash` 的 regex，不符就退回行程頁）。
   - Deck 的 `id`（數字）用於 `deckId` 與 `#/deck/<n>`，`num`（字串）用於顯示與 `fac.id` 前綴；兩者值相同。
3. **`cat` 封閉列舉**：dining / pool / entertainment / bar / spa / kids / service / shopping / cabin。`pool` 在這艘船代表「泳池・戶外甲板」（瞭望台、悠閒大道也歸這類）。
4. `vip:true` = 皇宮貴賓限定，卡片顯示「皇宮限定」；`cat:"cabin"` 不顯示價格標籤。
5. localStorage 一律 `sn_` 前綴（`sn_stars`、`sn_checks`、`sn_aboard`、`sn_plan` 平面圖收合、`sn_lock` 記住的密碼）：與 Costa 版同在 `rest950.github.io`，**localStorage 與 Cache Storage 都是整個網域共用**。

## 5. 程式行為

### 時間（最容易出錯）

- 船上全程用**母港時間（UTC+8）**，日本港口是 UTC+9。所有計算用固定時差，**不要用手機時區**（手機到日本會自動跳時區）：`twToday()`、`hm(ts, tz)`、`portTs(p, hhmm)`。
- `PORTS.*.arr/dep/aboardGuess` 都是**日本時間**。`portTs` 把早於抵港時間的 HH:MM 視為隔天（神戶 01:00 離港）。
- 行程文字裡的時間一律標明「船上」或「日本」；郵報上寫的是船上時間。
- `tripStatus()` 用台灣日期判斷「今天」；跨日時 `tick()` 自動重繪行程頁。

### 渲染與狀態

無框架，全部 `innerHTML` 字串樣板。狀態：`mode`（trip / port / overview / single / starred / spend）、`deckId`、`portId`、`filter`、`stars`、`checks`、`aboard`。狀態變更後呼叫 `render()`。

- 行程、港口、清單、資訊卡、自費價目用原生 `<details class="card">`，展開狀態不需要 JS。
- **就地更新、不整頁重繪**（重繪會把使用者展開的卡片全部收合）：`toggleStar()`（`.btn-star[data-fac]`）、`toggleCheck()`（`[data-ckg]` 進度條）、`setAboard()`（回船時間與換算）。
- 搜尋 overlay 與 `#mainContent` 同時存在 DOM，卡片 id 帶 `scope` 前綴（搜尋用 `s_`）；展開用 `toggleFac(this)` + `closest()`。
- 平面圖是 `<details id="planBox">`，在 `renderSingle()` 裡跟設施清單包成 `.deck-split`（≥768px 左右兩欄、平面圖 sticky）。
  - 點區塊 `planTap()`：同層就展開並捲到卡片（先關掉展開動畫，捲動才會用展開後的頁長算），跨層交給 `showOnPlan()`。
  - 設施卡「平面圖位置」走 `showOnPlan()`：同層就地標亮，否則 `ovGo()` 換層再捲到區塊（搜尋 overlay 裡也能用）。標亮用 `planMark()` 就地換 class。按鈕只在 `PLAN_FAC`（畫在自己那層的設施）裡才出現。
- Deck bar：全域 swipe 要排除 `NO_SWIPE`；`renderDeckBar()` 只在 chip 數量不符時重建，`centeredDeck` 守衛避免每次 render 把捲動拉回。swipe 換層用 `syncHash(true)`（replaceState），不堆 history。

### 路由與覆蓋層

`#/`（行程）、`#/ship`（速覽）、`#/deck/<n>`、`#/port/<id>`、`#/starred`、`#/spend`（入口在「更多」選單、桌機 header、行程頁與餐飲 modal，沒有底部 tab）；無效值一律退回行程頁。

- 覆蓋層（搜尋、modal）一律走 `ovOpen()` / `ovBack()`；`popstate` 優先序是「**先關覆蓋層、再回上一個畫面**」，改動時務必保持。
- 從覆蓋層裡直接換頁用 `ovGo()`（直接關閉＋replaceState 蓋掉覆蓋層那筆 entry）。**不要** `closeModal()` 後再 `go()`——`history.back()` 是非同步的，會跟 `pushState` 打架。
- `file://` 下 `canHist` 為 false，退回直接關閉。

### CSS

- `overflow-x: hidden` 只能放在 `html`，放 `body` 會讓 `.deck-bar` 的 sticky 失效。
- 高度受限的 flex column 捲動區（`.search-results`、`.modal-sheet-body`）的直接子元素必須 `flex-shrink: 0`。
- 色彩集中在 `:root` token；金色與底色另有 `--gold-rgb` / `--bg-rgb` 供 `rgba()` 使用。

## 6. 3D 甲板模型（`deck3d.html`）

獨立頁面，不吃 `index.html` 的資料；入口在「更多」選單、桌機 header（🧊 3D）與每層平面圖底部（`deck3d.html#<n>` 聚焦該層），頁內「← 導覽」與資訊卡連回 `./#/deck/<n>`。

- 座標是手冊甲板圖的像素位置（`DK` 每層換算），用 `room` / `area` / `pool` / `info` 建物件；客房用 `col` / `row` 依分類上色。
- **設施名稱必須等於 `D` 同層的 `zh`**：smoke 用 regex 抓 `room(N,…,'cat','名稱'` / `area(…)` / `info(N,'名稱'` / `pool(…)` 比對；`D3_GENERIC` 是允許的非設施名稱（樓梯、未標名區塊、非旅客區域等）。
- 手冊沒標名的方塊一律叫「未標名區塊」，不要自己猜用途。Deck 10 中段兩側是皇宮露台房（客房分類 `pbal`），與 `PLAN` 判讀相同。
- three.js 不走 CDN，`vendor/three/` 與 `deck3d.html` 都在 `SHELL`，船上離線也能開。升級要確認 `examples/js/`（非 module 版）還存在——r148 之後已移除。

## 7. 版本與離線快取

- `APP_VERSION` / `DATA_DATE` 在資料區開頭，`sw.js` 的 `VERSION` 必須一起 bump。
- 策略 stale-while-revalidate。SW 清舊快取**只刪 `star-navigator-` 前綴**——Costa 版的舊 SW 會刪光全網域快取，這是兩站同網域要防的坑。
- 新 SW 裝好後**不自動 `skipWaiting`**：頁面顯示 `#updateBar`，使用者按下才 `applyUpdate()` → `SKIP_WAITING` → `controllerchange` 重載（避免閱讀中被抽換）。
- SW 只在 `http(s):` 註冊；`fetch` 不攔同網域但不在本站 scope 下的路徑（留給 Costa 版自己的 SW）。

## 8. 🔒 個資鎖（我的訂位）

repo 與網站都是公開的。**船票姓名、訂位編號、房號、分流報到時段、旅行社連結等個資只放在 `private/booking.html`**；`private/cabin.json` 是「🏠 我們的房間」的位置（`plan`＝`PLAN` 座標、`d3`＝3D 手冊像素座標），也是個資。

- 加密：`SN_LOCK_PW='…' node tools/lock.js`（不給環境變數會互動式問密碼）。把兩者包成 JSON `{html, cabin}`，PBKDF2-SHA256 60 萬次 → AES-256-GCM，寫進 `index.html` **與** `deck3d.html` 行首 `const LOCKED=` 那一行。密碼至少 8 字（密文公開，短密碼可離線暴力破解），**密碼向使用者要、不存在任何檔案或記憶裡**。
- `booking.html` 第一行 `<!-- guard: A|B -->` 列出不能以明文出現在公開檔案的字串，`lock.js` 寫完會檢查所有公開檔案（含根目錄每個 `.md`）。**公開資料（`DAYS`、`CHECKS` 等）與任何文件都不寫房號、姓名、訂位編號**，只寫「見 🔒 我的訂位」。
- 前端：`openLock()` → `lockDecrypt()`（WebCrypto，需 https 或 file/localhost）；勾「記住」才把密碼存 `sn_lock`，解密內容只在記憶體。有 `sn_lock` 的裝置開頁就背景解鎖；`myCabin` 有值時 `planHTML()` 畫 `.my-cabin` 標記（class **不能以 `pz` 開頭**，smoke 的標籤檢查靠它切區塊），解鎖／上鎖用 `myCabinPaint()` 就地更新。
- `deck3d.html` 讀同一個 `sn_lock`（沒有就按「🔒 標出房間」輸入），解開才 `markMine()`。

## 9. 資料來源與判讀基準

手冊是基準不是唯一真相：改名或改價前先查最近的旅客心得。原始 PDF 在 `docs/`（不進 repo）。

- **甲板圖與設施名稱**：官方**一般版**手冊 `sna-ship-brochure-tc-v1.pdf` 第 7–10 頁。2026/11/25 起名稱以此為準，取**甲板圖上的標示**（例：小蛋糕咖啡館、海濱長廊、雪茄吧、禮品廊、精品店、健身房）。台灣出發版 `https://media.stardreamcruises.com/SNA_Ship_Brochure_Ex_TWN_TC.pdf` 的舊名寫在 `desc` 結尾「（台灣版手冊稱「…」）」；兩版座標相同。英文名取英文版。官方**沒有** SVG / JSON 甲板圖。
  - `PLAN` 座標是從 PDF 目測換算（直式、船頭朝上、三欄排版；第 7 頁比第 8–10 頁低約 16pt，用電梯位置對齊）。本機沒有 poppler，PDF 轉圖用 Swift + PDFKit。
  - 客房配色依一般版第 10 頁圖例：Deck 10 兩側 10526–10566 露台客房（紫）、**10568–10616 皇宮露台房（淡黃，`f10_6`）**、10618–10636 皇宮豪華套房；船頭那排與 10508/10512/10518/10522 皇宮套房（淺綠）。台灣版中段畫成紫色，以一般版為準。
- **免費餐廳**只有手冊打 `*` 的三間（星夢、百味軒、麗都自助及燒烤），其餘一律當付費。
- **手冊未更新的變動**：Deck 8 船尾「火鍋」已改「泰悅」泰式自助（PTT 2026/6；官方指南 v8 列 Rua Thai；一般版手冊 2026/10/30 版已改，台灣版仍標火鍋），火鍋併到 Deck 13 海鮮燒烤（2026/5 心得）。
- **費用、Wi-Fi、規則**：官方指南 `https://media.stardreamcruises.com/sna-cruise-guide-ex-twn-tc-v8.pdf`（2026/7，取代 2025/6 版；露台房每晚 NT$1,200 餐飲額度已刪除）。日本出國稅 2026/7/1 起 ¥3,000。燃油費 NT$450（10/1 起新訂位）見官網 FAQ；9/30 前訂位的 NT$300 與港務費（已含船票）取自旅行社公告，會隨油價變。
- **官網依船切換頁籤**（飲料套餐、線上預付 Wi-Fi、兒童俱樂部、慶祝配套）：伺服器 HTML 與一般 fetch 只拿得到雲頂夢號（新幣）內容，要用 headless Chrome 點「探索星號」頁籤才看得到新台幣價。
- **菜單價**：官方沒有公開菜單，取自旅客拍的菜單照。**2025 下半年起菜單標淨價（已含服務費）**，之前另加 18%；兩年份並列時用 `rows` 小標分開，不要自己乘 1.18。
- **登船須知**：旅行社《麗星郵輪旅遊指南 2026 年基隆出發》（2026.01，32 頁）：報到流程、行李（每人 2 件合計 50 kg、只收硬殼）、第二間免費餐廳早 350／午晚 450、JetFi eSIM。手冊裡的國際觀光旅客稅是舊制 NT$220，以 ¥3,000 為準。
- **船票**（2026/11/20）：東岸旅客中心、靠港時間與航程表一致（神戶 15:00–01:00、高知 11:00–20:00，日本時間）；旅行社（KKday 包船）說不用線上預辦、離港前 1 小時回船。
- **航程**：官方航程表 V9.2（2026/10/2；11/4 重新上傳的 PDF 只改 2027 航次）；神戶靠泊點以神戶觀光局客船入港表為準（神戸ポートターミナル，新港第4突堤）。

## 10. 內容規範

- 全站 zh-TW；設施保留官方中文與英文名稱。
- 設施卡片不寫死營業時間與價格；價格集中在 `SPEND`，港口頁也可以寫（規劃需要），兩者都附來源與查詢時間，未確認的寫成「未確認／以郵報為準」。
- 本站內容綁定 11/29 航次。

## 11. 已知待辦

- 登船須知手冊的甲板圖把 Deck 8 船頭標「國際廳」、Deck 7／12 標「RW@Sea 娛樂場」、Deck 8 有「糖果屋」，跟 `D` 不同，尚未查證、未改。

## 本文件的維護

- **只改 `AGENTS.md`**。`CLAUDE.md` 只是 `@AGENTS.md` 匯入＋Claude Code 專屬設定；不要新增 `GEMINI.md`、`.cursorrules`、`.agents/rules/` 等內容副本（Antigravity、Codex、Cursor、Copilot 都直接讀 `AGENTS.md`；Antigravity 若同時看到 `GEMINI.md` 會兩份都載入）。Gemini CLI 要讀這份，在自己的 `settings.json` 設 `"context": {"fileName": ["AGENTS.md"]}`。
- 專案規則、踩過的坑、資料判讀結論寫進這裡，不要只存在某個 agent 的私人記憶（其他 agent 看不到）。
- 寫函式名、常數、檔名前先 grep 確認存在；改了程式行為要同一個 commit 更新這份。
- `README.md` 給人看（功能、檔案結構、來源摘要、授權），不重複實作細節。
