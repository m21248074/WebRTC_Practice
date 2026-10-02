# WebRTC Practice

WebRTC 多人視訊練習專案。伺服器使用 Node.js（Express + `ws`）同時提供靜態網頁與 WebSocket 信令（signaling），瀏覽器端以 mesh 方式（每兩位使用者之間各建一條 `RTCPeerConnection`）互相傳送視訊。

## 功能

- 多人加入同一個房間，彼此互相看到視訊畫面
- 沒有攝影機時，可改用桌面分享
- 有人離開時，其他人會自動移除該畫面

## 需求

- Node.js
- 支援 WebRTC 的瀏覽器

## 安裝

```
npm install
```

## 產生憑證

瀏覽器只允許在安全環境（HTTPS）下使用攝影機與桌面分享，所以伺服器必須以 HTTPS 啟動。啟動前需在專案根目錄準備以下檔案（已被 `.gitignore` 排除，不會進版控）：

```
key.pem        伺服器私鑰
cert.pem       伺服器憑證
CA/cert.pem    簽發憑證的 CA 憑證
```

以 OpenSSL 產生自簽憑證：

```powershell
openssl req -x509 -newkey rsa:2048 -nodes -days 365 -keyout key.pem -out cert.pem -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
mkdir CA
copy cert.pem CA\cert.pem
```

瀏覽器第一次開啟時會顯示不安全警告，需手動選擇繼續前往。

## 使用方式

```
node index.js
```

1. 以瀏覽器開啟 `https://localhost:3000`，輸入使用者名稱（也可以直接在網址加上 `?username=名稱`）。
2. 另開分頁或使用其他裝置，以**不同的使用者名稱**加入，即可互相看到畫面。
3. 若找不到攝影機，頁面會顯示「分享桌面」按鈕。

使用者名稱必須唯一，系統以它來識別每個人。

## 專案結構

```
index.js          HTTPS 伺服器與 WebSocket 信令中繼
public/
  index.html      頁面（HTML 與 CSS）
  main.js         使用者名稱、WebSocket、訊息分派、join 流程
  peers.js        RTCPeerConnection 管理（offer／answer、ICE）
  media.js        取得攝影機與桌面分享
```

前端使用原生 ES modules，沒有 build 步驟。

## 運作方式

伺服器只做中繼：收到 `join` 時廣播目前的使用者名單，其他訊息（`offer`、`answer`、`ice_candidate`）則轉發給除了發送者以外的所有人，由前端以 `connectionStr`（雙方名稱排序後串接）判斷是否屬於自己的連線。剛加入的人會對所有既有成員發出 offer，既有成員建立連線後回覆 answer。

## 已知限制

- 只有 STUN（Google 公開伺服器），沒有 TURN，在嚴格 NAT 或跨網路環境下可能無法連線。
- 只有單一房間，沒有房間或權限的概念。
- 目前僅傳送視訊，沒有音訊。
- mesh 架構下每增加一人，每位使用者的連線數與頻寬都會增加，適合少數人使用。

## 授權

[MIT](LICENSE)
