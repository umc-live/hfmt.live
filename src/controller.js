import * as soupclient from './soupclient-module';
import io from 'socket.io-client';

const socket = io();
const client = soupclient(socket);

