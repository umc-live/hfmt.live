
import * as soupclient from './soupclient-module';
import io from 'socket.io-client';

const socket = io();
soupclient.init(socket);


socket.on('room-message', (data) => {
    console.log(data)
});

function testCom()
{
    socket.emit('room-message', {
        msg: 'hello room!'
    });
}



const hostname = window.location.hostname;
const $ = document.querySelector.bind(document);

let localMediaStream;

let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;
var bufferLength = analyser.frequencyBinCount;
var dataArray = new Uint8Array(bufferLength);
analyser.getByteTimeDomainData(dataArray);
let localAudioSource;

// Get a canvas defined with ID "oscilloscope"
var canvas = document.getElementById("oscilloscope");
var canvasCtx = canvas.getContext("2d");


soupclient.on_joinedRoom = ()=>{
    $('#btn_connect').disabled = true;
}

soupclient.on_newPeerStream = async (stream, kind, id) => {

    const tag = kind + '-' + id;
    if ($('#' + tag)) {
        console.log('already have tag');
        return;
    }

    let el = document.createElement(kind);
    el.setAttribute('playsinline', '');
    el.setAttribute('autoplay', '');
    //el.setAttribute('muted', '');
    //el.setAttribute('controls', true);

    el.id = tag;

    el.srcObject = stream;

    $(`#videos`).appendChild(el);

    await el.play()
        .catch((error) => {
            console.error('elememt failed to play:', error, el);
            el.setAttribute('controls', '');
        });
}


soupclient.on_removedPeerStream = (_id) => {
    document.querySelectorAll(`#video-${_id}`).forEach(e => {
        e.parentNode.removeChild(e);
    });

    document.querySelectorAll(`#audio-${_id}`).forEach(e => {
        e.parentNode.removeChild(e);
    });
}

async function startStream() 
{
    if (localMediaStream)
        return;

    try {
        localMediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

    }
    catch (e) {
        console.error('start camera error', e);
    }

    await soupclient.sendStream(localMediaStream);


    //$('#stop-streams').style.display = 'initial';
    showCameraInfo();
    let display = $('#localVideo');
    display.srcObject = localMediaStream;
    //display.setAttribute('muted', true);

    // add visualizer here for local audio:
    localAudioSource = audioCtx.createMediaStreamSource(localMediaStream);
    localAudioSource.connect(analyser);

    audioCtx.resume();
    audioCtx.onstatechange = () => console.log(audioCtx.state);
    draw();

    console.log(localAudioSource);

    $('#btn_start').disabled = true;

}


async function showCameraInfo() {
    //    let deviceId = await getCurrentVideoDeviceId();
    //    let audioDeviceId = await getCurrentAudioDeviceId();
    let infoEl = $('#camera-info');
    const audioTrack = localMediaStream.getAudioTracks()[0];
    const videoTrack = localMediaStream.getVideoTracks()[0];

    infoEl.innerHTML = `input video: ${videoTrack.label} | audio: ${audioTrack.label}`
}

function draw() 
{
    requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = "rgb(255, 255, 255)";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "rgb(0, 0, 0)";

    canvasCtx.beginPath();

    var sliceWidth = canvas.width * 1.0 / bufferLength;
    var x = 0;

    for (var i = 0; i < bufferLength; i++) {

        var v = dataArray[i] / 128.0;
        var y = v * canvas.height / 2;

        if (i === 0) {
            canvasCtx.moveTo(x, y);
        } else {
            canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
}

function handleFiles()
{
    const fileList = this.files; /* now you can work with the file list */
    console.log(fileList);

    socket.emit('room-message', {
        file: fileList
    })
    
}

window.addEventListener('load', () => {
    $('#btn_connect').addEventListener('click', soupclient.joinRoom );
    $('#btn_start').addEventListener('click', startStream);
    
    $('#input_sendfile').addEventListener('change', handleFiles, false);

    $('#btn_sendfile').addEventListener('click',()=> { 
        $('#input_sendfile').click() 
    });

    window.addEventListener('unload', soupclient.leaveRoom);
})

