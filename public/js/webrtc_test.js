/*
const configuration: RTCConfiguration = {
    iceServers: [
        {
            urls: ["stun:u3.xirsys.com"]
        }, {
            username: "A9V03PuTW8N9A3K8aEFra1taQjecR5LHlhW9DrjvZj1SvoGtMyhkj3XJLrYzAQpdAAAAAF6IzZ10b2JpYXM=",
            credential: "95ddd1a4-769f-11ea-a962-bea250b72c66",
            urls: [
                "turn:u3.xirsys.com:80?transport=udp",
                "turn:u3.xirsys.com:3478?transport=udp",
                "turn:u3.xirsys.com:80?transport=tcp",
                "turn:u3.xirsys.com:3478?transport=tcp",
                "turns:u3.xirsys.com:443?transport=tcp",
                "turns:u3.xirsys.com:5349?transport=tcp"
            ]
        }
    ],
    iceCandidatePoolSize: 10,
};

export interface Connection {
    connection: RTCPeerConnection,
    remoteStream: MediaStream,
    gainNode: IGainNode<IAudioContext>,
    established: boolean,
    remoteId: string
}
*/

const mediaStreamConstraints = {
    video: true,
};

// Set up to exchange only video.
const offerOptions = {
    offerToReceiveVideo: 1,
};

// Define initial start time of the call (defined as connection between peers).
let startTime = null;

let localStream;
let remoteStream;

let localPeerConnection;
let remotePeerConnection;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');



// Handles hangup action: ends up call, closes connections and resets peers.
function hangupAction() {
  localPeerConnection.close();
  remotePeerConnection.close();
  localPeerConnection = null;
  remotePeerConnection = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
  trace('Ending call.');
}

// Add click event handlers for buttons.
startButton.addEventListener('click', startAction);
callButton.addEventListener('click', callAction);
hangupButton.addEventListener('click', hangupAction);


// Set up initial action buttons status: disable call and hangup.
callButton.disabled = true;
hangupButton.disabled = true;


// Handles start button action: creates local MediaStream.
function startAction() {
    startButton.disabled = true;
    navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
        .then(gotLocalMediaStream).catch(handleLocalMediaStreamError);

    console.log('Requesting local stream.');
}


// Define MediaStreams callbacks.

// Sets the MediaStream as the video element src.
function gotLocalMediaStream(mediaStream) {
    localVideo.srcObject = mediaStream;
    localStream = mediaStream;
    console.log('Received local stream.');
    callButton.disabled = false;  // Enable call button.
}

// Handles error by logging a message to the console.
function handleLocalMediaStreamError(error) {
    console.log(`navigator.getUserMedia error: ${error.toString()}.`);
}

// Handles remote MediaStream success by adding it as the remoteVideo src.
function gotRemoteMediaStream(event) {
    const mediaStream = event.stream;
    remoteVideo.srcObject = mediaStream;
    remoteStream = mediaStream;
    console.log('Remote peer connection received remote stream.');
}


// Add behavior for video streams.

// Logs a message with the id and size of a video element.
function logVideoLoaded(event) {
    const video = event.target;
    console.log(`${video.id} videoWidth: ${video.videoWidth}px, ` +
        `videoHeight: ${video.videoHeight}px.`);
}

// Logs a message with the id and size of a video element.
// This event is fired when video begins streaming.
function logResizedVideo(event) {
    logVideoLoaded(event);

    if (startTime) {
        const elapsedTime = window.performance.now() - startTime;
        startTime = null;
        console.log(`Setup time: ${elapsedTime.toFixed(3)}ms.`);
    }
}

localVideo.addEventListener('loadedmetadata', logVideoLoaded);
remoteVideo.addEventListener('loadedmetadata', logVideoLoaded);
remoteVideo.addEventListener('onresize', logResizedVideo);

