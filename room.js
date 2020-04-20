// server side group info, for updating new arrivals and exiting users
// each user gets an array of peer media when they subscribe
// optionally they can also produce media

'use strict';

// does each room need a spearate router?

class Room {
    constructor(){
        this.name = 'roomname';

        // lookup by socket id
        this.peers = new Map();
        this.stats = new Map();
        this.transports = new Map();
        this.producers = new Map();
        this.consumers - new Map();

    };

    getIds()
    {
      return [...this.peers.keys()];
    }

    addPeer (id, socket, displayName = "", device={}, rtpCapabilities={})
    {
        this.peers.set(id, 
        {
            id: id,
            media: {},
            socket: socket,
            data :
            {
                displayName: displayName,
                device :
                {
                    flag    : 'broadcaster',
                    name    : device.name || 'Unknown device',
                    version : device.version
                },
                rtpCapabilities: rtpCapabilities,
                transports    : new Map(),
                producers     : new Map(),
                consumers     : new Map(),
                dataProducers : new Map(),
                dataConsumers : new Map()
            }
        });
        return this.peers.get(id);
    }


    async removePeer(_id)
    {
      console.log('removing peer');

      this.transports.forEach(async (t, key) => {
        if( t.appData.peerId == _id )
        {
          await t.close();
          this.transports.delete(key);
        }
      });

      this.peers.delete(_id);
    }

    announcePeer( id )
    {
        if( this.peers.has(id) )
        {
            const peer = this.peers.get(id);
            peer.socket.broadcast.emit('new-peer', {
                id: peer.id,
                rtpCapabilities: peer.rtpCapabilities
            });
        }
    }



    async updatePeerStats() 
    {
    for (let producer of roomState.producers) {
      if (producer.kind !== 'video') {
        continue;
      }
      try {
        let stats = await producer.getStats(),
            peerId = producer.appData.peerId;
        roomState.peers[peerId].stats[producer.id] = stats.map((s) => ({
          bitrate: s.bitrate,
          fractionLost: s.fractionLost,
          jitter: s.jitter,
          score: s.score,
          rid: s.rid
        }));
      } catch (e) {
        warn('error while updating producer stats', e);
      }
    }
  
    for (let consumer of roomState.consumers) {
      try {
        let stats = (await consumer.getStats())
                      .find((s) => s.type === 'outbound-rtp'),
            peerId = consumer.appData.peerId;
        if (!stats || !roomState.peers[peerId]) {
          continue;
        }
        roomState.peers[peerId].stats[consumer.id] = {
          bitrate: stats.bitrate,
          fractionLost: stats.fractionLost,
          score: stats.score
        }
      } catch (e) {
        warn('error while updating consumer stats', e);
      }
    }
  }

}

module.exports = Room;
