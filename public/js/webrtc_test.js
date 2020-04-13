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

// Set up to exchange only video.
const offerOptions = {
    offerToReceiveVideo: 1,
};

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
  console.log('Ending call.');
}


// Set up initial action buttons status: disable call and hangup.
callButton.disabled = true;
hangupButton.disabled = true;



const mediaStreamConstraints = {
    video: true
};


function gotLocalMediaStream(mediaStream) 
{
    localVideo.srcObject = mediaStream; // set stream 
    localStream = mediaStream;
    console.log('Received local stream.');
    callButton.disabled = false;  // Enable call button.
}

function handleLocalMediaStreamError(error) 
{
    console.log(`navigator.getUserMedia error: ${error.toString()}.`);
}

function startAction() 
{
    startButton.disabled = true;
    navigator.mediaDevices.getUserMedia( mediaStreamConstraints )
        .then( gotLocalMediaStream )
        .catch( handleLocalMediaStreamError );

    console.log('Requesting local stream.');
}


// Connects with new peer candidate.
function handleConnection(event) 
{
    const peerConnection = event.target;
    const iceCandidate = event.candidate;
  
    if (iceCandidate) {
      const newIceCandidate = new RTCIceCandidate(iceCandidate);
      const otherPeer = getOtherPeer(peerConnection);
  
      otherPeer.addIceCandidate(newIceCandidate)
        .then(() => {
          handleConnectionSuccess(peerConnection);
        }).catch((error) => {
          handleConnectionFailure(peerConnection, error);
        });
  
      console.log(`${getPeerName(peerConnection)} ICE candidate:\n` +
        `${event.candidate.candidate}.`);
    }
  }
  
  // Logs that the connection succeeded.
  function handleConnectionSuccess(peerConnection) {
    console.log(`${getPeerName(peerConnection)} addIceCandidate success.`);
  };
  
  // Logs that the connection failed.
  function handleConnectionFailure(peerConnection, error) {
    console.log(`${getPeerName(peerConnection)} failed to add ICE Candidate:\n` +
      `${error.toString()}.`);
  }
  
  // Logs changes to the connection state.
  function handleConnectionChange(event) {
    const peerConnection = event.target;
    console.log('ICE state change event: ', event);
    console.log(`${getPeerName(peerConnection)} ICE state: ` +
      `${peerConnection.iceConnectionState}.`);
  }
  

function callAction() 
{
    callButton.disabled = true;
    hangupButton.disabled = false;
  
    console.log('Starting call.');
    startTime = window.performance.now();
  
    // Get local media stream tracks.
    const videoTracks = localStream.getVideoTracks();
    const audioTracks = localStream.getAudioTracks();

    if (videoTracks.length > 0) {
      console.log(`Using video device: ${videoTracks[0].label}.`);
    }
    if (audioTracks.length > 0) {
      console.log(`Using audio device: ${audioTracks[0].label}.`);
    }
  
    const servers = null;  // Allows for RTC server configuration.
  
    // Create peer connections and add behavior.
    localPeerConnection = new RTCPeerConnection(servers);
    console.log('Created local peer connection object localPeerConnection.');
  
    localPeerConnection.addEventListener('icecandidate', handleConnection);
    localPeerConnection.addEventListener(
      'iceconnectionstatechange', handleConnectionChange);
  
      
    remotePeerConnection = new RTCPeerConnection(servers);
    console.log('Created remote peer connection object remotePeerConnection.');
  
    remotePeerConnection.addEventListener('icecandidate', handleConnection);
    remotePeerConnection.addEventListener(
      'iceconnectionstatechange', handleConnectionChange);
    remotePeerConnection.addEventListener('addstream', gotRemoteMediaStream);
  
    // Add local stream to connection and create offer to connect.
    localPeerConnection.addStream(localStream);
    console.log('Added local stream to localPeerConnection.');
  
    console.log('localPeerConnection createOffer start.');
    localPeerConnection.createOffer(offerOptions)
      .then(createdOffer).catch(setSessionDescriptionError);
  }


// Logs error when setting session description fails.
function setSessionDescriptionError(error) {
    console.log(`Failed to create session description: ${error.toString()}.`);
  }
  
  // Logs success when setting session description.
  function setDescriptionSuccess(peerConnection, functionName) {
    const peerName = getPeerName(peerConnection);
    console.log(`${peerName} ${functionName} complete.`);
  }
  
  // Logs success when localDescription is set.
  function setLocalDescriptionSuccess(peerConnection) {
    setDescriptionSuccess(peerConnection, 'setLocalDescription');
  }
  
  // Logs success when remoteDescription is set.
  function setRemoteDescriptionSuccess(peerConnection) {
    setDescriptionSuccess(peerConnection, 'setRemoteDescription');
  }


// Gets the "other" peer connection.
function getOtherPeer(peerConnection) {
    return (peerConnection === localPeerConnection) ?
        remotePeerConnection : localPeerConnection;
  }
  
  // Gets the name of a certain peer connection.
  function getPeerName(peerConnection) {
    return (peerConnection === localPeerConnection) ?
        'localPeerConnection' : 'remotePeerConnection';
  }
  

// Logs offer creation and sets peer connection session descriptions.
function createdOffer(description) {
    console.log(`Offer from localPeerConnection:\n${description.sdp}`);
  
    console.log('localPeerConnection setLocalDescription start.');
    localPeerConnection.setLocalDescription(description)
      .then(() => {
        setLocalDescriptionSuccess(localPeerConnection);
      }).catch(setSessionDescriptionError);
  
    console.log('remotePeerConnection setRemoteDescription start.');
    remotePeerConnection.setRemoteDescription(description)
      .then(() => {
        setRemoteDescriptionSuccess(remotePeerConnection);
      }).catch(setSessionDescriptionError);
  
    console.log('remotePeerConnection createAnswer start.');
    remotePeerConnection.createAnswer()
      .then(createdAnswer)
      .catch(setSessionDescriptionError);
  }
  
  // Logs answer to offer creation and sets peer connection session descriptions.
  function createdAnswer(description) {
    console.log(`Answer from remotePeerConnection:\n${description.sdp}.`);
  
    console.log('remotePeerConnection setLocalDescription start.');
    remotePeerConnection.setLocalDescription(description)
      .then(() => {
        setLocalDescriptionSuccess(remotePeerConnection);
      }).catch(setSessionDescriptionError);
  
    console.log('localPeerConnection setRemoteDescription start.');
    localPeerConnection.setRemoteDescription(description)
      .then(() => {
        setRemoteDescriptionSuccess(localPeerConnection);
      }).catch(setSessionDescriptionError);
  }
  



function gotRemoteMediaStream( event ) 
{
    const mediaStream = event.stream;
    remoteVideo.srcObject = mediaStream;
    remoteStream = mediaStream;
    console.log('Remote peer connection received remote stream.');
}

startButton.addEventListener('click', startAction);
callButton.addEventListener('click', callAction);
hangupButton.addEventListener('click', hangupAction);



localVideo.addEventListener('loadedmetadata', (event) =>  {
    const video = event.target;
    console.log(`loaded local metadata ${video.id} videoWidth: ${video.videoWidth}px, videoHeight: ${video.videoHeight}px.`);
});

remoteVideo.addEventListener('loadedmetadata', (event) =>  {
    const video = event.target;
    console.log(`loaded remote metadata ${video.id} videoWidth: ${video.videoWidth}px, videoHeight: ${video.videoHeight}px.`);
});

remoteVideo.addEventListener('onresize', (event) =>  {
    const video = event.target;
    console.log(`remote onresize ${video.id} videoWidth: ${video.videoWidth}px, videoHeight: ${video.videoHeight}px.`);
});



