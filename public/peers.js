const rtcConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

const peerList = {};
const pendingCandidates = {}; //remote description 尚未設定前先暫存的 ICE candidate

//雙方 username 排序後串接，兩端算出的值相同，作為連線與遠端 video 的識別碼
export function getConnectionStr(userA, userB) {
    return [userA, userB].sort().join("<->");
}

export function hasPeer(connectionStr) {
    return connectionStr in peerList;
}

export function getConnectionStrs() {
    return Object.keys(peerList);
}

export function createPeer(connectionStr, localStream, container, send) {
    const peer = new RTCPeerConnection(rtcConfiguration);
    localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
    peer.onicecandidate = (e) => {
        if (e.candidate)
            send({ type: "ice_candidate", candidate: e.candidate, connectionStr });
    };
    peer.ontrack = (e) => {
        let remoteVideo = document.getElementById(connectionStr);
        if (!remoteVideo) //同一個連線可能觸發多次 ontrack，避免重複建立
        {
            remoteVideo = document.createElement("video");
            remoteVideo.setAttribute("autoplay", "true");
            remoteVideo.setAttribute("playsinline", "true");
            remoteVideo.id = connectionStr;
            container.appendChild(remoteVideo);
        }
        remoteVideo.srcObject = e.streams[0];
    };
    peerList[connectionStr] = peer;
}

export async function createOffer(connectionStr) {
    const peer = peerList[connectionStr];
    await peer.setLocalDescription(await peer.createOffer());
    return peer.localDescription;
}

async function setRemoteDescription(connectionStr, sdp) {
    const peer = peerList[connectionStr];
    await peer.setRemoteDescription(sdp);
    (pendingCandidates[connectionStr] || []).forEach((candidate) => peer.addIceCandidate(candidate));
    delete pendingCandidates[connectionStr];
}

export async function createAnswer(connectionStr, offerSdp) {
    const peer = peerList[connectionStr];
    await setRemoteDescription(connectionStr, offerSdp);
    await peer.setLocalDescription(await peer.createAnswer());
    return peer.localDescription;
}

export function acceptAnswer(connectionStr, answerSdp) {
    return setRemoteDescription(connectionStr, answerSdp);
}

export function addCandidate(connectionStr, candidate) {
    const peer = peerList[connectionStr];
    if (!candidate || !peer)
        return;
    if (peer.remoteDescription)
        peer.addIceCandidate(candidate);
    else
        (pendingCandidates[connectionStr] ||= []).push(candidate);
}

export function removePeer(connectionStr) {
    if (peerList[connectionStr])
        peerList[connectionStr].close();
    delete peerList[connectionStr];
    delete pendingCandidates[connectionStr];
    const removeVideo = document.getElementById(connectionStr);
    if (removeVideo)
        removeVideo.remove();
}
