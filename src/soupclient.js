'use strict';

import * as mediasoup from "mediasoup-client";
import io from 'socket.io-client';

//import deepEqual from 'deep-equal';

const log = console.log;

const hostname = window.location.hostname;
const $ = document.querySelector.bind(document);


$('#btn_connect').addEventListener('click', joinRoom);
$('#startButton').addEventListener('click', sendCameraStreams);
$('#btn_subscribe').addEventListener('click', joinRoom);

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
    consumers = new Map();


// consumers are links to peers, stored by id
// the consumers are links to the media streams, produced by the transport


socket.request = (type, data = {}) => {
    return new Promise((resolve) => {
        socket.emit(type, data, resolve);
    });
};

socket.on('connect', () => {
    socketID = socket.id;
});



async function updateStreamConsumers()
{
    const { peerIds } = await socket.request('sync');

    console.log('sync got', peerIds);
    // update consumer Map in case of new or missing peers    

}

async function joinRoom()
{
    if( joined ){
        return;
    }

    try {
        device = new mediasoup.Device();

        const { routerRtpCapabilities } = await socket.request('join-as-new-peer');
        await device.load({ routerRtpCapabilities });

        console.log('loaded mediasoup device!', data);

        updateStreamConsumers();
    }
    catch (error) {
        console.error(`load errer ${error}`);
    }
}



async function sendCameraStreams() 
{
    log('send camera streams');
    $('#send-camera').style.display = 'none';
  
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
    if (getCamPausedState()) {
      try {
        await camVideoProducer.pause();
      } catch (e) {
        console.error(e);
      }
    }
  
    // same thing for audio, but we can use our already-created
    camAudioProducer = await sendTransport.produce({
      track: localCam.getAudioTracks()[0],
      appData: { mediaTag: 'cam-audio' }
    });
    if (getMicPausedState()) {
      try {
        camAudioProducer.pause();
      } catch (e) {
        console.error(e);
      }
    }
  
    $('#stop-streams').style.display = 'initial';
    showCameraInfo();
  }
  

// utility function to create a transport and hook up signaling logic
// appropriate to the transport's direction
//
async function createTransport(direction) {
    log(`create ${direction} transport`);
  
    // ask the server to create a server-side transport object and send
    // us back the info we need to create a client-side transport
    let transport,
        { transportOptions } = await socket.request('create-transport', { direction });
    log ('transport options', transportOptions);
  
    if (direction === 'recv') {
      transport = await device.createRecvTransport(transportOptions);
    } else if (direction === 'send') {
      transport = await device.createSendTransport(transportOptions);
    } else {
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
        err('error connecting transport', direction, error);
        errback();
        return;
      }
      callback();
    });
  
    if (direction === 'send') {
      // sending transports will emit a produce event when a new track
      // needs to be set up to start sending. the producer's appData is
      // passed as a parameter
      transport.on('produce', async ({ kind, rtpParameters, appData },
                                     callback, errback) => {
        log('transport produce event', appData.mediaTag);
        // we may want to start out paused (if the checkboxes in the ui
        // aren't checked, for each media type. not very clean code, here
        // but, you know, this isn't a real application.)
        let paused = false;
        if (appData.mediaTag === 'cam-video') {
          paused = getCamPausedState();
        } else if (appData.mediaTag === 'cam-audio') {
          paused = getMicPausedState();
        }
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
          err('error setting up server-side producer', error);
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
      if (state === 'closed' || state === 'failed' || state === 'disconnected') {
        log('transport closed ... leaving the room and resetting');
        leaveRoom();
      }
    });
  
    return transport;
  }
  