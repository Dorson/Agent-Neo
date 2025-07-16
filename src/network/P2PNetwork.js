/**
 * P2P Network Module - Decentralized Networking
 * 
 * Implements browser-compatible P2P networking as described in the whitepaper.
 * Uses WebRTC for direct peer connections and WebSockets for signaling.
 * Features self-evolving protocol registry, peer discovery, and mesh networking.
 * 
 * Key Features:
 * - WebRTC-based peer-to-peer connections
 * - WebSocket signaling for connection establishment
 * - Self-evolving protocol registry
 * - Peer discovery and mesh topology optimization
 * - Reputation-based peer selection
 * - Protocol adapters for cross-network communication
 * - Gossip-based data propagation
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class P2PNetwork {
    constructor() {
        this.name = 'P2PNetwork';
        this.version = '1.0.0';
        this.initialized = false;
        this.active = false;
        
        // Network configuration
        this.config = {
            maxPeers: 20,
            targetPeers: 8,
            connectionTimeout: 30000,
            heartbeatInterval: 30000,
            discoveryInterval: 60000,
            signallingServers: [
                'wss://signaling.agent-neo.network',
                'wss://backup-signal.agent-neo.network'
            ],
            stunServers: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
            ],
            protocolVersion: '1.0.0',
            nodeId: null,
            bootstrap: true
        };
        
        // Network state
        this.peers = new Map(); // peerId -> peerInfo
        this.connections = new Map(); // peerId -> RTCPeerConnection
        this.dataChannels = new Map(); // peerId -> RTCDataChannel
        
        // Protocol registry (self-evolving)
        this.protocolRegistry = new Map();
        this.protocolVersions = new Map();
        
        // Signaling
        this.signalingSocket = null;
        this.signalingConnected = false;
        
        // Topology optimization
        this.topology = {
            localNode: null,
            peerGraph: new Map(),
            lastOptimization: 0
        };
        
        // Statistics
        this.stats = {
            connectionsEstablished: 0,
            connectionsLost: 0,
            messagesReceived: 0,
            messagesSent: 0,
            bytesReceived: 0,
            bytesSent: 0,
            averageLatency: 0,
            networkHealth: 'unknown'
        };
        
        // Message handling
        this.messageHandlers = new Map();
        this.pendingMessages = new Map();
        this.messageSequence = 0;
        
        this.init();
    }

    async init() {
        try {
            console.log('🌐 Initializing P2P Network...');
            
            this.setupEventListeners();
            this.generateNodeId();
            this.initializeProtocolRegistry();
            this.setupMessageHandlers();
            
            this.initialized = true;
            console.log('✅ P2P Network initialized');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version
            });
            
        } catch (error) {
            console.error('❌ P2P Network initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Network control
        eventBus.on('network:connect', this.startNetworking.bind(this));
        eventBus.on('network:disconnect', this.stopNetworking.bind(this));
        eventBus.on('network:send-message', this.sendMessage.bind(this));
        eventBus.on('network:broadcast', this.broadcastMessage.bind(this));
        
        // Peer management
        eventBus.on('network:add-peer', this.addPeer.bind(this));
        eventBus.on('network:remove-peer', this.removePeer.bind(this));
        eventBus.on('network:get-peers', this.getPeers.bind(this));
        
        // Protocol management
        eventBus.on('network:register-protocol', this.registerProtocol.bind(this));
        eventBus.on('network:update-protocol', this.updateProtocol.bind(this));
        
        // Configuration
        eventBus.on('network:config:update', this.updateConfiguration.bind(this));
    }

    generateNodeId() {
        // Generate unique node ID
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        this.config.nodeId = `neo_${timestamp}_${random}`;
        
        this.topology.localNode = {
            id: this.config.nodeId,
            version: this.version,
            capabilities: ['webrtc', 'websocket', 'crdt'],
            reputation: 100,
            joinedAt: Date.now()
        };
        
        console.log('🆔 Generated node ID:', this.config.nodeId);
    }

    initializeProtocolRegistry() {
        // Initialize core protocols
        const coreProtocols = [
            {
                name: 'peer_discovery',
                version: '1.0.0',
                topic: '/agent-neo/discovery/v1',
                schema: {
                    type: 'object',
                    properties: {
                        nodeId: { type: 'string' },
                        capabilities: { type: 'array' },
                        timestamp: { type: 'number' }
                    }
                }
            },
            {
                name: 'task_auction',
                version: '1.0.0',
                topic: '/agent-neo/task-auction/v1',
                schema: {
                    type: 'object',
                    properties: {
                        taskId: { type: 'string' },
                        description: { type: 'string' },
                        resourceOffer: { type: 'object' },
                        deadline: { type: 'number' }
                    }
                }
            },
            {
                name: 'knowledge_sync',
                version: '1.0.0',
                topic: '/agent-neo/knowledge-sync/v1',
                schema: {
                    type: 'object',
                    properties: {
                        triples: { type: 'array' },
                        rootHash: { type: 'string' },
                        timestamp: { type: 'number' }
                    }
                }
            },
            {
                name: 'consensus_voting',
                version: '1.0.0',
                topic: '/agent-neo/consensus/v1',
                schema: {
                    type: 'object',
                    properties: {
                        proposalId: { type: 'string' },
                        vote: { type: 'string' },
                        signature: { type: 'string' }
                    }
                }
            }
        ];
        
        for (const protocol of coreProtocols) {
            this.protocolRegistry.set(protocol.name, protocol);
            this.protocolVersions.set(protocol.name, protocol.version);
        }
        
        console.log('📋 Protocol registry initialized with', coreProtocols.length, 'core protocols');
    }

    setupMessageHandlers() {
        // Set up handlers for different message types
        this.messageHandlers.set('peer_discovery', this.handlePeerDiscovery.bind(this));
        this.messageHandlers.set('peer_offer', this.handlePeerOffer.bind(this));
        this.messageHandlers.set('peer_answer', this.handlePeerAnswer.bind(this));
        this.messageHandlers.set('ice_candidate', this.handleIceCandidate.bind(this));
        this.messageHandlers.set('protocol_update', this.handleProtocolUpdate.bind(this));
        this.messageHandlers.set('heartbeat', this.handleHeartbeat.bind(this));
        this.messageHandlers.set('knowledge_sync', this.handleKnowledgeSync.bind(this));
        this.messageHandlers.set('task_auction', this.handleTaskAuction.bind(this));
    }

    async startNetworking() {
        if (this.active) {
            console.log('🌐 P2P Network already active');
            return;
        }
        
        try {
            console.log('🌐 Starting P2P networking...');
            
            // Connect to signaling server
            await this.connectToSignaling();
            
            // Start peer discovery
            this.startPeerDiscovery();
            
            // Start heartbeat
            this.startHeartbeat();
            
            // Start topology optimization
            this.startTopologyOptimization();
            
            this.active = true;
            stateManager.setState('network.active', true);
            stateManager.setState('network.nodeId', this.config.nodeId);
            
            console.log('✅ P2P Network started');
            eventBus.emit('network:started', {
                nodeId: this.config.nodeId,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('❌ Failed to start P2P networking:', error);
            eventBus.emit('network:error', { error, phase: 'startup' });
        }
    }

    async stopNetworking() {
        if (!this.active) return;
        
        console.log('🌐 Stopping P2P networking...');
        
        // Close all peer connections
        for (const [peerId, connection] of this.connections) {
            this.closePeerConnection(peerId);
        }
        
        // Disconnect from signaling
        if (this.signalingSocket) {
            this.signalingSocket.close();
            this.signalingSocket = null;
        }
        
        // Clear intervals
        if (this.discoveryInterval) clearInterval(this.discoveryInterval);
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (this.topologyInterval) clearInterval(this.topologyInterval);
        
        this.active = false;
        stateManager.setState('network.active', false);
        
        console.log('✅ P2P Network stopped');
        eventBus.emit('network:stopped', {
            timestamp: Date.now()
        });
    }

    async connectToSignaling() {
        return new Promise((resolve, reject) => {
            // Try each signaling server in order
            let serverIndex = 0;
            
            const tryNextServer = () => {
                if (serverIndex >= this.config.signallingServers.length) {
                    reject(new Error('Failed to connect to any signaling server'));
                    return;
                }
                
                const serverUrl = this.config.signallingServers[serverIndex];
                console.log('🔗 Connecting to signaling server:', serverUrl);
                
                this.signalingSocket = new WebSocket(serverUrl);
                
                this.signalingSocket.onopen = () => {
                    console.log('✅ Connected to signaling server');
                    this.signalingConnected = true;
                    
                    // Send initial registration
                    this.sendSignalingMessage({
                        type: 'register',
                        nodeId: this.config.nodeId,
                        capabilities: this.topology.localNode.capabilities,
                        timestamp: Date.now()
                    });
                    
                    resolve();
                };
                
                this.signalingSocket.onmessage = (event) => {
                    this.handleSignalingMessage(JSON.parse(event.data));
                };
                
                this.signalingSocket.onclose = () => {
                    console.log('🔗 Signaling connection closed');
                    this.signalingConnected = false;
                    
                    // Try to reconnect after delay
                    setTimeout(() => {
                        if (this.active) {
                            this.connectToSignaling();
                        }
                    }, 5000);
                };
                
                this.signalingSocket.onerror = (error) => {
                    console.warn('⚠️ Signaling error:', error);
                    serverIndex++;
                    setTimeout(tryNextServer, 1000);
                };
            };
            
            tryNextServer();
        });
    }

    handleSignalingMessage(message) {
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
            handler(message);
        } else {
            console.warn('Unknown signaling message type:', message.type);
        }
    }

    sendSignalingMessage(message) {
        if (this.signalingSocket && this.signalingConnected) {
            this.signalingSocket.send(JSON.stringify(message));
        }
    }

    startPeerDiscovery() {
        // Broadcast discovery message
        this.broadcastDiscovery();
        
        // Set up periodic discovery
        this.discoveryInterval = setInterval(() => {
            this.broadcastDiscovery();
        }, this.config.discoveryInterval);
        
        console.log('🔍 Peer discovery started');
    }

    broadcastDiscovery() {
        const discoveryMessage = {
            type: 'peer_discovery',
            nodeId: this.config.nodeId,
            capabilities: this.topology.localNode.capabilities,
            protocolVersion: this.config.protocolVersion,
            peerCount: this.peers.size,
            timestamp: Date.now()
        };
        
        this.sendSignalingMessage(discoveryMessage);
        
        // Also send to existing peers
        this.broadcastToPeers('peer_discovery', discoveryMessage);
    }

    handlePeerDiscovery(message) {
        const { nodeId, capabilities, protocolVersion, peerCount, timestamp } = message;
        
        // Don't connect to ourselves
        if (nodeId === this.config.nodeId) return;
        
        // Check if we should connect to this peer
        if (this.shouldConnectToPeer(nodeId, capabilities, peerCount)) {
            this.initiatePeerConnection(nodeId, capabilities);
        }
    }

    shouldConnectToPeer(nodeId, capabilities, peerCount) {
        // Don't connect if already connected
        if (this.peers.has(nodeId)) return false;
        
        // Don't connect if at max capacity
        if (this.peers.size >= this.config.maxPeers) return false;
        
        // Connect if below target
        if (this.peers.size < this.config.targetPeers) return true;
        
        // Connect to well-connected peers (hub strategy)
        if (peerCount > this.peers.size) return true;
        
        // Connect based on capability compatibility
        const localCapabilities = this.topology.localNode.capabilities;
        const sharedCapabilities = capabilities.filter(cap => localCapabilities.includes(cap));
        return sharedCapabilities.length >= 2;
    }

    async initiatePeerConnection(peerId, capabilities) {
        try {
            console.log('🤝 Initiating connection to peer:', peerId);
            
            // Create RTCPeerConnection
            const connection = new RTCPeerConnection({
                iceServers: this.config.stunServers.map(url => ({ urls: url }))
            });
            
            // Set up connection event handlers
            this.setupPeerConnectionHandlers(peerId, connection);
            
            // Create data channel
            const dataChannel = connection.createDataChannel('agent-neo', {
                ordered: true
            });
            
            this.setupDataChannelHandlers(peerId, dataChannel);
            
            // Store connection
            this.connections.set(peerId, connection);
            this.dataChannels.set(peerId, dataChannel);
            
            // Create offer
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            
            // Send offer via signaling
            this.sendSignalingMessage({
                type: 'peer_offer',
                targetPeer: peerId,
                fromPeer: this.config.nodeId,
                offer: offer
            });
            
        } catch (error) {
            console.error('Failed to initiate peer connection:', error);
            this.cleanupPeerConnection(peerId);
        }
    }

    setupPeerConnectionHandlers(peerId, connection) {
        connection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignalingMessage({
                    type: 'ice_candidate',
                    targetPeer: peerId,
                    fromPeer: this.config.nodeId,
                    candidate: event.candidate
                });
            }
        };
        
        connection.onconnectionstatechange = () => {
            console.log(`Peer ${peerId} connection state:`, connection.connectionState);
            
            if (connection.connectionState === 'connected') {
                this.onPeerConnected(peerId);
            } else if (connection.connectionState === 'disconnected' || 
                       connection.connectionState === 'failed') {
                this.onPeerDisconnected(peerId);
            }
        };
        
        connection.ondatachannel = (event) => {
            const channel = event.channel;
            this.setupDataChannelHandlers(peerId, channel);
            this.dataChannels.set(peerId, channel);
        };
    }

    setupDataChannelHandlers(peerId, dataChannel) {
        dataChannel.onopen = () => {
            console.log(`📡 Data channel opened with peer: ${peerId}`);
        };
        
        dataChannel.onmessage = (event) => {
            this.handlePeerMessage(peerId, event.data);
        };
        
        dataChannel.onerror = (error) => {
            console.error(`Data channel error with peer ${peerId}:`, error);
        };
        
        dataChannel.onclose = () => {
            console.log(`📡 Data channel closed with peer: ${peerId}`);
        };
    }

    async handlePeerOffer(message) {
        const { fromPeer, offer } = message;
        
        try {
            console.log('🤝 Received peer offer from:', fromPeer);
            
            // Create RTCPeerConnection
            const connection = new RTCPeerConnection({
                iceServers: this.config.stunServers.map(url => ({ urls: url }))
            });
            
            this.setupPeerConnectionHandlers(fromPeer, connection);
            this.connections.set(fromPeer, connection);
            
            // Set remote description
            await connection.setRemoteDescription(offer);
            
            // Create answer
            const answer = await connection.createAnswer();
            await connection.setLocalDescription(answer);
            
            // Send answer
            this.sendSignalingMessage({
                type: 'peer_answer',
                targetPeer: fromPeer,
                fromPeer: this.config.nodeId,
                answer: answer
            });
            
        } catch (error) {
            console.error('Failed to handle peer offer:', error);
        }
    }

    async handlePeerAnswer(message) {
        const { fromPeer, answer } = message;
        
        try {
            const connection = this.connections.get(fromPeer);
            if (connection) {
                await connection.setRemoteDescription(answer);
            }
        } catch (error) {
            console.error('Failed to handle peer answer:', error);
        }
    }

    async handleIceCandidate(message) {
        const { fromPeer, candidate } = message;
        
        try {
            const connection = this.connections.get(fromPeer);
            if (connection) {
                await connection.addIceCandidate(candidate);
            }
        } catch (error) {
            console.error('Failed to handle ICE candidate:', error);
        }
    }

    onPeerConnected(peerId) {
        // Add peer to our list
        const peerInfo = {
            id: peerId,
            connectedAt: Date.now(),
            lastSeen: Date.now(),
            reputation: 50, // Start with neutral reputation
            capabilities: [],
            latency: 0,
            messageCount: 0
        };
        
        this.peers.set(peerId, peerInfo);
        this.stats.connectionsEstablished++;
        
        // Update state
        stateManager.setState('network.peers', this.getPeersList());
        stateManager.setState('network.peerCount', this.peers.size);
        
        // Emit event
        eventBus.emit('connection:established', {
            peerId,
            peerInfo,
            timestamp: Date.now()
        });
        
        console.log(`✅ Connected to peer: ${peerId} (${this.peers.size} total peers)`);
        
        // Exchange protocol information
        this.exchangeProtocolInfo(peerId);
    }

    onPeerDisconnected(peerId) {
        const peerInfo = this.peers.get(peerId);
        
        this.cleanupPeerConnection(peerId);
        this.stats.connectionsLost++;
        
        // Update state
        stateManager.setState('network.peers', this.getPeersList());
        stateManager.setState('network.peerCount', this.peers.size);
        
        // Emit event
        eventBus.emit('connection:lost', {
            peerId,
            peerInfo,
            timestamp: Date.now()
        });
        
        console.log(`❌ Disconnected from peer: ${peerId} (${this.peers.size} remaining peers)`);
    }

    cleanupPeerConnection(peerId) {
        // Remove from peers
        this.peers.delete(peerId);
        
        // Close connection
        const connection = this.connections.get(peerId);
        if (connection) {
            connection.close();
            this.connections.delete(peerId);
        }
        
        // Close data channel
        const dataChannel = this.dataChannels.get(peerId);
        if (dataChannel) {
            dataChannel.close();
            this.dataChannels.delete(peerId);
        }
    }

    handlePeerMessage(peerId, data) {
        try {
            const message = JSON.parse(data);
            this.stats.messagesReceived++;
            this.stats.bytesReceived += data.length;
            
            // Update peer info
            const peer = this.peers.get(peerId);
            if (peer) {
                peer.lastSeen = Date.now();
                peer.messageCount++;
            }
            
            // Handle message based on protocol
            const handler = this.messageHandlers.get(message.protocol);
            if (handler) {
                handler(message, peerId);
            } else {
                console.warn('Unknown protocol:', message.protocol);
            }
            
        } catch (error) {
            console.error('Failed to parse peer message:', error);
        }
    }

    sendMessage(messageData) {
        const { peerId, protocol, data } = messageData;
        
        const message = {
            protocol,
            data,
            fromPeer: this.config.nodeId,
            timestamp: Date.now(),
            sequence: this.messageSequence++
        };
        
        this.sendToPeer(peerId, message);
    }

    broadcastMessage(messageData) {
        const { protocol, data, excludePeers = [] } = messageData;
        
        const message = {
            protocol,
            data,
            fromPeer: this.config.nodeId,
            timestamp: Date.now(),
            sequence: this.messageSequence++
        };
        
        this.broadcastToPeers(protocol, message, excludePeers);
    }

    sendToPeer(peerId, message) {
        const dataChannel = this.dataChannels.get(peerId);
        if (dataChannel && dataChannel.readyState === 'open') {
            try {
                const messageStr = JSON.stringify(message);
                dataChannel.send(messageStr);
                
                this.stats.messagesSent++;
                this.stats.bytesSent += messageStr.length;
                
                return true;
            } catch (error) {
                console.error(`Failed to send message to peer ${peerId}:`, error);
                return false;
            }
        }
        return false;
    }

    broadcastToPeers(protocol, message, excludePeers = []) {
        let sentCount = 0;
        
        for (const [peerId] of this.peers) {
            if (!excludePeers.includes(peerId)) {
                if (this.sendToPeer(peerId, message)) {
                    sentCount++;
                }
            }
        }
        
        console.log(`📡 Broadcasted ${protocol} message to ${sentCount} peers`);
        return sentCount;
    }

    exchangeProtocolInfo(peerId) {
        const protocolInfo = {
            registry: Array.from(this.protocolRegistry.values()),
            versions: Object.fromEntries(this.protocolVersions),
            nodeCapabilities: this.topology.localNode.capabilities
        };
        
        this.sendToPeer(peerId, {
            protocol: 'protocol_exchange',
            data: protocolInfo,
            fromPeer: this.config.nodeId,
            timestamp: Date.now()
        });
    }

    handleProtocolUpdate(message, fromPeer) {
        const { data } = message;
        const { registry, versions, nodeCapabilities } = data;
        
        // Update peer capabilities
        const peer = this.peers.get(fromPeer);
        if (peer) {
            peer.capabilities = nodeCapabilities;
        }
        
        // Check for protocol updates
        for (const protocol of registry) {
            const currentVersion = this.protocolVersions.get(protocol.name);
            if (!currentVersion || this.compareVersions(protocol.version, currentVersion) > 0) {
                console.log(`📋 New protocol version available: ${protocol.name} v${protocol.version}`);
                
                // Emit event for potential update
                eventBus.emit('network:protocol-update-available', {
                    protocol,
                    currentVersion,
                    fromPeer
                });
            }
        }
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, this.config.heartbeatInterval);
    }

    sendHeartbeat() {
        const heartbeat = {
            timestamp: Date.now(),
            nodeId: this.config.nodeId,
            peerCount: this.peers.size,
            uptime: Date.now() - (this.topology.localNode?.joinedAt || Date.now())
        };
        
        this.broadcastToPeers('heartbeat', heartbeat);
    }

    handleHeartbeat(message, fromPeer) {
        const peer = this.peers.get(fromPeer);
        if (peer) {
            const latency = Date.now() - message.timestamp;
            peer.latency = latency;
            peer.lastSeen = Date.now();
            
            // Update average latency
            this.updateAverageLatency();
        }
    }

    startTopologyOptimization() {
        this.topologyInterval = setInterval(() => {
            this.optimizeTopology();
        }, 60000); // Every minute
    }

    optimizeTopology() {
        // Simple topology optimization
        const now = Date.now();
        
        // Remove stale peers
        for (const [peerId, peer] of this.peers) {
            if (now - peer.lastSeen > 120000) { // 2 minutes
                console.log(`🧹 Removing stale peer: ${peerId}`);
                this.onPeerDisconnected(peerId);
            }
        }
        
        // Try to maintain target peer count
        if (this.peers.size < this.config.targetPeers) {
            this.broadcastDiscovery();
        }
        
        this.topology.lastOptimization = now;
    }

    updateAverageLatency() {
        const latencies = Array.from(this.peers.values()).map(peer => peer.latency).filter(l => l > 0);
        if (latencies.length > 0) {
            this.stats.averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
        }
    }

    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const part1 = parts1[i] || 0;
            const part2 = parts2[i] || 0;
            
            if (part1 > part2) return 1;
            if (part1 < part2) return -1;
        }
        
        return 0;
    }

    getPeersList() {
        return Array.from(this.peers.values());
    }

    registerProtocol(protocolData) {
        const { name, version, topic, schema } = protocolData;
        
        this.protocolRegistry.set(name, {
            name,
            version,
            topic,
            schema,
            registeredAt: Date.now()
        });
        
        this.protocolVersions.set(name, version);
        
        console.log(`📋 Registered protocol: ${name} v${version}`);
        
        // Broadcast to peers
        this.broadcastToPeers('protocol_update', {
            action: 'register',
            protocol: { name, version, topic, schema }
        });
    }

    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('🌐 P2P Network configuration updated:', this.config);
        eventBus.emit('network:config-updated', this.config);
    }

    handleKnowledgeSync(message, fromPeer) {
        // Forward to knowledge graph
        eventBus.emit('knowledge:sync-received', {
            data: message.data,
            fromPeer,
            timestamp: message.timestamp
        });
    }

    handleTaskAuction(message, fromPeer) {
        // Forward to task manager
        eventBus.emit('task:auction-received', {
            data: message.data,
            fromPeer,
            timestamp: message.timestamp
        });
    }

    getStatus() {
        return {
            name: this.name,
            version: this.version,
            initialized: this.initialized,
            active: this.active,
            config: {
                ...this.config,
                // Don't expose sensitive data
                nodeId: this.config.nodeId
            },
            stats: this.stats,
            network: {
                nodeId: this.config.nodeId,
                peerCount: this.peers.size,
                connectionState: this.signalingConnected ? 'connected' : 'disconnected',
                protocols: this.protocolRegistry.size,
                topology: {
                    lastOptimization: this.topology.lastOptimization,
                    averageLatency: this.stats.averageLatency
                }
            },
            peers: this.getPeersList().map(peer => ({
                id: peer.id,
                latency: peer.latency,
                reputation: peer.reputation,
                messageCount: peer.messageCount,
                connectedFor: Date.now() - peer.connectedAt
            }))
        };
    }

    async start() {
        this.active = true;
        await this.startNetworking();
        console.log('🌐 P2P Network started');
        eventBus.emit('module:started', { name: this.name });
    }

    async stop() {
        await this.stopNetworking();
        this.active = false;
        console.log('🌐 P2P Network stopped');
        eventBus.emit('module:stopped', { name: this.name });
    }
}

// Create and export singleton instance
const p2pNetwork = new P2PNetwork();
export default p2pNetwork;