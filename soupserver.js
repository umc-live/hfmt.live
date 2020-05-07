/**
 * to do:
 * move all await calls to cluster thread
 * make router part of room
 * close room when there are no people in it (or timeout)
 * 
 */

'use strict';

const http  = require('http');
const express = require('express');
const socketio = require('socket.io');
const mediasoup = require('mediasoup');
const soupconfig = require('./mediasoup.config');

const Room = require('./room')

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

const log = console.log;
const err = console.error;

let worker, router, room, audioLevelObserver;

// log all of this per client eventually
let producer;// = { id: 'default' };
let consumer;
let producerTransport;
let consumerTransport;


async function startMediasoup() 
{
  let _worker = await mediasoup.createWorker({
    logLevel: soupconfig.worker.logLevel,
    logTags: soupconfig.worker.logTags,
    rtcMinPort: soupconfig.worker.rtcMinPort,
    rtcMaxPort: soupconfig.worker.rtcMaxPort,
  });

  _worker.on('died', () => {
    console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', _worker.pid);
    setTimeout(() => process.exit(1), 2000);
  });

  const mediaCodecs = soupconfig.router.mediaCodecs;
  const _router = await _worker.createRouter({ mediaCodecs });
 
//  console.log(`created router with rtpCapabilities: ${JSON.stringify(_router.rtpCapabilities, null, 2)}`);
 
    // audioLevelObserver for signaling active speaker
  //
  const _audioLevelObserver = await _router.createAudioLevelObserver({
		interval: 800
	});
  _audioLevelObserver.on('volumes', (volumes) => {
    const { producer, volume } = volumes[0];
    //log('audio-level volumes event', producer.appData.peerId, volume);
    room.activeSpeaker.producerId = producer.id;
    room.activeSpeaker.volume = volume;
    room.activeSpeaker.peerId = producer.appData.peerId;
  });
  _audioLevelObserver.on('silence', () => {
    //log('audio-level silence event');
    room.activeSpeaker.producerId = null;
    room.activeSpeaker.volume = null;
    room.activeSpeaker.peerId = null;
  });

 return { _worker, _router, _audioLevelObserver }; //, 

}

async function createWebRtcTransport({ peerId, direction }) {

  const transport = await router.createWebRtcTransport({
    ...soupconfig.webRtcTransport,
    appData: { peerId, clientDirection: direction }
  });

  return transport;
}


async function main()
{
  console.log('starting mediasoup');
  let soup = await startMediasoup();

	worker = soup._worker;
	router = soup._router;
	audioLevelObserver = soup._audioLevelObserver;

console.log(`created router with rtpCapabilities: ${JSON.stringify(router.rtpCapabilities, null, 2)}`);

  await new Promise((resolve) => {
    server.listen(3001, '0.0.0.0', () => {
      console.log(`started server, routing from nginx on port 3001`);
      resolve();
    });
  });

  room = new Room();
  console.log(`new roomn with consumers ${room.consumers}`);

}

async function closeProducer(producer) {
  log('closing producer', producer.id, producer.appData);
  try {
    await producer.close();

    room.producers.delete(producer.id);
    /*
    // remove this producer from our room.producers list
    room.producers = room.producers
      .filter((p) => p.id !== producer.id);
  */
    // remove this track's info from our room...mediaTag bookkeeping
    if (room.peers.has(producer.appData.peerId) ) 
    {
      delete room.peers.get(producer.appData.peerId).media[producer.appData.mediaTag];
    }

  } 
  catch (e) 
  {
    err(e);
  }
}

async function closeConsumer(consumer) {
  log('closing consumer', consumer.id, consumer.appData);
  await consumer.close();

  room.consumers.delete(consumer.id);

  // remove this consumer from our room.consumers list
//  room.consumers = room.consumers.filter((c) => c.id !== consumer.id);

  // remove layer info from from our room...consumerLayers bookkeeping
  if (room.peers.has(consumer.appData.peerId)) 
  {
    delete room.peers.get(consumer.appData.peerId).consumerLayers[consumer.id];
  }
}

// consider using socket.io rooms:
// https://socket.io/docs/rooms-and-namespaces/


function broadcastPeersToAll()
{
  io.emit('sync-peers', {
      peers: Array.from( room.peers.values() )
   }); 
}

io.on('connection', (socket) => {

  const peerId = socket.id;
  room.addPeer(peerId);

  console.log("New connection from " + socket.id);


  socket.on('room-message', (data) => {
    io.emit('room-message', {
      from: peerId,
      data
    });
  });

  socket.on('heartbeat', (payload) => {
    payload.nodeName = name;
    socket.emit('heartbeat', payload);
  });

  socket.on('sync-peers-request', (data, callback) => {
    callback({ 
      peers: Array.from( room.peers.values() )
    });
  });

  socket.on('join-as-new-peer', (data, callback) => {
    callback( { routerRtpCapabilities: router.rtpCapabilities });
  });

  socket.on('connect-transport', async (data, callback) => {
    try 
    {
      let { transportId, dtlsParameters } = data;

      let transport = room.transports.get(transportId);
  
      if (!transport) 
      {
        err(`connect-transport: server-side transport ${transportId} not found`);
        callback({ error: `server-side transport ${transportId} not found` });
        return;
      }
  
      log('connect-transport', peerId, transport.appData);
  
      await transport.connect({ dtlsParameters });

      callback({ connected: true });
    } 
    catch (e) 
    {
      console.error('error in /signaling/connect-transport', e);
      callback({ error: e });
    }
  });


  socket.on('create-transport', async (data, callback) => {
    try 
    {
      let { direction } = data;
      log('create-transport', peerId, direction);

      let transport = await createWebRtcTransport({ peerId, direction });
      room.transports.set(transport.id, transport);

      let { id, iceParameters, iceCandidates, dtlsParameters } = transport;
      
      callback({
        transportOptions: { id, iceParameters, iceCandidates, dtlsParameters }
      });

    } catch (e) {
      console.error('error in /signaling/create-transport', e);
      callback({ error: e });
    }
  });

  socket.on('send-track', async (data, callback) => {
    try 
    {
      let { transportId, 
            kind, 
            rtpParameters,
            paused=false, 
            appData } = data;

      let transport = room.transports.get(transportId);
  
      if (!transport) 
      {
        err(`send-track: server-side transport ${transportId} not found`);
        callback({ error: `server-side transport ${transportId} not found`});
        return;
      }
  
      let producer = await transport.produce({
        kind,
        rtpParameters,
        paused,
        appData: { ...appData, peerId, transportId }
      });
  
      // if our associated transport closes, close ourself, too
      producer.on('transportclose', () => {
        log('producer\'s transport closed', producer.id);
        closeProducer(producer);
      });
  
      // monitor audio level of this producer. we call addProducer() here,
      // but we don't ever need to call removeProducer() because the core
      // AudioLevelObserver code automatically removes closed producers
      if (producer.kind === 'audio') 
      {
        audioLevelObserver.addProducer({ producerId: producer.id });
      }
  
      room.producers.set(producer.id, producer);

      room.peers.get(peerId).media[appData.mediaTag] = {
        paused,
        encodings: rtpParameters.encodings
      };
      callback({ id: producer.id });

      broadcastPeersToAll();

      console.log('sending track', room.peers.get(peerId).media[appData.mediaTag]);
      

    } 
    catch (e) 
    {
      console.log('send error', e);
      callback({ error: e });
    }
  });

  socket.on('recv-track', async (data, callback) => {
    try 
    {
      let { mediaPeerId, mediaTag, rtpCapabilities } = data;
    
      let producer;

      for (let value of room.producers.values() ) 
      {
          if (value.appData.mediaTag === mediaTag && value.appData.peerId === mediaPeerId )
          {
            producer = value;
            break;
          }
      }
      
      if (!producer) 
      {
        let msg = `server-side producer for${mediaPeerId}:${mediaTag} not found`;
        err('recv-track: ' + msg);
        callback({ error: msg });
        return;
      }
  
      if ( !router.canConsume({ producerId: producer.id, rtpCapabilities }) ) 
      {
        let msg = `client cannot consume ${mediaPeerId}:${mediaTag}`;
        err(`recv-track: ${peerId} ${msg}`);
        callback({ error: msg });
        return;
      }
  
      let transport;

      for (let value of room.transports.values() ) 
      {
          if (value.appData.peerId === peerId && value.appData.clientDirection === 'recv' )
          {
            transport = value;
            break;
          }
      }

      if (!transport) 
      {
        let msg = `server-side recv transport for ${peerId} not found`;
        err('recv-track: ' + msg);
        callback({ error: msg });
        return;
      }
  
      let consumer = await transport.consume({
        producerId: producer.id,
        rtpCapabilities,
        paused: true, // see note above about always starting paused
        appData: { peerId, mediaPeerId, mediaTag }
      });
  
      // need both 'transportclose' and 'producerclose' event handlers,
      // to make sure we close and clean up consumers in all
      // circumstances
      consumer.on('transportclose', () => {
        log(`consumer's transport closed`, consumer.id);
        closeConsumer(consumer);
      });
      consumer.on('producerclose', () => {
        log(`consumer's producer closed`, consumer.id);
        closeConsumer(consumer);
      });
  
      // stick this consumer in our list of consumers to keep track of,
      // and create a data structure to track the client-relevant state
      // of this consumer
     // console.log(`saving consumer.id ${consumer.id} in ${room.consumers}`);
      room.consumers.set(consumer.id, consumer);
     // console.log(`post saving consumer.id ${consumer.id}`);

      

      room.peers.get(peerId).consumerLayers[consumer.id] = {
        currentLayer: null,
        clientSelectedLayer: null
      };
  
      // update above data structure when layer changes.
      consumer.on('layerschange', (layers) => {
     //   log(`consumer layerschange ${mediaPeerId}->${peerId}`, mediaTag, layers);
        if (room.peers.get(peerId) && room.peers.get(peerId).consumerLayers[consumer.id]) 
        {
            room.peers.get(peerId).consumerLayers[consumer.id].currentLayer = layers && layers.spatialLayer;
        }
      });
        
      callback({
        producerId: producer.id,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused
      });
    } catch (e) {
      console.error('error in /signaling/recv-track', e);
      callback({ error: e });
    }
  });
  
  socket.on('resume-consumer', async (data, callback) => {
    try {
      let { consumerId } = data,
          consumer = room.consumers.get(consumerId);
  
      if (!consumer) 
      {
        err(`pause-consumer: server-side consumer ${consumerId} not found`);
        callback({ error: `server-side consumer ${consumerId} not found` });
        return;
      }
  
      log('resume-consumer', consumer.appData);
  
      await consumer.resume();
  
      callback({ resumed: true });
    } 
    catch (e) 
    {
      console.error('error in /signaling/resume-consumer', e);
      callback({ error: e });
    }
  });
  

  socket.on('leave', async (data, callback) => {
    try 
    {
      
      io.emit('remove-peer', {
        removePeerId: peerId
      });

      await room.removePeer(peerId);
      callback({ left: true });
    } 
    catch (e) 
    {
      console.error('error in /signaling/leave', e);
      callback({ error: e });
    }
  });

  socket.on("disconnect", () => {

    io.emit('remove-peer', {
      removePeerId: peerId
    });
    
    room.removePeer(peerId);
  });

});

main();




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
