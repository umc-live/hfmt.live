/**
 * check this out later: https://webpack-config-plugins.js.org
 *
 * to do: add new target here for mediasoup
 * maybe nicer to make a completely different folder (and server) for each sub project
 * 
 *  */


const path = require('path');

module.exports = [
    {
        entry: './src/webrtc_test.js',
        output: {
            filename: 'webrtc_test.bundle.js',
            path: path.resolve(__dirname, 'dist/webrtc-test'),
        }
    },
    {
        entry: './src/mediasoup_test.js',
        output: {
            filename: 'medisoup_test.bundle.js',
            path: path.resolve(__dirname, 'dist/mediasoup-test'),
        }
    }]