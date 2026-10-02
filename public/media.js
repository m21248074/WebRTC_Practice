export function getCamera() {
    return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
}

// getDisplayMedia 必須由使用者點擊觸發
export function getScreen() {
    return navigator.mediaDevices.getDisplayMedia({ video: true });
}

// 使用者按下瀏覽器的「停止共用」或攝影機被拔除時觸發
export function onStreamEnded(stream, callback) {
    stream.getTracks().forEach((track) => {
        track.onended = callback;
    });
}
