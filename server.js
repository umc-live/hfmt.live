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

io.on('connection', (socket) => {

  console.log("New connection from " + socket.id);

  socket.on('heartbeat', (payload) => {
    payload.nodeName = name;
    socket.emit('heartbeat', payload);
  });

  socket.on('room', (data) => {
    socket.broadcast.emit('message', data); // forward to all
  });


});

server.listen(3001, '0.0.0.0');


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
