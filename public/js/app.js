const sock = io();

sock.on('connect', () => {
  console.log('socket.io connected');
  sendHeartbeat();

});

const log = document.getElementById('log');

sock.on('message', (m) => { 
  console.log('received', m);
  log.innerHTML = m; 
});
 

const sendHeartbeat = () => {
  sock.emit('heartbeat', {
    timestamp: Date.now()
  });
};

setInterval(sendHeartbeat, 100);

const onHeartbeat = (payload) => {
  //console.log('received heartbeat');
  const roundtripTime = Date.now() - payload.timestamp;
  const { nodeName } = payload;
  //log.innerHTML = `[${nodeName}]: ${roundtripTime}ms`;
  log.innerHTML = `client-server websocket ping round trip ${roundtripTime}ms`;
};

sock.on('heartbeat', onHeartbeat);




const mediaStreamConstraints = {
  video: true,
};

// Set up to exchange only video.
const offerOptions = {
  offerToReceiveVideo: 1,
};

// Define initial start time of the call (defined as connection between peers).
let startTime = null;

// Define peer connections, streams and video elements.
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream;
let remoteStream;

let localPeerConnection;
let remotePeerConnection;


// Define action buttons.
const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');

// Set up initial action buttons status: disable call and hangup.
callButton.disabled = true;
hangupButton.disabled = true;


// Handles start button action: creates local MediaStream.
function startAction() {
  startButton.disabled = true;
  navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
    .then(gotLocalMediaStream).catch(handleLocalMediaStreamError);
  trace('Requesting local stream.');
}

