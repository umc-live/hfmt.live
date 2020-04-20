'use strict';

import * as mediasoup from "mediasoup-client";
import io from 'socket.io-client';

//import deepEqual from 'deep-equal';

const log = console.log;

const hostname = window.location.hostname;
const $ = document.querySelector.bind(document);

const socket = io()

let socketID;

let device,
    joined,
    localCam,
    localScreen,
    recvTransport,
    sendTransport,
    camVideoProducer,
    camAudioProducer,
    screenVideoProducer,
    screenAudioProducer,
    currentActiveSpeaker = {},
    lastPollSyncData = {},
    pollingInterval,
    consumers = [];


// consumers are links to peers, stored by id
// the consumers are links to the media streams, produced by the transport

async function sleep(ms) {
    return new Promise((r) => setTimeout(() => r(), ms));
  }
  

socket.request = (type, data = {}) => {
    return new Promise((resolve) => {
        socket.emit(type, data, resolve);
    });
};

socket.on('connect', () => {
    socketID = socket.id;
});

socket.on('sync-peers', (data) => {
    lastPollSyncData = data;
    console.log('sync-peers got', data);
    updateStreamConsumers();
});

function sortPeers(peers) {
    return  Object.entries(peers)
      .map(([id, info]) => ({id, joinTs: info.joinTs, media: { ...info.media }}))
      .sort((a,b) => (a.joinTs>b.joinTs) ? 1 : ((b.joinTs>a.joinTs) ? -1 : 0));
  }

async function updateStreamConsumers(peersInfo = lastPollSyncData) 
{
    //    const data = await socket.request('sync-peer-request');

    console.log('peersInfo', peersInfo);

    if( !peersInfo.hasOwnProperty('peers') )
        return;

    const peerArray = peersInfo.peers;

    if (!Array.isArray(peerArray))
    {
	    if( Object.keys(peerArray).length === 0 ){
            return;
        }
        peerArray = [peepeerArraysInfo];        
    }


    for (let peer of peerArray) {
        if (peer.id === socketID) {
            console.log('skip our own stream?');
            continue;
        }

        console.log('peer', peer);
        
        if( Object.keys(peer.media).length > 0 )
        {
            for (let [mediaTag, info] of Object.entries(peer.media)) {
                console.log('available-track', peer.id, mediaTag, info);
    
                await subscribeToTrack(peer.id, mediaTag);

                /*  $('#available-tracks')
                    .appendChild(makeTrackControlEl(peer.id, mediaTag, info));
                    */
            }
        }
      
    }

}

async function joinRoom() {
    if (joined) {
        return;
    }

    try {
        device = new mediasoup.Device();

        const { routerRtpCapabilities } = await socket.request('join-as-new-peer');
        await device.load({ routerRtpCapabilities });

        console.log('loaded mediasoup device!', routerRtpCapabilities);

        updateStreamConsumers();
    }
    catch (error) {
        console.error(`load errer ${error}`);
    }
}


async function startCamera() {
    if (localCam) {
        return;
    }

    log('start camera');

    try {
        localCam = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
    } catch (e) {
        console.error('start camera error', e);
    }
}


//
// encodings for outgoing video
//

// just two resolutions, for now, as chrome 75 seems to ignore more
// than two encodings
//
const CAM_VIDEO_SIMULCAST_ENCODINGS =
    [
        { maxBitrate: 96000, scaleResolutionDownBy: 4 },
        { maxBitrate: 680000, scaleResolutionDownBy: 1 },
    ];

function camEncodings() {
    return CAM_VIDEO_SIMULCAST_ENCODINGS;
}

// how do we limit bandwidth for screen share streams?
//
function screenshareEncodings() {
    null;
}


export async function getCurrentDeviceId() {
    if (!camVideoProducer) {
        return null;
    }
    let deviceId = camVideoProducer.track.getSettings().deviceId;
    if (deviceId) {
        return deviceId;
    }
    // Firefox doesn't have deviceId in MediaTrackSettings object
    let track = localCam && localCam.getVideoTracks()[0];
    if (!track) {
        return null;
    }
    let devices = await navigator.mediaDevices.enumerateDevices(),
        deviceInfo = devices.find((d) => d.label.startsWith(track.label));
    return deviceInfo.deviceId;
}

async function sendCameraStreams() {
    log('send camera streams');
    //$('#send-camera').style.display = 'none';

    // make sure we've joined the room and started our camera. these
    // functions don't do anything if they've already been called this
    // session
    await joinRoom();
    await startCamera();

    // create a transport for outgoing media, if we don't already have one
    if (!sendTransport) {
        sendTransport = await createTransport('send');
    }

    // start sending video. the transport logic will initiate a
    // signaling conversation with the server to set up an outbound rtp
    // stream for the camera video track. our createTransport() function
    // includes logic to tell the server to start the stream in a paused
    // state, if the checkbox in our UI is unchecked. so as soon as we
    // have a client-side camVideoProducer object, we need to set it to
    // paused as appropriate, too.
    camVideoProducer = await sendTransport.produce({
        track: localCam.getVideoTracks()[0],
        encodings: camEncodings(),
        appData: { mediaTag: 'cam-video' }
    });
    /*
    if (getCamPausedState()) {
      try {
        await camVideoProducer.pause();
      } catch (e) {
        console.error(e);
      }
    }
  */
    // same thing for audio, but we can use our already-created
    camAudioProducer = await sendTransport.produce({
        track: localCam.getAudioTracks()[0],
        appData: { mediaTag: 'cam-audio' }
    });
    /*
    if (getMicPausedState()) {
      try {
        camAudioProducer.pause();
      } catch (e) {
        console.error(e);
      }
    }
  */
    //$('#stop-streams').style.display = 'initial';
    showCameraInfo();
}


// utility function to create a transport and hook up signaling logic
// appropriate to the transport's direction
//
async function createTransport(direction) {
    log(`create ${direction} transport`);

    // ask the server to create a server-side transport object and send
    // us back the info we need to create a client-side transport
    let transport;
    const data = await socket.request('create-transport', { direction });
    if (data.error) {
        log('failed to create trasport on server', data.error);
        return;
    }

    let { transportOptions } = data;
    log('transport options', transportOptions);

    if (direction === 'recv') {
        transport = await device.createRecvTransport(transportOptions);
    }
    else if (direction === 'send') {
        transport = await device.createSendTransport(transportOptions);
    }
    else {
        throw new Error(`bad transport 'direction': ${direction}`);
    }

    // mediasoup-client will emit a connect event when media needs to
    // start flowing for the first time. send dtlsParameters to the
    // server, then call callback() on success or errback() on failure.
    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {

        log('transport connect event', direction);
        let { error } = await socket.request('connect-transport', {
            transportId: transportOptions.id,
            dtlsParameters
        });
        if (error) {
            log('error connecting transport', direction, error);
            errback();
            return;
        }
        callback();
    });

    if (direction === 'send') {
        // sending transports will emit a produce event when a new track
        // needs to be set up to start sending. the producer's appData is
        // passed as a parameter
        transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
            log('transport produce event', appData.mediaTag);

            // we may want to start out paused (if the checkboxes in the ui
            // aren't checked, for each media type. not very clean code, here
            // but, you know, this isn't a real application.)
            let paused = false;
            /*
            if (appData.mediaTag === 'cam-video') 
            {
              paused = getCamPausedState();
            }
            else if (appData.mediaTag === 'cam-audio') 
            {
              paused = getMicPausedState();
            }
            */
            // tell the server what it needs to know from us in order to set
            // up a server-side producer object, and get back a
            // producer.id. call callback() on success or errback() on
            // failure.
            let { error, id } = await socket.request('send-track', {
                transportId: transportOptions.id,
                kind,
                rtpParameters,
                paused,
                appData
            });
            if (error) {
                log('error setting up server-side producer', error);
                errback();
                return;
            }
            callback({ id });
        });
    }

    // for this simple demo, any time a transport transitions to closed,
    // failed, or disconnected, leave the room and reset
    //
    transport.on('connectionstatechange', async (state) => {
        log(`transport ${transport.id} connectionstatechange ${state}`);
        // for this simple sample code, assume that transports being
        // closed is an error (we never close these transports except when
        // we leave the room)
        if (state === 'closed' || state === 'failed' || state === 'disconnected') 
        {
            log('transport closed ... leaving the room and resetting');
            leaveRoom();
        }
        else if( state == 'connected')
        {

        }
    });

    return transport;
}

function findConsumerForTrack(peerId, mediaTag) {
    for( const c of consumers )
    {
        log('consumer peer id', c.appData.peerId );
        
        if ( c.appData.peerId === peerId &&
            c.appData.mediaTag === mediaTag )    
        {
            return c;
        }
    }
}

// note: only subscribe if we don't already have a consumer!
async function subscribeToTrack(peerId, mediaTag) {
    log('subscribe to track', peerId, mediaTag);

    // create a receive transport if we don't already have one
    if (!recvTransport) {
        recvTransport = await createTransport('recv');
    }

    // if we do already have a consumer, we shouldn't have called this
    // method
    let consumer = findConsumerForTrack(peerId, mediaTag);
    if (consumer) {
        log('already have consumer for track', peerId, mediaTag)
        return;
    };

    //log(`consumer not found for ${peerId}, ${consumers}`);
    // ask the server to create a server-side consumer object and send
    // us back the info we need to create a client-side consumer
    let consumerParameters = await socket.request('recv-track', {
        mediaTag,
        mediaPeerId: peerId,
        rtpCapabilities: device.rtpCapabilities
    });
    log('consumer parameters', consumerParameters);
    
    consumer = await recvTransport.consume({
        ...consumerParameters,
        appData: { peerId, mediaTag }
    });
    log('created new consumer', consumer.id);

    // the server-side consumer will be started in paused state. wait
    // until we're connected, then send a resume request to the server
    // to get our first keyframe and start displaying video
    while (recvTransport.connectionState !== 'connected') {
        log('  transport connstate', recvTransport.connectionState);
        await sleep(100);
    }
    // okay, we're ready. let's ask the peer to send us media
    await resumeConsumer(consumer);

    // keep track of all our consumers
    consumers.push(consumer);

    // ui
    await addVideoAudio(consumer, peerId);

}



function addVideoAudio(consumer, peerId) 
{
    if (!(consumer && consumer.track)) 
    {
      return;
    }

    let el = document.createElement(consumer.kind);
    // set some attributes on our audio and video elements to make
    // mobile Safari happy. note that for audio to play you need to be
    // capturing from the mic/camera
    /*
    if (consumer.kind === 'video') {
      el.setAttribute('playsinline', true);
    } else {
      el.setAttribute('playsinline', true);
      el.setAttribute('autoplay', true);
    }*/

    el.setAttribute('playsinline', true);
    el.setAttribute('autoplay', true);

    $(`#videos`).appendChild(el);
    el.srcObject = new MediaStream([ consumer.track.clone() ]);
    el.consumer = consumer;
    el.id = peerId;

    /*
    // let's "yield" and return before playing, rather than awaiting on
    // play() succeeding. play() will not succeed on a producer-paused
    // track until the producer unpauses.
    el.play()
      .then(()=>{})
      .catch((e) => {
        log(e);
      });
      */
  }
  
  function removeVideoAudio(consumer) {
    document.querySelectorAll(consumer.kind).forEach((v) => {
      if (v.consumer === consumer) {
        v.parentNode.removeChild(v);
      }
    });
  }
  
  async function showCameraInfo() {
    let deviceId = await getCurrentDeviceId(),
        infoEl = $('#camera-info');
    if (!deviceId) {
      infoEl.innerHTML = '';
      return;
    }
    let devices = await navigator.mediaDevices.enumerateDevices(),
        deviceInfo = devices.find((d) => d.deviceId === deviceId);
    infoEl.innerHTML = `
        ${ deviceInfo.label }
        <button onclick="Client.cycleCamera()">switch camera</button>
    `;
  }


  async function pauseConsumer(consumer) {
    if (consumer) {
      log('pause consumer', consumer.appData.peerId, consumer.appData.mediaTag);
      try {
        await socket.request('pause-consumer', { consumerId: consumer.id });
        await consumer.pause();
      } catch (e) {
        console.error(e);
      }
    }
  }
  
  async function resumeConsumer(consumer) {
    if (consumer) {
      log('resume consumer', consumer.appData.peerId, consumer.appData.mediaTag);
      try {
        await socket.request('resume-consumer', { consumerId: consumer.id });
        await consumer.resume();
      } catch (e) {
        console.error(e);
      }
    }
  }
  
  async function pauseProducer(producer) {
    if (producer) {
      log('pause producer', producer.appData.mediaTag);
      try {
        await socket.request('pause-producer', { producerId: producer.id });
        await producer.pause();
      } catch (e) {
        console.error(e);
      }
    }
  }
  
  export async function resumeProducer(producer) {
    if (producer) {
      log('resume producer', producer.appData.mediaTag);
      try {
        await socket.request('resume-producer', { producerId: producer.id });
        await producer.resume();
      } catch (e) {
        console.error(e);
      }
    }
  }
  

window.addEventListener('load', () => {
    $('#btn_connect').addEventListener('click', joinRoom);
    $('#startButton').addEventListener('click', sendCameraStreams);
    //    window.addEventListener('beforeunload', () => socket.emit('leave', { peerId }));
})

