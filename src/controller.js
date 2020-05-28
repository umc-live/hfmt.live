/**
 * to do:
 * add html and js options for file input
 *  in these cases, add the files to the menu
 *  I guess really everything should be in one file? not sure yet
 */


import * as soupclient from './soupclient-module';
import io from 'socket.io-client';
import * as drawsocket from './drawsocket-web';

const socket = io();
soupclient.init(socket);
drawsocket.init(socket);

window.drawsocket = drawsocket;
window.drawsocket.getMediaStreams = function(){ return soupclient.getStreams() };

//console.log('set the stream?', window.drawsocket.getMediaStreams);

window.drawsocket.on_newPeerStream = async function(stream, kind, id){
    return 0;
}


const hostname = window.location.hostname;
const $ = document.querySelector.bind(document);

let localMediaStream;

socket.on('room-message', (data) => {
    //console.log(data)
    if( data.hasOwnProperty('file') )
    {
      //  console.log(data.file);
        
        for(let i = 0; i < data.file.length; i++)
        {

            let file = data.file[i];
            let str = arrayBufferToString(file.buf);
            if( file.type === "application/json" )
            {
                const json_ = JSON.parse( str );
                processFile( file.name, json_ , 'drawsocket');
            }
            else
            {
                processFile( file.name, str , file.type );
            }

        }
    }
    else
    {
        drawsocket.input(data);
    }
});


function fileToObj(file)
{
    if ('TextDecoder' in window) {
        var dataView = new DataView(file);
        var decoder = new TextDecoder('utf8');
        var obj = JSON.parse(decoder.decode(dataView));
        return obj;
    } else {
        var decodedString = String.fromCharCode.apply(null, new Uint8Array(file));
        var obj = JSON.parse(decodedString);
        return obj;
    }

}

function arrayBufferToString(file)
{
    if ('TextDecoder' in window) {
        var dataView = new DataView(file);
        var decoder = new TextDecoder('utf8');
        var obj = decoder.decode(dataView); //<< not parsing since it could be another type?
        return obj;
    } else {
        var obj = String.fromCharCode.apply(null, new Uint8Array(file));
        return obj;
    }

}

async function loadScript(node, src){
    return new Promise((resolve, reject) => {
        node.onload = () => resolve()
        node.src = src
    })
  }

async function insertHTML(html, dest, append=false){
    // if no append is requested, clear the target element
    if(!append) 
        dest.innerHTML = '';

    // create a temporary container and insert provided HTML code
    let container = document.createElement('div');
    container.innerHTML = html;

    // cache a reference to all the scripts in the container
    let scripts = container.querySelectorAll('script');

    // get all child elements and clone them in the target element
    let nodes = container.childNodes;
    for( let i=0; i< nodes.length; i++) 
        dest.appendChild( nodes[i].cloneNode(true) );

    // force the found scripts to execute...
    for( let i=0; i< scripts.length; i++)
    {
        let script = document.createElement('script');
        script.type = scripts[i].type || 'text/javascript';

        if( scripts[i].hasAttribute('src') ) 
        {
            console.log('loading src', i);
            await loadScript(script, scripts[i].src);
            //script.src = scripts[i].src;
        }
        else
            console.log('loading script', i);
            

        script.innerHTML = scripts[i].innerHTML;
        document.head.appendChild(script);
        document.head.removeChild(script);
    }
    // done!
    return true;
}

function processFile(name, obj, type)
{
   // let obj = fileToObj(file);
//    console.log(`received json ${JSON.stringify(obj, null, 2)}`);
    
    let menu = $('#select_part');
    menu.innerHTML = "";

    let el1 = document.createElement('option');
    el1.value = "";
    el1.innerHTML = "-- Select Display --";
    menu.appendChild(el1);

    if( type == 'drawsocket')
    {
        Object.keys(obj).forEach( key => {
            let el = document.createElement('option');
            el.value = key;
            el.innerHTML = `${name}: ${key}`;
            menu.appendChild(el);
        });

        menu.addEventListener('change', (event) => { 
            drawsocket.input( obj[event.target.value] );
        });
    }
    else
    {
        let el = document.createElement('option');
        el.value = name;
        el.innerHTML = name;
        menu.appendChild(el);

        drawsocket.input({
            key: "clear",
            val: "*"
        });

        menu.addEventListener('change', (event) => {            
            if( type == 'text/html')
            {               
                insertHTML(obj, $('#main-html') );
            }
            else if( type == 'text/js' )
            {
                // ?
            }
        });
    }
    
}


async function handleFiles()
{
    const file = this.files[0];
    console.log(this.files, this.files.length);


    let fileArray = [];
    for( let i = 0; i < this.files.length; i++)
    {
        let file = this.files[i];
        console.log(file);
       /*

        socket.emit('room-message', {
            file: file
        });
        */

       let reader = new FileReader();
       reader.readAsText(file);

        reader.onload = function() {
            if( file.type === "application/json" )
            {
                processFile( file.name, JSON.parse(reader.result), 'drawsocket' );
            }
            else
            {
                processFile( file.name, reader.result, file.type );
            }
            
        }
        
        reader.onerror = function() {
            console.log(reader.error);
        };

        fileArray.push({
            type: file.type,
            name: file.name,
            buf: file
        });
    }

    socket.emit('room-message', {
        file: fileArray
    });
    

}


soupclient.on_joinedRoom = ()=>{
    $('#btn_connect').disabled = true;
}

soupclient.on_newPeerStream = async (stream, kind, id) => {

    console.log('default on_newPeerStream');
    
//    if( drawsocket.on_newPeerStream )
    {
        const ret = await window.drawsocket.on_newPeerStream(stream, kind, id);
        if( ret == 1 )
        {
            return;
        }

    }
    
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

// to do: set audio and video stream devices

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


async function showCameraInfo() 
{
    let infoEl = $('#camera-info');
    const audioTrack = localMediaStream.getAudioTracks()[0];
    const videoTrack = localMediaStream.getVideoTracks()[0];

    infoEl.innerHTML = `input video: ${videoTrack.label} | audio: ${audioTrack.label}`
}


// Oscilliscope

let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;
var bufferLength = analyser.frequencyBinCount;
var dataArray = new Uint8Array(bufferLength);
analyser.getByteTimeDomainData(dataArray);
let localAudioSource;

var canvas = document.getElementById("oscilloscope");
var canvasCtx = canvas.getContext("2d");

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

function sendDrawsocketMessage()
{
    console.log("sendDrawsocketMessage");

    let inputText = $('#drawsocket_output_text').value;
    console.log(inputText);

    try 
    {
        let json_ = JSON.parse(inputText);
        json_.timetag = Date.now();
        socket.emit('room-message',
            json_        
        );

        drawsocket.input(json_);
    }
    catch (err) 
    {
        console.log('failled to parse', err);
    }
   
    $('#message_panel').style.display = "none";

}


function createMessagePanel()
{
    $('#message_panel').style.display = "inline-block";
}

function keyHandler(e) {
    var TABKEY = 9;
    if(e.keyCode == TABKEY) {
        this.value += "\t";
        if(e.preventDefault) {
            e.preventDefault();
        }
        return false;
    }
}

window.addEventListener('load', () => {
    $('#btn_connect').addEventListener('click', soupclient.joinRoom );
    $('#btn_start').addEventListener('click', startStream);
    
    $('#input_sendfile').addEventListener('change', handleFiles, false);

    $('#btn_sendfile').addEventListener('click',()=> { 
        $('#input_sendfile').click() 
    });

    $('#btn_drawsocket').addEventListener('click', createMessagePanel );
    $('#btn_drawsocket_send').addEventListener('click', sendDrawsocketMessage );

    let textinput = $('#drawsocket_output_text');
    textinput.addEventListener('keydown', keyHandler, false );
    textinput.value = `{ 
        "key" : "tween", 
        "val" : [{ 
            "id" : "score-anim", 
            "cmd" : "play" 
        }, { 
           "id" : "miniscore-anim", 
           "cmd" : "play" 
        }]
    }`;

    window.addEventListener('unload', soupclient.leaveRoom);
})
