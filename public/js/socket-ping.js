'use strict';

let url = window.location.pathname;
if( url.includes('.html') )
{
  url = url.slice(0, url.indexOf('.html') );
}

console.log(`url: ${url}, window location: ${window.location}`);


let oscprefix = window.location.pathname; // document.getElementById("OSC").getAttribute("OSCprefix");
if (oscprefix.includes('.html')) {
  oscprefix = oscprefix.slice(0, oscprefix.indexOf('.html'));
}

console.log('loading with namespace', oscprefix);

const sock = io(`/namespace-${oscprefix}`);

//const sock = io();

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

setInterval( ()=>{
  sock.emit('message', {
    msg: `hello from ${sock.id}`
  });
}, 1000);

const onHeartbeat = (payload) => {
  //console.log('received heartbeat');
  const roundtripTime = Date.now() - payload.timestamp;
  const { nodeName } = payload;
  //log.innerHTML = `[${nodeName}]: ${roundtripTime}ms`;
  log.innerHTML = `client-server websocket ping round trip ${roundtripTime}ms`;
};

sock.on('heartbeat', onHeartbeat);


