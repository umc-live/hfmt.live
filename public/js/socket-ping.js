const sock = io();

sock.on('connect', () => {
  console.log('socket.io connected');
  sendHeartbeat();

});

const log = document.getElementById('log');

sock.on('message', (m) => { 
  console.log('received', m);
  log.innerHTML = m; 
});
 

const sendHeartbeat = () => {
  sock.emit('heartbeat', {
    timestamp: Date.now()
  });
};

setInterval(sendHeartbeat, 100);

const onHeartbeat = (payload) => {
  //console.log('received heartbeat');
  const roundtripTime = Date.now() - payload.timestamp;
  const { nodeName } = payload;
  //log.innerHTML = `[${nodeName}]: ${roundtripTime}ms`;
  log.innerHTML = `client-server websocket ping round trip ${roundtripTime}ms`;
};

sock.on('heartbeat', onHeartbeat);

