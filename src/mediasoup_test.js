
import * as mediasoupClient from "mediasoup-client";
import io from 'socket.io-client';
const socket = io()

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
  


socket.on('connect', () => {
    console.log('connected, and requesting getRouterRtpCapabilities');

    socket.emit('getRouterRtpCapabilities');

});

socket.on('routerRtpCapabilities', async (data) => {
    await loadDevice( data );

    console.log('loaded mediasoup device!');
    
});
