'use strict';

import * as mediasoupClient from "mediasoup-client";
import io from 'socket.io-client';

const hostname = window.location.hostname;

let device;
let producer;

const socket = io()

socket.request = (type, data = {}) => {
    return new Promise((resolve) => {
        socket.emit(type, data, resolve);
    });
};


socket.on('connect', () => {

});


async function loadDevice(routerRtpCapabilities) {
    try {
        device = new mediasoupClient.Device();
    }
    catch (error) {
        if (error.name === 'UnsupportedError') {
            console.error('browser not supported');
        }
    }

    await device.load({ routerRtpCapabilities });
}

async function connectToSoup() {
    const data = await socket.request('getRouterRtpCapabilities');
    await loadDevice(data);
    console.log('loaded mediasoup device!', data);
}


async function publish(e)
{

    let isWebcam = true;
    const data = await socket.request('createProducerTransport', {
        forceTcp: false,
        rtpCapabilities: device.rtpCapabilities,
    });

    if (data.error) {
        console.error(data.error);
        return;
    }
    

    // Transport
    const transport = device.createSendTransport(data);
    console.log(`received data ${data} and created transport`);

    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        console.log('transport connect');
        
        socket.request('connectProducerTransport', { dtlsParameters })
            .then(callback)
            .catch(errback);
    });

    transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        console.log('transport produce');

        try {
            const { id } = await socket.request('produce', {
                transportId: transport.id,
                kind,
                rtpParameters,
            });
            callback({ id });
        } catch (err) {
            errback(err);
        }
    });

    transport.on('connectionstatechange', (state) => {
        switch (state) {
            case 'connecting':
                console.log('produce connectionstatechange connecting');

                /*
              $txtPublish.innerHTML = 'publishing...';
              $fsPublish.disabled = true;
              $fsSubscribe.disabled = true;
              */
                break;

            case 'connected':
                document.querySelector('#localVideo').srcObject = stream;
                console.log('produce connectionstatechange connected', stream);

                /*
              document.querySelector('#local_video').srcObject = stream;
              $txtPublish.innerHTML = 'published';
              $fsPublish.disabled = true;
              $fsSubscribe.disabled = false;
              */
                break;

            case 'failed':
                console.log('produce failed connection');
                transport.close();
                /*
                $txtPublish.innerHTML = 'failed';
                $fsPublish.disabled = false;
                $fsSubscribe.disabled = true;
                */
                break;

            default: break;
        }
    });


    let stream;
    try 
    {

        stream = await getUserMedia(isWebcam);

        console.log('got stream');
        
        const track = stream.getVideoTracks()[0];
        const params = { track };

        if (0)//$chkSimulcast.checked) 
	    {
            params.encodings = [
                { maxBitrate: 100000 },
                { maxBitrate: 300000 },
                { maxBitrate: 900000 },
            ];
            params.codecOptions = {
                videoGoogleStartBitrate: 1000
            };
        }
        console.log('calling produce with stream tracks');
        
        producer = await transport.produce(params);
    

    }
    catch (err) {
        console.log('failed', err);
    }

    console.log(`-- exit`);

}


async function getUserMedia(isWebcam) {
    if (!device.canProduce('video')) {
        console.error('cannot produce video');
        return;
    }

    let stream;
    try {

        stream = isWebcam ?
            await navigator.mediaDevices.getUserMedia({ video: true }) :
            await navigator.mediaDevices.getDisplayMedia({ video: true });

    }
    catch (err) {
        console.error('getUserMedia() failed:', err.message);
        throw err;
    }

    return stream;

}


async function subscribe() 
{

    console.log('subscribe called');
    
    const data = await socket.request('createConsumerTransport', { forceTcp: false });
    if (data.error) {
        console.error(data.error);
        return;
    }

    const transport = device.createRecvTransport(data);

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {

        socket.request('connectConsumerTransport', {
            transportId: transport.id,
            dtlsParameters
        }).then(callback)
        .catch(errback);

    });

    transport.on('connectionstatechange', async (state) => {

        switch (state) {
            case 'connecting':
                /*
              $txtSubscription.innerHTML = 'subscribing...';
              $fsSubscribe.disabled = true;
              */
                break;

            case 'connected':
                document.querySelector('#remoteVideo').srcObject = await stream;
                await socket.request('resume');
                /*
                $txtSubscription.innerHTML = 'subscribed';
                $fsSubscribe.disabled = true;
                */
                break;

            case 'failed':
                transport.close();
                /*
                $txtSubscription.innerHTML = 'failed';
                $fsSubscribe.disabled = false;
                */
                break;

            default: break;
        }
    });

    const stream = consume(transport);
}

async function consume(transport) 
{
    const { rtpCapabilities } = device;
    const data = await socket.request('consume', { rtpCapabilities });
    const {
      producerId,
      id,
      kind,
      rtpParameters,
    } = data;
  
    let codecOptions = {};
    const consumer = await transport.consume({
      id,
      producerId,
      kind,
      rtpParameters,
      codecOptions,
    });
    
    const stream = new MediaStream();
    stream.addTrack(consumer.track);
    return stream;

  }
  


let connectButton = document.getElementById('btn_connect');
connectButton.addEventListener('click', connectToSoup);

let startButton = document.getElementById('startButton');
startButton.addEventListener('click', publish);

let subscribeButton = document.getElementById('startButton');
subscribeButton.addEventListener('click', subscribe);

//$btnScreen.addEventListener('click', publish);


