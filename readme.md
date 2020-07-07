
# hfmt.live
`hfmt.live` is a web-based platform aming to enable creative uses of audio/video media streams, supported by the Hochschule für Musik und Theater Hamburg, as part of the Digital Stage project, initiated during the Covid-19 pandemic, with additional generous support from Digital Ocean's Covid development initiative.

The system provides a wrapper for WebRTC media streams using Mediasoup SFU as an unerlying media router.

There is a default view for the page, but the system was designed to host user designed HTML pages (+CSS/JS), so the display layout and usage of the system has no (or very minimal) use restrictions.

JSON files may also be used, using the [drawsocket](https://github.com/HfMT-ZM4/drawsocket) system designed for dynamic score display.

## Basic use
*please note: `hfmt.live` is very much an experimental developmental project! this code is possibly unstable and subject to change unexpectedly!*

The `hfmt.live` server uses the URL to specify a "room", where users may send and receive media streams, as well as messages via Websockets, and may also share files with each other that change the view of the page.

For example, [https://hfmt.live/demo](https://hfmt.live/demo) enters the room "demo". Any user who enters the room "demo" can join and stream their audio and video. At the moment there is no authentication, but this may change in the nearish future.

### Default Page
In the default page, there are buttons for `Connect`, `Start Webcam`, `Share Score`, and `drawsocket-msg-out`.

* `connect`: connects to the room feeds, without starting the webcam.
* `start webcam`: opens the webcam and microphone, and joins the room media streams if not already joined.
* `share score`: send a file to all users in the room, either HTML or JSON file in [drawsocket](https://github.com/HfMT-ZM4/drawsocket) format. 
  
  On receiving a new file, the dropdown menu will be updated to include either the name of the HTML file, or a list of drawsocket prefixes included in the file (for example, there might be entries for different instruments in a score file). On selection of a prefix, or file, the display of the webpage will be updated with the instructions contained in the file.

* `drawsocket-msg-out`: clicking this button will open a text entry box that allows you to send drawsocket messages to the other users in the room, which can change the display in realtime.

### Custom Display

Alternatively, users may supply a URL parameter `get` to specify a page view file directly, circumventing the `Send Score` system.

For example, [https://hfmt.live/demo?get=https://raw.githubusercontent.com/HfMT-ZM4/hfmt.live/master/test-user-webgl.html](https://hfmt.live/demo?get=https://raw.githubusercontent.com/HfMT-ZM4/hfmt.live/master/test-user-webgl.html), enters the room namespace "demo", and request to load the file `test-user-webgl.html` stored in the `hfmt.live` github repository. When users connect to the media stream, the videa feeds are used as textures for an webgl cube spinning on the page.

In this way, links can be used to set custom displays without needing the files to be stored locally on the server. Note, that the files need to be on servers that allow [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS), as used by the github "raw" pages.

## API

The `hfmt.live` wrapper API uses of the [drawsocket](https://github.com/HfMT-ZM4/drawsocket) object, stored in the global `window` namespace, with some additional functions for handling media streams:

* `drawsocket.getMediaStreams()`: returns a object of media streams, sorted by video and audio. Useful for initialization on load, to get list of current streams active in the room.
    ```
    {
        video: [ v_stream1, v_stream2, etc.],
        audio: [ a_stream1, a_stream2, etc.]        
    }
    ```
* `drawsocket.on_newPeerStream`: callback function for handling new media streams. Returning a non-zero value prevents the default handler from being called. Arguments:
  * `stream`: the media stream object
  * `kind`: a string, either "audio" or "video"
  * `id`: the unique id associated with the user sending the stream.
 
  ```
  drawsocket.on_newPeerStream = async (stream, kind, id) => {
    return 1;
  }
  ```

* `drawsocket.on_newLocalStream`: callback function for handling new media streams created on the local machine. Returning a non-zero value prevents the default handler from being called. Arguments:
  * `stream`: the media stream object
  ```
  drawsocket.on_newLocalStream = async (stream) => {
    return 1;
  }
  ```

* `drawsocket.on_removedPeerStream`: callback function for handling removal of media streams. Returning a non-zero value prevents the default handler from being called. Arguments:
  * `id`: the unique id associated with the user sending the stream.
  ```
  drawsocket.on_removedPeerStream = async (id) => {
    return 1;
  }
  ```

For a reference use case, please see [quintetnet-video.html](https://github.com/HfMT-ZM4/hfmt.live/blob/master/quintetnet-video.html).

## Installation on a new server

hfmt.live is currently running on a Digital Ocean Droplet, and may be used as a service there. The system is also fully open source, and so may be deployed on other servers. This repository includes all of the files required to install a new instance of the system on another Linux server, with the exception of the security key files. 

Documentation will be added here in the near future.


