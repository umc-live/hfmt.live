// currently using the examples found online, but probably we don't want to await in the main server loop here

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


let worker, router, audioLevelObserver;

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
    console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
    setTimeout(() => process.exit(1), 2000);
  });

  const { mediaCodecs } = soupconfig.router.mediaCodecs;
  const _router = await _worker.createRouter({ mediaCodecs });
 
  console.log(`created router with rtpCapabilities: ${JSON.stringify(_router.rtpCapabilities)}`);
  

    // audioLevelObserver for signaling active speaker
  //
  const _audioLevelObserver = await router.createAudioLevelObserver({
		interval: 800
	});
  _audioLevelObserver.on('volumes', (volumes) => {
    const { producer, volume } = volumes[0];
    log('audio-level volumes event', producer.appData.peerId, volume);
    roomState.activeSpeaker.producerId = producer.id;
    roomState.activeSpeaker.volume = volume;
    roomState.activeSpeaker.peerId = producer.appData.peerId;
  });
  _audioLevelObserver.on('silence', () => {
    log('audio-level silence event');
    roomState.activeSpeaker.producerId = null;
    roomState.activeSpeaker.volume = null;
    roomState.activeSpeaker.peerId = null;
  });

 return { _worker, _router, _audioLevelObserver }; //, 

}

async function main()
{
  console.log('starting mediasoup');
  ( { worker, router, audioLevelObserver } = await startMediasoup() );
/*
  await new Promise((resolve) => {
    server.listen(3001, '0.0.0.0', () => {
      console.log(`started server, routing from nginx on port 3001`);
      resolve();
    });
  });
*/
}


async function createWebRtcTransport() 
{
  
  const { webRtcTransport } = soupconfig;
// console.log('webRtcTransport', webRtcTransport);
  
  const transport = await router.createWebRtcTransport( webRtcTransport );

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
  if ( !router.canConsume({ producerId: producer.id, rtpCapabilities }) ) 
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


  console.log(`consumer ${JSON.stringify(consumer, null, 2)}`); 

  return {
    producerId: producer.id,
    id: consumer.id,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters,
    type: consumer.type,
    producerPaused: consumer.producerPaused
  };
}


async function cosumerTransportAddProducer( _consumerTransport, _producer, _rtpCapabilities ) 
{
  if ( !router.canConsume({ producerId: _producer.id, _rtpCapabilities }) ) 
  {
    console.error('can not consume');
    return;
  }

  try 
  {

    let newComsumer = await _consumerTransport.consume({
      producerId: _producer.id,
      _rtpCapabilities,
      paused: _producer.kind === 'video',
    });

    if ( newComsumer.type === 'simulcast') {
      await newComsumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 });
    }
  
  
    console.log(`consumer ${newComsumer}`);

    return newComsumer;
  } 
  catch (error) 
  {
  
    console.error('consume failed', error);
    return;
  }


  

  return {
    producerId: _producer.id,
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

  socket.on('getRouterRtpCapabilities', (data, callback) => {
    callback( router.rtpCapabilities );
  });

  socket.on('createProducerTransport', async (data, callback) => {
    try 
    {
      const { transport, params } = await createWebRtcTransport();
      producerTransport = transport;
      callback(params);
    } 
    catch (err) 
    {
      console.error(err);
      callback({ error: err.message });
    }
  });

  socket.on('createConsumerTransport', async (data, callback) => {
    try 
    {
      const { transport, params } = await createWebRtcTransport();
      consumerTransport = transport;
      callback(params);
    } 
    catch (err) 
    {
      console.error(err);
      callback({ error: err.message });
    }
  });

  socket.on('connectProducerTransport', async (data, callback) => {
    await producerTransport.connect({ dtlsParameters: data.dtlsParameters });
    callback();
  });

  socket.on('connectConsumerTransport', async (data, callback) => {
    await consumerTransport.connect({ dtlsParameters: data.dtlsParameters });
    callback();
  });

  socket.on('produce', async (data, callback) => {
    const {kind, rtpParameters} = data;
    producer = await producerTransport.produce({ kind, rtpParameters });
    callback({ id: producer.id });

    // inform clients about new producer
    socket.broadcast.emit('newProducer');
  });

  socket.on('consume', async (data, callback) => {
    try
    {
      callback(await createConsumer(producer, data.rtpCapabilities))
    }
    catch(err)
    {
      console.error('consume error', err);
      callback({ error: err.message });
    }
  });

  socket.on('resume', async (data, callback) => {
    console.log('socket resume');
    await consumer.resume();
    callback();
  });

});


server.listen(3001, '0.0.0.0');
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
