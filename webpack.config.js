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
            path: path.resolve(__dirname, 'public/webrtc-test/js'),
        }
    },
    {
        entry: './src/mediasoup_test.js',
        output: {
            filename: 'medisoup_test.bundle.js',
            path: path.resolve(__dirname, 'public/mediasoup-test/js'),
        },
        optimization: {
            minimize: false
        },
    }, {
        entry: './src/controller.js',
        output: {
            filename: 'soupclient.bundle.js',
            path: path.resolve(__dirname, 'public/soup/js'),
        },
        optimization: {
            minimize: false
        },
    }, {
        entry: './src/controller_root.js',
        output: {
            filename: 'root.drawsocket.bundle.js',
            path: path.resolve(__dirname, 'public/js'),
        },
        optimization: {
            minimize: false
        },
    }]