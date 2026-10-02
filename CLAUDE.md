# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

WebRTC 多人視訊練習專案：Node.js 伺服器（Express + `ws`）同時負責提供靜態網頁與 WebSocket 信令（signaling），瀏覽器端以 mesh 方式（每兩位使用者之間各建一條 `RTCPeerConnection`）互相傳送視訊。伺服器為 [index.js](index.js)；前端在 [public/](public/)，以原生 ES modules 組成（無 build 步驟）：

- [public/main.js](public/main.js)：username、WebSocket、訊息分派（`handlers`）、`join` 流程
- [public/peers.js](public/peers.js)：`RTCPeerConnection` 管理（offer／answer、ICE 暫存、遠端 `<video>` 的建立與移除），`peerList` 等狀態只存在此模組內
- [public/media.js](public/media.js)：取得攝影機／桌面分享，監聽視訊來源停止
- [public/index.html](public/index.html)：只含 HTML 與 CSS，以 `<script type="module">` 載入 `main.js`

## 常用指令

- 安裝相依套件：`npm install`
- 啟動伺服器：`node index.js`（監聽 `https://localhost:3000`）
- 沒有 build、lint 或測試設定（`npm test` 只是佔位指令）。

### 啟動前必備的憑證

伺服器使用 HTTPS（`getUserMedia` 需要安全環境），啟動時會同步讀取下列檔案，缺少任何一個都會直接崩潰。這些檔案已被 [.gitignore](.gitignore) 排除，不會進版控，需自行產生：

- `./key.pem`、`./cert.pem`：伺服器私鑰與憑證
- `./CA/cert.pem`：簽發憑證的 CA 憑證

使用方式：以 `https://localhost:3000` 開啟（可加 `?username=名稱`，沒帶時前端會用 `prompt` 詢問並自動重新導向）。多人測試請開多個分頁／裝置，並使用不同的 username。

## 架構

### 信令流程（需同時對照 index.js 與 public/main.js、public/peers.js 才能理解）

伺服器是一個極簡的單一房間中繼，沒有房間概念：

- 收到 `type: "join"`：將 username 記錄到全域 `roomData`，並**廣播給所有 client**（含自己）`{type:"join", username, userList}`，`userList` 為目前全部使用者名稱。
- 其他任何訊息（`offer`／`answer`／`ice_candidate`）：原封不動轉發給**除了發送者以外的所有 client**。伺服器不做定向轉送，由前端用 `connectionStr` 過濾。
- 連線關閉：從 `roomData` 移除並廣播 `{type:"disconnect", username}`。

前端流程：

1. `getUserMedia`（僅視訊，`audio: false`）成功後才送出 `join`。若失敗（例如沒有攝影機），會顯示「分享桌面」按鈕，點擊後改用 `getDisplayMedia`（必須由使用者點擊觸發）取得串流再送出 `join`。
2. 收到 `join`：對 `userList` 中每位尚未建立連線的其他使用者建立 `RTCPeerConnection`，存入 `peers.js` 的 `peerList[connectionStr]`。自己尚未取得視訊來源時會忽略別人的 `join`（自己 `join` 時會收到完整 `userList`）。`connectionStr` 是雙方 username 排序後以 `<->` 串接，兩端算出來的值相同，作為連線的共同識別碼，同時也是遠端 `<video>` 元素的 `id`。
3. 只有**剛加入者本人**（`json.username==username`）收到自己的 `join` 回播時，才對所有 peer 發出 offer；既有成員只建立 peer 並等待 offer。
4. `offer` → `answer` → `ice_candidate` 皆帶 `connectionStr`，不屬於自己的連線（`peerList` 中找不到）會被忽略。ICE candidate 若早於 remote description 到達，會先暫存，設定完成後再加入。
5. `disconnect`：對應 peer 呼叫 `close()` 後刪除，並移除該 `<video>`。

### 注意事項

- username 必須唯一；整個流程（`connectionStr`、伺服器的 `filter`）都以 username 當作身分識別。
- ICE 設定使用 Google 公開 STUN，沒有 TURN，跨 NAT 嚴格網路可能無法連線。
- 使用 `ws` 8、Express 5。`ws` 8 的 `message` 事件收到的是 Buffer，轉發前必須 `toString()`，否則瀏覽器會收到 Blob 而無法 `JSON.parse`。
