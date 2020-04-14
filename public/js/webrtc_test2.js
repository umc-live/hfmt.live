
const socket = io();

let uuid;

let localStream;
let peerConnections = new Map();

let localVideo;
let startButton;
let joinButton;
let videoDiv;

const mediaStreamConstraints = {
    video: true //, audio: true
};

let peerConnectionConfig = {
    'iceServers': [
        { 'urls': 'stun:stun.stunprotocol.org:3478' },
        { 'urls': 'stun:stun.l.google.com:19302' },
    ]
};

socket.on('connect', (event) => {
    uuid = socket.id;
    console.log(`this unique id ${uuid}`);
});

socket.on('message', (m) => {
    messageHandler(m)
});

function errorHandler(error) {
    console.log(error);
}

function handleConnectionChange(event) {
    const peerConnection = event.target;
    console.log('ICE state change event: ', event);
    console.log(`ICE state: ${peerConnection.iceConnectionState}.`);
}

function messageHandler(message) 
{
    var signal = JSON.parse(message);

    // ignore messages from ourselves (although I think socket.io deals with that anyway)
    if (signal.uuid == uuid)
        return;
   
    if (signal.sdp) 
    {
        if( signal.sdp.type == 'offer' )
        {
            processOffer(signal);
        }
        else if( signal.sdp.type == 'answer')
        {
            processAnswer(signal);
        }
    }
    else if (signal.ice) 
    {
        processRemoteIceCandidate(signal);
    }
    else
    {
        console.log(`other signal? ${signal}`);
    }
}

function processRemoteIceCandidate(signal)
{
    console.log(`remote ice candidate ${signal.uuid}`);

    peerConnections.forEach( channel => {
        channel.addIceCandidate( new RTCIceCandidate(signal.ice) )
            .catch( errorHandler );
    });

}

function gotLocalIceCandidate(event) 
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

function setupNewConnection()
{
    let newConnection = new RTCPeerConnection( peerConnectionConfig );
    newConnection.onicecandidate = gotLocalIceCandidate;
    newConnection.oniceconnectionstatechange = handleConnectionChange;
    newConnection.addStream( localStream ); //<< should make sure the camera is on first...
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


function createVideoElement( event_, remoteId_ )
{
    console.log('got remote stream', event_.target);
    let remoteVideo = document.createElement('video');

    remoteVideo.addEventListener('loadedmetadata', (e) => {
        const video = e.target;
        console.log(`loaded remote metadata ${video.id} videoWidth: ${video.videoWidth}px, videoHeight: ${video.videoHeight}px.`);
    });

    remoteVideo.addEventListener('onresize', (e) => {
        const video = e.target;
        console.log(`remote onresize ${video.id} videoWidth: ${video.videoWidth}px, videoHeight: ${video.videoHeight}px.`);
    });

    remoteVideo.srcObject = event_.streams[0];
    remoteVideo.autoplay = true;
    remoteVideo.setAttribute('playsinline', true);
    remoteVideo.id = remoteId_;

    videoDiv.appendChild( remoteVideo );

}

// if we get an answer we made the offer?
function processAnswer( signal )
{
    if( peerConnections.has( uuid ) )
    {
        let ourOfferedConnection = peerConnections.get(uuid);
        ourOfferedConnection.ontrack = (event) => {
            createVideoElement(event, signal.uuid);
        };

        ourOfferedConnection.setRemoteDescription( new RTCSessionDescription(signal.sdp) )
           .catch(errorHandler);

    }
}

async function openCamera()
{
    startButton.disabled = true;
    let promise = navigator.mediaDevices.getUserMedia( mediaStreamConstraints );

    try {
        let _stream = await promise;
        localVideo.srcObject = _stream; // set stream for local <video>
        localStream = _stream; // cache to sent to peers
        joinButton.disabled = false;  // Enable call button.
        console.log('Received local stream.');
    }
    catch(error)
    {
        console.log(`navigator.getUserMedia error: ${error.toString()}.`)
    }
}

async function offerStreamCheck(signal) 
{
    if( !localStream )
    {
        let choice = confirm(`user ${signal.uuid} would like to connect with you, ok?`);

        if( choice )
        {
            await openCamera();
        }
        else
            return;
        
    }

}

async function processOffer( signal )
{
    if( !peerConnections.has( signal.uuid ) )
    {
        await offerStreamCheck(signal);
        
        let newConnection = setupNewConnection();
        newConnection.ontrack = (event) => {
            createVideoElement(event, signal.uuid);
        };

        newConnection.setRemoteDescription( new RTCSessionDescription(signal.sdp) )
            .then(() => {
                newConnection.createAnswer()
                    .then( answer => {
                        sendLocalDescription( newConnection, answer );
                    }).catch( errorHandler );
            }).catch(errorHandler);

        peerConnections.set( signal.uuid, newConnection ); 
    }
}


function makeCall()
{
    if( !localStream )
        openCamera();

    console.log('makingCall');
    
    let connection_ = setupNewConnection();
    peerConnections.set( uuid, connection_ ); // << log under our ID since we are making the call

    connection_.createOffer().then( offer => {
        console.log(`sendLocalDescription for type offer`);
        sendLocalDescription( connection_, offer );
    }).catch( errorHandler );

}

window.addEventListener("load", function () {
    localVideo = document.getElementById('localVideo');

    startButton = document.getElementById('startButton');
    joinButton = document.getElementById('joinButton');

    videoDiv = document.getElementById('remoteVideos');

    startButton.addEventListener('click', openCamera);
    joinButton.addEventListener('click', () => {
        makeCall();
    });

    localVideo.addEventListener('loadedmetadata', (event) => {
        const video = event.target;
        console.log(`loaded local metadata ${video.id} videoWidth: ${video.videoWidth}px, videoHeight: ${video.videoHeight}px.`);
    });

});