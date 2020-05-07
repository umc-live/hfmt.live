import * as soupclient from './soupclient-module';
import io from 'socket.io-client';

const socket = io();

socket.on('connect', () => {
    console.log('test 2');
});

socket.on('sync-peers', (data) => {
    console.log('sync-peers also got');
});

soupclient.init(socket);

