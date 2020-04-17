
'use strict';

const http  = require('http');
const express = require('express');
const socketio = require('socket.io');
const mediasoup = require('mediasoup');
const soupconfig = require('./mediasoup.config');

/*
  maybe use the args from pm2 later to run multiple servers in parallel
  currently not used
*/
const parseArgs = require('minimist');
const args = parseArgs(process.argv.slice(2));
const { name = 'default', port = '8080'} = args;

const app = express();
const server = http.createServer(app);
const io = socketio(server);


let mediasoupRouter;
let worker;


async function runMediasoupWorker() {
  worker = await mediasoup.createWorker( soupconfig.worker );

  worker.on('died', () => {
    console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
    setTimeout(() => process.exit(1), 2000);
  });

  mediasoupRouter = await worker.createRouter( soupconfig.router.mediaCodecs );
}


async function createWebRtcTransport() {
  
  const { webRtcTransport } = soupconfig.webRtcTransport;
  const transport = await mediasoupRouter.createWebRtcTransport( webRtcTransport );

  if ( webRtcTransport.maxIncomingBitrate ) 
  {
    try 
    {
      await transport.setMaxIncomingBitrate(maxIncomingBitrate);
    } 
    catch (error) 
    {}

  }

  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters
    }
  };
}


async function createConsumer( producer, rtpCapabilities ) 
{
  if ( !mediasoupRouter.canConsume({ producerId: producer.id, rtpCapabilities }) ) 
  {
    console.error('can not consume');
    return;
  }

  try 
  {

    consumer = await consumerTransport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: producer.kind === 'video',
    });

  } 
  catch (error) 
  {
  
    console.error('consume failed', error);
    return;
  }

  if (consumer.type === 'simulcast') {
    await consumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 });
  }

  return {
    producerId: producer.id,
    id: consumer.id,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters,
    type: consumer.type,
    producerPaused: consumer.producerPaused
  };
}


io.on('connection', (socket) => {

  console.log("New connection from " + socket.id);

  socket.on('heartbeat', (payload) => {
    payload.nodeName = name;
    socket.emit('heartbeat', payload);
  });

  socket.on('webrtc-room', (data) => {
    socket.broadcast.emit('message', data); // forward to all
  });


  socket.on('getRouterRtpCapabilities', (data) => {
    socket.emit('routerRtpCapabilities', mediasoupRouter.rtpCapabilities);
  });


});

server.listen(3001, '0.0.0.0');

runMediasoupWorker();


/*

app.get('/', (req, res) => {
  res.send('failed to route static from nginx');
});

// api folder test
app.get('/api/test', (req, res) => {
  res.json({
    headers: req.headers,
    address: req.connection.remoteAddress
  });
});

app.get('/api/name', (req, res) => {
 // console.log('received req');
  res.send('hello api/name');
});
*/
