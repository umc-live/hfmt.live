
import * as mediasoupClient from "mediasoup-client";
import io from 'socket.io-client';

const socket = io()

socket.request = (type, data = {}) => {
    return new Promise((resolve) => {
      socket.emit(type, data, resolve);
    });
};

const hostname = window.location.hostname;

let device;
let producer;

async function loadDevice(routerRtpCapabilities) 
{
    try 
    {
      device = new mediasoupClient.Device();
    } 
    catch (error) 
    {
      if (error.name === 'UnsupportedError') 
      {
        console.error('browser not supported');
      }
    }

    await device.load({ routerRtpCapabilities });
}

socket.on('connect', async () => {
    // init call

    const data = await socket.request('getRouterRtpCapabilities');
    await loadDevice(data);
    console.log('loaded mediasoup device!', data);
/*
    socket.emit('getRouterRtpCapabilities', {});
    console.log('connected, and requesting getRouterRtpCapabilities');
    */
});

// init response
socket.on('routerRtpCapabilities', async (data) => {
    await loadDevice( data );
    console.log('loaded mediasoup device!', data);
});


// call
function startSendTransport() 
{
   socket.emit('createProducerTransport', {
      forceTcp: false,
      rtpCapabilities: device.rtpCapabilities,
    });
}
// response
socket.on('producerTransportParams', (data) => {

    const transport = device.createSendTransport(data);
    transport.on('connect', async ( { dtlsParameters }, callback, errback) => {
      socket.request('connectProducerTransport', { dtlsParameters })
        .then(callback)
        .catch(errback);
    });

});

