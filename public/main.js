import { getCamera, getScreen, onStreamEnded } from "./media.js";
import * as peers from "./peers.js";

const url = new URL(window.location.href);
let username = url.searchParams.get('username');
if (username == null) {
    username = prompt("請輸入使用者名稱");
    if (!username) //按取消或留空時給一個隨機名稱
        username = "user" + Math.floor(Math.random() * 10000);
    window.location.href = window.location.protocol + "//" + window.location.host + `?username=${encodeURIComponent(username)}`;
}

const video = document.getElementById("myvideo");
const videos = document.getElementById("videos");
const shareBtn = document.getElementById("shareBtn");

let localStream;

const ws = new WebSocket(`wss://${window.location.host}`);

function send(message) {
    ws.send(JSON.stringify(message));
}

const handlers = {
    join(json) {
        if (!localStream) //自己還沒取得視訊來源，等自己 join 時會收到完整的 userList
            return;
        json.userList.forEach((user) => {
            const connectionStr = peers.getConnectionStr(username, user);
            if (user != username && !peers.hasPeer(connectionStr))
                peers.createPeer(connectionStr, localStream, videos, send);
        });
        if (json.username == username) //剛加入者對所有既有成員發出 offer
            peers.getConnectionStrs().forEach(async (connectionStr) => {
                send({ type: "offer", SDP: await peers.createOffer(connectionStr), connectionStr });
            });
    },
    ice_candidate(json) {
        peers.addCandidate(json.connectionStr, json.candidate);
    },
    async offer(json) {
        if (!peers.hasPeer(json.connectionStr))
            return;
        const SDP = await peers.createAnswer(json.connectionStr, json.SDP);
        send({ type: "answer", SDP, connectionStr: json.connectionStr });
    },
    async answer(json) {
        if (peers.hasPeer(json.connectionStr))
            await peers.acceptAnswer(json.connectionStr, json.SDP);
    },
    disconnect(json) {
        peers.removePeer(peers.getConnectionStr(username, json.username));
    }
};

ws.onmessage = async (e) => {
    let json;
    try {
        json = JSON.parse(e.data);
    } catch (err) {
        console.warn("忽略無法解析的訊息", err);
        return;
    }
    try {
        if (handlers[json.type])
            await handlers[json.type](json);
    } catch (err) {
        console.error(`處理 ${json.type} 訊息失敗`, err);
    }
};

function startWith(stream) {
    localStream = stream;
    video.srcObject = stream;
    shareBtn.hidden = true;

    // 視訊來源停止時離開房間，讓其他人移除畫面
    onStreamEnded(stream, () => {
        ws.close();
        alert("視訊來源已停止，已離開房間。請重新整理頁面以重新加入。");
    });

    const sendJoin = () => send({ type: "join", username });
    if (ws.readyState == WebSocket.OPEN)
        sendJoin();
    else
        ws.addEventListener("open", sendJoin, { once: true }); //WebSocket 尚未連線完成時等待
}

// 攝影機失敗時改用按鈕，才能由使用者點擊觸發桌面分享
shareBtn.onclick = async () => {
    try {
        startWith(await getScreen());
    } catch (err) {
        alert("無法分享桌面：" + err.name);
    }
};

getCamera()
    .then(startWith)
    .catch((err) => {
        console.warn("無法使用攝影機，改用桌面分享", err);
        shareBtn.hidden = false;
    });
