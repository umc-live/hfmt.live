/**
 * note that in this example the peer connection is a local variable in the function
 * https://webrtc.org/getting-started/peer-connections#initiating_peer_connections
 * 
 * 
 * 1. make offer sending collected data about our system (localDescription)
 * 2. 
 * 
 */

const socket = io();

let uuid;

socket.on('connect', (event) => {
    uuid = socket.id;
    console.log(`this unique id ${uuid}`);
});

socket.on('message', (m) => {
    gotMessageFromServer(m);
});

const mediaStreamConstraints = {
    video: true //, audio: true
};

let peerConnectionConfig = {
    'iceServers': [
        { 'urls': 'stun:stun.stunprotocol.org:3478' },
        { 'urls': 'stun:stun.l.google.com:19302' },
    ]
};


let startTime = null;   
let localStream;
let peerConnection;// s = {};

let peerConnections = new Map();

let localVideo;
let startButton;
let joinButton;

let videoDiv;

function startAction() {
    startButton.disabled = true;
    navigator.mediaDevices.getUserMedia( mediaStreamConstraints )
        .then(_stream => {
            localVideo.srcObject = _stream; // set stream for local <video>
            localStream = _stream; // cache to sent to peers
            joinButton.disabled = false;  // Enable call button.
            console.log('Received local stream.');
        }).catch(error =>
            console.log(`navigator.getUserMedia error: ${error.toString()}.`)
        );

}

function gotMessageFromServer(message) 
{
    var signal = JSON.parse(message);

    // ignore messages from ourselves (although I think socket.io deals with that anyway)
    if (signal.uuid == uuid)
        return;
    
    if ( !peerConnection ) 
    {

        console.log('no exsisting channel, creating but not making an offer')
        joinRoom(false);
    }
    

    if (signal.sdp) 
    {
        console.log(`creating new session description for type ${signal.sdp.type}`)


        peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp) )
            .then(() => {
                // Only create answers in response to offers
                if (signal.sdp.type == 'offer') 
                {
                    console.log('got offer, sending answer -->');

                    peerConnection.createAnswer()
                        .then( createdDescription )
                        .catch( errorHandler );
                }
            }).catch(errorHandler);

    }
    else if (signal.ice) 
    {
        console.log(`ice signal? ${signal}`);

        peerConnection.addIceCandidate( new RTCIceCandidate(signal.ice) )
            .catch( errorHandler );
    }
    else
    {
        console.log(`other signal? ${signal}`);
        
    }
}

function gotIceCandidate(event) 
{
    if (event.candidate != null) {
        socket.emit('room',
            JSON.stringify({
                'ice': event.candidate,
                'uuid': uuid
            })
        );
    }
}

function createdDescription(description) {
    console.log('sending description');

    peerConnection.setLocalDescription(description)
        .then(() => {
            socket.emit('room',
                JSON.stringify({
                    'sdp': peerConnection.localDescription,
                    'uuid': uuid
                })
            );
        }).catch(errorHandler);
}

async function getId( pc )
{
    const identity = await event.target.peerIdentity;
    return identity;
}

function gotRemoteStream( event ) 
{
    console.log('got remote stream', event.target);

/*
    const identity = await pc.peerIdentity;
    return identity;
*/
    //  let fragment = document.createDocumentFragment();
    let remoteVideo = document.createElement('video');

    remoteVideo.addEventListener('loadedmetadata', (event) => {
        const video = event.target;
        console.log(`loaded remote metadata ${video.id} videoWidth: ${video.videoWidth}px, videoHeight: ${video.videoHeight}px.`);
    });

    remoteVideo.addEventListener('onresize', (event) => {
        const video = event.target;
        console.log(`remote onresize ${video.id} videoWidth: ${video.videoWidth}px, videoHeight: ${video.videoHeight}px.`);
    });

    remoteVideo.srcObject = event.streams[0];
    remoteVideo.autoplay = true;
    remoteVideo.setAttribute('playsinline', true);

    videoDiv.appendChild( remoteVideo );

}

function errorHandler(error) {
    console.log(error);
}

function handleConnectionChange(event) {
    const peerConnection = event.target;
    console.log('ICE state change event: ', event);
    console.log(`ICE state: ${peerConnection.iceConnectionState}.`);
}


function joinRoom( isCaller ) 
{
    console.log('joining room, is caller:', isCaller);
    peerConnection = new RTCPeerConnection( peerConnectionConfig );
    peerConnection.onicecandidate = gotIceCandidate;
    peerConnection.ontrack = gotRemoteStream;
    peerConnection.oniceconnectionstatechange = handleConnectionChange;
    peerConnection.addStream( localStream );

    if (isCaller) {
        peerConnection.createOffer()
            .then( createdDescription )
            .catch( errorHandler );
    }

    joinButton.disabled = true;

}

function setupNewConnection()
{
    let newConnection = new RTCPeerConnection( peerConnectionConfig );
    newConnection.onicecandidate = gotIceCandidate;
    newConnection.ontrack = gotRemoteStream;
    newConnection.oniceconnectionstatechange = handleConnectionChange;
    newConnection.addStream( localStream );
    return newConnection;
}

function sendLocalDescription( connection_, signalmsg_ )
{
    connection_.setLocalDescription( signalmsg_ ).then( () => {
        socket.emit('room',
            JSON.stringify({
                'sdp': connection_.localDescription,
                'uuid': uuid
            })
        );
    }).catch( errorHandler ); 
}

function createAndSendOffer( connection_ )
{
    connection_.createOffer().then( offer => {
        sendLocalDescription( connection_, offer );
    }).catch( errorHandler );
}

function gotOffer( signal )
{
    if( !peerConnections.has( signal.uuid ) )
    {
        peerConnections.set( signal.uuid,  ) 
    }
}

function createAndSendAnswer( connection_ )
{
    connection_.createAnswer().then( answer => {
        sendLocalDescription( connection_, answer );
    }).catch( errorHandler );
}



window.addEventListener("load", function () {
    localVideo = document.getElementById('localVideo');

    startButton = document.getElementById('startButton');
    joinButton = document.getElementById('joinButton');

    videoDiv = document.getElementById('remoteVideos');

    startButton.addEventListener('click', startAction);
    joinButton.addEventListener('click', () => {
        joinRoom(true);
    });


    localVideo.addEventListener('loadedmetadata', (event) => {
        const video = event.target;
        console.log(`loaded local metadata ${video.id} videoWidth: ${video.videoWidth}px, videoHeight: ${video.videoHeight}px.`);
    });

});



// Taken from http://stackoverflow.com/a/105074/515584
// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}