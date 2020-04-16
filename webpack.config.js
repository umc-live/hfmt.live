const path = require('path');

module.exports = {
  entry: './src/webrtc_test.js',
  output: {
    filename: 'webrtc_test.bundle.js',
    path: path.resolve(__dirname, 'dist/webrtc-test'),
  }
};