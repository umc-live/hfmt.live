
import * as mediasoupClient from "mediasoup-client";
import io from 'socket.io-client';
const socket = io()

const hostname = window.location.hostname;

let device;
let producer;


socket.on('connect', async () => {



    const data = await socket.request('getRouterRtpCapabilities');
    await loadDevice(data);
});

