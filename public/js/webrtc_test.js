const socket = io();

let uuid = createUUID();

socket.on('connection', (event) => {
    console.log(event);
});

socket.on('message', (m) => { 
   // console.log('got message', m);
    gotMessageFromServer(m);
});
 
const mediaStreamConstraints = {
    video: true
};

let startTime = null;
let localStream;
let remoteStream;
let peerConnection;

let peerConnectionConfig = {
    'iceServers': [
      {'urls': 'stun:stun.stunprotocol.org:3478'},
      {'urls': 'stun:stun.l.google.com:19302'},
    ]
  };
  

let localVideo;
let remoteVideo;
let startButton;
let joinButton;


function startAction() 
{
    startButton.disabled = true;
    navigator.mediaDevices.getUserMedia( mediaStreamConstraints )
        .then( _stream => {
            localVideo.srcObject = _stream; // set stream for local <video>
            localStream = _stream; // cache to sent to peers
            joinButton.disabled = false;  // Enable call button.
            console.log('Received local stream.');            
        }).catch( error => 
            console.log(`navigator.getUserMedia error: ${error.toString()}.`)
        );

}

function gotMessageFromServer(message) 
{
    if(!peerConnection) 
    {
        joinRoom(false);
    }
        
    var signal = JSON.parse(message);
  
    console.log('got message', signal);
    
    // ignore messages from ourselves (although I think socket.io deals with that anyway)
    if( signal.uuid == uuid) 
        return;

    if( signal.sdp ) 
    {
      peerConnection.setRemoteDescription( new RTCSessionDescription(signal.sdp) )
        .then( () => {
            // Only create answers in response to offers
            if(signal.sdp.type == 'offer') 
            {
                peerConnection.createAnswer()
                    .then(createdDescription)
                    .catch(errorHandler);
            }
        }).catch(errorHandler);

    } 
    else if(signal.ice) 
    {
      peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice) )
        .catch( errorHandler );
    }
  }
  
  function gotIceCandidate(event) {
    if(event.candidate != null) {
        socket.emit('room', 
            JSON.stringify({
                'ice': event.candidate, 
                'uuid': uuid
            })
        );
    }
  }
  
  function createdDescription(description) 
  {
    console.log('got description');
  
    peerConnection.setLocalDescription(description)
        .then(() => {
            socket.emit('room', 
                    JSON.stringify({
                        'sdp': peerConnection.localDescription, 
                        'uuid': uuid
                    })
                );
        }).catch( errorHandler );
  }
  
  function gotRemoteStream(event) {
    console.log('got remote stream');
    remoteVideo.srcObject = event.streams[0];
  }
  
  function errorHandler(error) {
    console.log(error);
  }
  


function joinRoom(isCaller)
{
    peerConnection = new RTCPeerConnection( peerConnectionConfig );
    peerConnection.onicecandidate = gotIceCandidate;
    peerConnection.ontrack = gotRemoteStream;
    peerConnection.addStream( localStream );
  
    if(isCaller) 
    {
      peerConnection.createOffer()
        .then( offerDescripion => {
            peerConnection.setLocalDescription( offerDescripion )
            .then(() => {
                socket.emit('room', 
                    JSON.stringify({
                        'sdp': peerConnection.localDescription, 
                        'uuid': uuid
                    })
                );
            }).catch( errorHandler );
        } )
        .catch( errorHandler );
    }

}


window.addEventListener("load", function() {
    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');
    startButton = document.getElementById('startButton');
    joinButton = document.getElementById('joinButton');

    startButton.addEventListener('click', startAction);
    joinButton.addEventListener('click', ()=>{
        joinRoom(true);
    });


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

});



// Taken from http://stackoverflow.com/a/105074/515584
// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID() {
    function s4() {
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
  
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
  }