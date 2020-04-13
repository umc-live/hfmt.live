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

//let curentSocketIds = [];

io.on('connection', (socket) => {

  console.log("New connection from " + socket.id);
 // curentSocketIds.push(socket.id);

  socket.on('heartbeat', (payload) => {
    payload.nodeName = name;
    socket.emit('heartbeat', payload);
  });

  socket.broadcast.emit('add-users', {
      users: [socket.id]
  });

  socket.on('connect', () => {
      io.emit('add-users', socket.id);
  });

  socket.on('disconnect', () => {
      curentSocketIds.splice(curentSocketIds.indexOf(socket.id), 1);
      io.emit('remove-user', socket.id);
  });

  socket.on('make-offer', (data) => {
      socket.to(data.to).emit('offer-made', {
          offer: data.offer,
          socket: socket.id
      });
  });

  socket.on('make-answer', (data) => {
      socket.to(data.to).emit('answer-made', {
          socket: socket.id,
          answer: data.answer
      });
  });

  socket.on('send-candidate', (data) => {
      socket.to(data.to).emit('candidate-sent', {
          socket: socket.id,
          candidate: data.candidate
      });
  });


  
});



server.listen(3001, '0.0.0.0');
