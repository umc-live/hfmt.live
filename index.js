'use strict';

const http  = require('http');
const express = require('express');
const socketio = require('socket.io');
const parseArgs = require('minimist');

const args = parseArgs(process.argv.slice(2));
const { name = 'default', port = '8080'} = args;

const app = express();
const server = http.createServer(app);

const io = socketio(server);

app.get('/', (req, res) => {
  res.send('failed to route static from nginx');
});

//app.use('/scripts', express.static(__dirname + '/node_modules/'));

app.get('/api/test', (req, res) => {
//  res.send('hello api/test');
//  console.log('received req');
  res.json({
    headers: req.headers,
    address: req.connection.remoteAddress
  });

});

app.get('/api/name', (req, res) => {
 // console.log('received req');
  res.send('hello api/name');

//  res.json({ name });
});


io.on('connection', (sock) => {
  console.log('Client connected');

  sock.send("hello there!");

  sock.on('heartbeat', (payload) => {
    payload.nodeName = name;
    sock.emit('heartbeat', payload);
  });

  sock.on('disconnect', () => {
    console.log('Socket Disconnected');
  });
});



server.listen(3001, '0.0.0.0');
