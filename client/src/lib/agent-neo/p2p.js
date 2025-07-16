// Agent Neo P2P Networking Module
// Handles WebRTC and WebSocket connections for peer-to-peer communication

export class P2PManager {
  constructor(core) {
    this.core = core;
    this.peers = new Map();
    this.connections = new Map();
    this.webSocket = null;
    this.isActive = false;
    this.discoveryInterval = null;
    this.peerConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
    this.throttled = false;
  }

  async init() {
    try {
      await this.initializeWebSocket();
      console.log('P2P Manager initialized');
    } catch (error) {
      console.error('Error initializing P2P Manager:', error);
      throw error;
    }
  }

  async initializeWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.webSocket = new WebSocket(wsUrl);
    
    this.webSocket.onopen = () => {
      console.log('WebSocket connected');
      this.handleWebSocketOpen();
    };
    
    this.webSocket.onmessage = (event) => {
      this.handleWebSocketMessage(event);
    };
    
    this.webSocket.onclose = () => {
      console.log('WebSocket disconnected');
      this.handleWebSocketClose();
    };
    
    this.webSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  handleWebSocketOpen() {
    if (this.isActive) {
      this.startPeerDiscovery();
    }
  }

  handleWebSocketMessage(event) {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'connected':
          this.handleConnectionConfirmation(data);
          break;
        case 'peer_discovered':
          this.handlePeerDiscovered(data);
          break;
        case 'peer_joined':
          this.handlePeerJoined(data);
          break;
        case 'webrtc_offer':
          this.handleWebRTCOffer(data);
          break;
        case 'webrtc_answer':
          this.handleWebRTCAnswer(data);
          break;
        case 'webrtc_candidate':
          this.handleWebRTCCandidate(data);
          break;
        case 'task_bid_received':
          this.handleTaskBid(data);
          break;
        case 'node_status_update':
          this.handleNodeStatusUpdate(data);
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  handleWebSocketClose() {
    // Attempt to reconnect after a delay
    setTimeout(() => {
      if (this.isActive) {
        this.initializeWebSocket();
      }
    }, 5000);
  }

  async start() {
    if (this.isActive) return;
    
    this.isActive = true;
    
    if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
      this.startPeerDiscovery();
    }
    
    console.log('P2P networking started');
  }

  async stop() {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    // Stop peer discovery
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    
    // Close all peer connections
    for (const [peerId, connection] of this.connections) {
      this.closePeerConnection(peerId);
    }
    
    // Close WebSocket
    if (this.webSocket) {
      this.webSocket.close();
    }
    
    console.log('P2P networking stopped');
  }

  startPeerDiscovery() {
    // Announce our presence
    this.announceNode();
    
    // Set up periodic discovery
    this.discoveryInterval = setInterval(() => {
      this.announceNode();
    }, 30000); // Announce every 30 seconds
  }

  announceNode() {
    if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
      this.webSocket.send(JSON.stringify({
        type: 'peer_discovery',
        nodeId: this.core.nodeId,
        nodeName: this.core.configuration.nodeName,
        reputation: 100,
        status: this.core.status,
        timestamp: Date.now()
      }));
    }
  }

  handleConnectionConfirmation(data) {
    console.log('Connection confirmed:', data.clientId);
  }

  handlePeerDiscovered(data) {
    const peerId = data.nodeId;
    
    if (peerId === this.core.nodeId) return; // Don't connect to ourselves
    
    if (!this.peers.has(peerId)) {
      this.peers.set(peerId, {
        id: peerId,
        name: data.nodeName,
        reputation: data.reputation,
        status: data.status,
        lastSeen: Date.now()
      });
      
      // Attempt WebRTC connection
      this.initiateWebRTCConnection(peerId);
    }
  }

  handlePeerJoined(data) {
    const peer = data.peer;
    this.peers.set(peer.peerId, {
      id: peer.peerId,
      name: peer.nodeId,
      reputation: peer.reputation,
      status: peer.status,
      lastSeen: Date.now()
    });
  }

  async initiateWebRTCConnection(peerId) {
    if (this.connections.has(peerId)) return;
    
    try {
      const peerConnection = new RTCPeerConnection(this.peerConfig);
      this.connections.set(peerId, peerConnection);
      
      // Set up event handlers
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendWebRTCCandidate(peerId, event.candidate);
        }
      };
      
      peerConnection.onconnectionstatechange = () => {
        console.log(`Connection state with ${peerId}:`, peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          this.handlePeerConnected(peerId);
        } else if (peerConnection.connectionState === 'failed') {
          this.handlePeerDisconnected(peerId);
        }
      };
      
      peerConnection.ondatachannel = (event) => {
        this.handleDataChannel(peerId, event.channel);
      };
      
      // Create data channel
      const dataChannel = peerConnection.createDataChannel('agentNeo', {
        ordered: true
      });
      
      this.handleDataChannel(peerId, dataChannel);
      
      // Create offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      this.sendWebRTCOffer(peerId, offer);
      
    } catch (error) {
      console.error('Error initiating WebRTC connection:', error);
      this.connections.delete(peerId);
    }
  }

  handleDataChannel(peerId, channel) {
    channel.onopen = () => {
      console.log(`Data channel opened with ${peerId}`);
    };
    
    channel.onmessage = (event) => {
      this.handlePeerMessage(peerId, JSON.parse(event.data));
    };
    
    channel.onclose = () => {
      console.log(`Data channel closed with ${peerId}`);
    };
    
    // Store channel reference
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.dataChannel = channel;
    }
  }

  handlePeerMessage(peerId, message) {
    switch (message.type) {
      case 'task_bid':
        this.core.tasks.handlePeerTaskBid(peerId, message);
        break;
      case 'ethics_check':
        this.core.ethics.handlePeerEthicsCheck(peerId, message);
        break;
      case 'resource_share':
        this.handleResourceShare(peerId, message);
        break;
      default:
        console.log('Unknown peer message:', message);
    }
  }

  sendWebRTCOffer(peerId, offer) {
    if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
      this.webSocket.send(JSON.stringify({
        type: 'webrtc_offer',
        fromNodeId: this.core.nodeId,
        toNodeId: peerId,
        offer: offer
      }));
    }
  }

  sendWebRTCAnswer(peerId, answer) {
    if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
      this.webSocket.send(JSON.stringify({
        type: 'webrtc_answer',
        fromNodeId: this.core.nodeId,
        toNodeId: peerId,
        answer: answer
      }));
    }
  }

  sendWebRTCCandidate(peerId, candidate) {
    if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
      this.webSocket.send(JSON.stringify({
        type: 'webrtc_candidate',
        fromNodeId: this.core.nodeId,
        toNodeId: peerId,
        candidate: candidate
      }));
    }
  }

  async handleWebRTCOffer(data) {
    const peerId = data.fromNodeId;
    
    if (peerId === this.core.nodeId) return;
    
    try {
      let peerConnection = this.connections.get(peerId);
      
      if (!peerConnection) {
        peerConnection = new RTCPeerConnection(this.peerConfig);
        this.connections.set(peerId, peerConnection);
        
        // Set up event handlers
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            this.sendWebRTCCandidate(peerId, event.candidate);
          }
        };
        
        peerConnection.onconnectionstatechange = () => {
          if (peerConnection.connectionState === 'connected') {
            this.handlePeerConnected(peerId);
          } else if (peerConnection.connectionState === 'failed') {
            this.handlePeerDisconnected(peerId);
          }
        };
        
        peerConnection.ondatachannel = (event) => {
          this.handleDataChannel(peerId, event.channel);
        };
      }
      
      await peerConnection.setRemoteDescription(data.offer);
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      this.sendWebRTCAnswer(peerId, answer);
      
    } catch (error) {
      console.error('Error handling WebRTC offer:', error);
    }
  }

  async handleWebRTCAnswer(data) {
    const peerId = data.fromNodeId;
    const peerConnection = this.connections.get(peerId);
    
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(data.answer);
      } catch (error) {
        console.error('Error handling WebRTC answer:', error);
      }
    }
  }

  async handleWebRTCCandidate(data) {
    const peerId = data.fromNodeId;
    const peerConnection = this.connections.get(peerId);
    
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(data.candidate);
      } catch (error) {
        console.error('Error handling WebRTC candidate:', error);
      }
    }
  }

  handlePeerConnected(peerId) {
    console.log(`Peer connected: ${peerId}`);
    
    // Register peer in backend
    this.registerPeer(peerId);
  }

  handlePeerDisconnected(peerId) {
    console.log(`Peer disconnected: ${peerId}`);
    
    // Clean up connection
    this.closePeerConnection(peerId);
  }

  async registerPeer(peerId) {
    try {
      const peerData = {
        peerId: peerId,
        nodeId: this.core.nodeId,
        reputation: 50,
        status: 'connected',
        metadata: {
          connectedAt: Date.now(),
          connectionType: 'webrtc'
        }
      };

      await fetch('/api/peers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(peerData)
      });
    } catch (error) {
      console.error('Error registering peer:', error);
    }
  }

  closePeerConnection(peerId) {
    const connection = this.connections.get(peerId);
    if (connection) {
      if (connection.dataChannel) {
        connection.dataChannel.close();
      }
      connection.close();
      this.connections.delete(peerId);
    }
    this.peers.delete(peerId);
  }

  sendToPeer(peerId, message) {
    const connection = this.connections.get(peerId);
    if (connection && connection.dataChannel && connection.dataChannel.readyState === 'open') {
      connection.dataChannel.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  broadcast(message) {
    let sent = 0;
    for (const peerId of this.connections.keys()) {
      if (this.sendToPeer(peerId, message)) {
        sent++;
      }
    }
    return sent;
  }

  getPeerCount() {
    return this.connections.size;
  }

  getPeers() {
    return Array.from(this.peers.values());
  }

  throttle() {
    this.throttled = true;
    // Reduce connection frequency
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = setInterval(() => {
        this.announceNode();
      }, 60000); // Announce every 60 seconds when throttled
    }
  }

  onNodeStatusChange(status) {
    // Handle node status changes
    if (status === 'stopped') {
      this.stop();
    } else if (status === 'started') {
      this.start();
    }
  }

  handleTaskBid(data) {
    this.core.tasks.handleNetworkTaskBid(data);
  }

  handleNodeStatusUpdate(data) {
    const peerId = data.nodeId;
    if (this.peers.has(peerId)) {
      const peer = this.peers.get(peerId);
      peer.status = data.status;
      peer.lastSeen = Date.now();
    }
  }

  handleResourceShare(peerId, message) {
    // Handle resource sharing between peers
    console.log('Resource share from peer:', peerId, message);
  }
}
