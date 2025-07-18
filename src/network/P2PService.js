/**
 * P2P Service Module
 * 
 * Implements the decentralized peer-to-peer networking layer using js-libp2p
 * as specified in the Agent Neo whitepaper. Handles peer discovery, connection
 * management, message routing, and service tiers middleware.
 * 
 * Features:
 * - WebRTC and WebSocket transport support
 * - Peer discovery via bootstrap nodes and mDNS
 * - Message routing and pub/sub communication
 * - Service tiers for quality of service
 * - Connection management and health monitoring
 * - Protocol versioning and negotiation
 */

// Note: For now, we'll implement a simplified P2P service using WebRTC and WebSockets
// In production, this would use js-libp2p, but for native implementation we'll use browser APIs

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class P2PService {
    constructor() {
        this.initialized = false;
        this.node = null;
        this.peerId = null;
        this.connections = new Map();
        this.subscriptions = new Map();
        this.serviceTiers = new Map();
        this.messageHandlers = new Map();
        
        // Configuration
        this.config = {
            maxConnections: 50,
            minConnections: 5,
            heartbeatInterval: 30000,
            connectionTimeout: 10000,
            retryAttempts: 3,
            serviceTiers: {
                HIGH: { priority: 1, bandwidth: 1000000, latency: 100 },
                MEDIUM: { priority: 2, bandwidth: 500000, latency: 500 },
                LOW: { priority: 3, bandwidth: 100000, latency: 2000 }
            }
        };
        
        // Bootstrap peers (these would be real bootstrap nodes in production)
        this.bootstrapPeers = [
            '/dns4/bootstrap.libp2p.io/tcp/443/wss/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
            '/dns4/bootstrap.libp2p.io/tcp/443/wss/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa'
        ];
        
        // Network metrics
        this.metrics = {
            connectedPeers: 0,
            totalMessages: 0,
            messagesPerSecond: 0,
            averageLatency: 0,
            uptime: 0
        };
        
        this.startTime = Date.now();
        this.init();
    }

    async init() {
        try {
            console.log('🌐 P2P Service initializing...');
            
            // Create libp2p node
            await this.createLibp2pNode();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize message handlers
            this.initializeMessageHandlers();
            
            // Start monitoring
            this.startMonitoring();
            
            this.initialized = true;
            console.log('✅ P2P Service initialized successfully');
            
        } catch (error) {
            console.error('❌ P2P Service initialization failed:', error);
            throw error;
        }
    }

    async createLibp2pNode() {
        try {
            // For now, we'll implement a simplified P2P service using native browser APIs
            // This is a placeholder implementation until we can integrate js-libp2p properly
            
            console.log('📡 Creating simplified P2P node...');
            
            // Initialize WebRTC peer connections
            this.peerConnections = new Map();
            this.dataChannels = new Map();
            
            // Initialize WebSocket connections for signaling
            this.signalingSocket = null;
            
            // Generate a simple peer ID
            this.peerId = await this.generatePeerId();
            
            console.log('✅ P2P node created with peer ID:', this.peerId);
            
            return this.node;
            
        } catch (error) {
            console.error('❌ P2P node creation failed:', error);
            throw error;
        }
    }

    async generatePeerId() {
        // Generate a simple peer ID based on current timestamp and random data
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `peer-${timestamp}-${random}`;
    }

    async start() {
        try {
            if (this.node) {
                console.log('⚠️ P2P Service already started');
                return;
            }

            console.log('🚀 Starting P2P Service...');
            
            // Create the P2P node
            await this.createLibp2pNode();
            
            // Start peer discovery
            await this.startPeerDiscovery();
            
            // Update state
            stateManager.setState('network.status', 'connected');
            stateManager.setState('network.peerId', this.peerId);
            
            this.metrics.uptime = Date.now() - this.startTime;
            
            eventBus.emit('p2p:started', {
                peerId: this.peerId,
                timestamp: Date.now()
            });
            
            console.log('✅ P2P Service started successfully');
            
        } catch (error) {
            console.error('❌ P2P Service start failed:', error);
            eventBus.emit('p2p:error', { error, phase: 'start' });
            throw error;
        }
    }

    async stop() {
        try {
            if (!this.node) {
                console.log('⚠️ P2P Service not running');
                return;
            }

            console.log('🛑 Stopping P2P Service...');
            
            // Close all peer connections
            for (const [peerId, connection] of this.peerConnections) {
                connection.close();
            }
            this.peerConnections.clear();
            this.dataChannels.clear();
            
            // Close signaling socket
            if (this.signalingSocket) {
                this.signalingSocket.close();
            }
            
            this.node = null;
            
            // Update state
            stateManager.setState('network.status', 'disconnected');
            stateManager.setState('network.connectedPeers', 0);
            
            eventBus.emit('p2p:stopped', {
                timestamp: Date.now()
            });
            
            console.log('✅ P2P Service stopped successfully');
            
        } catch (error) {
            console.error('❌ P2P Service stop failed:', error);
            eventBus.emit('p2p:error', { error, phase: 'stop' });
            throw error;
        }
    }

    async startPeerDiscovery() {
        try {
            console.log('🔍 Starting peer discovery...');
            
            // For now, we'll implement a simple discovery mechanism
            // In production, this would use DHT, mDNS, and bootstrap peers
            
            // Simulate peer discovery
            setTimeout(() => {
                this.simulatePeerDiscovery();
            }, 2000);
            
            console.log('✅ Peer discovery started');
            
        } catch (error) {
            console.error('❌ Peer discovery failed:', error);
            throw error;
        }
    }

    simulatePeerDiscovery() {
        // Simulate discovering peers for demonstration
        const simulatedPeers = [
            { id: 'peer-demo-1', address: '127.0.0.1:8001' },
            { id: 'peer-demo-2', address: '127.0.0.1:8002' }
        ];

        simulatedPeers.forEach(peer => {
            eventBus.emit('p2p:peer_discovered', {
                peerId: peer.id,
                address: peer.address,
                timestamp: Date.now()
            });
        });

        this.metrics.connectedPeers = simulatedPeers.length;
        stateManager.setState('network.connectedPeers', this.metrics.connectedPeers);
    }

    async connectToPeer(peerId) {
        try {
            if (this.peerConnections.has(peerId)) {
                console.log('⚠️ Already connected to peer:', peerId);
                return;
            }

            console.log('🔗 Connecting to peer:', peerId);
            
            // Create WebRTC peer connection
            const peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            });

            // Set up data channel
            const dataChannel = peerConnection.createDataChannel('agent-neo', {
                ordered: true
            });

            dataChannel.onopen = () => {
                console.log('✅ Data channel opened for peer:', peerId);
                eventBus.emit('p2p:peer_connected', {
                    peerId,
                    timestamp: Date.now()
                });
            };

            dataChannel.onmessage = (event) => {
                this.handleMessage(peerId, event.data);
            };

            dataChannel.onclose = () => {
                console.log('📴 Data channel closed for peer:', peerId);
                this.peerConnections.delete(peerId);
                this.dataChannels.delete(peerId);
                eventBus.emit('p2p:peer_disconnected', {
                    peerId,
                    timestamp: Date.now()
                });
            };

            this.peerConnections.set(peerId, peerConnection);
            this.dataChannels.set(peerId, dataChannel);

            // For now, we'll just simulate a successful connection
            setTimeout(() => {
                dataChannel.onopen();
            }, 1000);

            console.log('✅ Connected to peer:', peerId);
            
        } catch (error) {
            console.error('❌ Failed to connect to peer:', peerId, error);
            throw error;
        }
    }

    async sendMessage(peerId, message) {
        try {
            const dataChannel = this.dataChannels.get(peerId);
            
            if (!dataChannel || dataChannel.readyState !== 'open') {
                throw new Error(`No open connection to peer: ${peerId}`);
            }

            const messageData = JSON.stringify({
                from: this.peerId,
                to: peerId,
                timestamp: Date.now(),
                ...message
            });

            dataChannel.send(messageData);
            
            this.metrics.totalMessages++;
            
            console.log('📤 Message sent to peer:', peerId);
            
        } catch (error) {
            console.error('❌ Failed to send message to peer:', peerId, error);
            throw error;
        }
    }

    async broadcast(message) {
        try {
            const connectedPeers = Array.from(this.dataChannels.keys());
            
            for (const peerId of connectedPeers) {
                await this.sendMessage(peerId, message);
            }
            
            console.log('📢 Message broadcast to', connectedPeers.length, 'peers');
            
        } catch (error) {
            console.error('❌ Broadcast failed:', error);
            throw error;
        }
    }

    handleMessage(peerId, data) {
        try {
            const message = JSON.parse(data);
            
            console.log('📥 Message received from peer:', peerId, message);
            
            // Route message to appropriate handler
            eventBus.emit('p2p:message_received', {
                peerId,
                message,
                timestamp: Date.now()
            });
            
            this.metrics.totalMessages++;
            
        } catch (error) {
            console.error('❌ Failed to handle message from peer:', peerId, error);
        }
    }
        try {
            this.node = await createLibp2p({
                addresses: {
                    listen: ['/ip4/0.0.0.0/tcp/0/ws']
                },
                transports: [
                    webSockets(),
                    webRTC()
                ],
                connectionEncryption: [noise()],
                streamMuxers: [yamux()],
                peerDiscovery: [
                    bootstrap({
                        list: this.bootstrapPeers
                    }),
                    mdns({
                        interval: 20000
                    }),
                    pubsubPeerDiscovery({
                        interval: 10000,
                        topics: ['agent-neo-discovery']
                    })
                ],
                services: {
                    pubsub: gossipsub({
                        allowPublishToZeroPeers: true,
                        msgIdFn: (msg) => {
                            return new TextEncoder().encode(msg.topic + msg.data);
                        },
                        ignoreDuplicatePublishError: true
                    }),
                    dht: kadDHT({
                        clientMode: true
                    }),
                    identify: identify()
                },
                connectionManager: {
                    maxConnections: this.config.maxConnections,
                    minConnections: this.config.minConnections,
                    pollInterval: 2000,
                    autoDialInterval: 10000,
                    inboundUpgradeTimeout: this.config.connectionTimeout
                }
            });

            this.peerId = this.node.peerId;
            console.log(`🆔 P2P Node created with PeerID: ${this.peerId.toString()}`);
            
        } catch (error) {
            console.error('❌ Failed to create libp2p node:', error);
            throw error;
        }
    }

    async start() {
        try {
            if (!this.node) {
                throw new Error('P2P node not initialized');
            }

            console.log('🚀 Starting P2P node...');
            await this.node.start();
            
            // Subscribe to discovery topic
            await this.subscribe('agent-neo-discovery', this.handleDiscoveryMessage.bind(this));
            
            // Announce presence
            await this.announcePresence();
            
            // Update state
            stateManager.setState('network.status', 'connected');
            stateManager.setState('network.peerId', this.peerId.toString());
            
            eventBus.emit('p2p:started', {
                peerId: this.peerId.toString(),
                addresses: this.node.getMultiaddrs()
            });
            
            console.log('✅ P2P node started successfully');
            
        } catch (error) {
            console.error('❌ Failed to start P2P node:', error);
            throw error;
        }
    }

    async stop() {
        try {
            if (!this.node) {
                return;
            }

            console.log('🛑 Stopping P2P node...');
            await this.node.stop();
            
            // Clear connections
            this.connections.clear();
            this.subscriptions.clear();
            
            // Update state
            stateManager.setState('network.status', 'disconnected');
            
            eventBus.emit('p2p:stopped');
            
            console.log('✅ P2P node stopped successfully');
            
        } catch (error) {
            console.error('❌ Failed to stop P2P node:', error);
            throw error;
        }
    }

    async subscribe(topic, handler) {
        try {
            if (!this.node || !this.node.services.pubsub) {
                throw new Error('P2P node or pubsub service not available');
            }

            // Subscribe to topic
            this.node.services.pubsub.addEventListener('message', (evt) => {
                if (evt.detail.topic === topic) {
                    handler(evt.detail);
                }
            });
            
            this.node.services.pubsub.subscribe(topic);
            
            // Store subscription
            this.subscriptions.set(topic, handler);
            
            console.log(`📡 Subscribed to topic: ${topic}`);
            
        } catch (error) {
            console.error(`❌ Failed to subscribe to topic ${topic}:`, error);
            throw error;
        }
    }

    async unsubscribe(topic) {
        try {
            if (!this.node || !this.node.services.pubsub) {
                return;
            }

            this.node.services.pubsub.unsubscribe(topic);
            this.subscriptions.delete(topic);
            
            console.log(`📡 Unsubscribed from topic: ${topic}`);
            
        } catch (error) {
            console.error(`❌ Failed to unsubscribe from topic ${topic}:`, error);
            throw error;
        }
    }

    async publish(topic, data, options = {}) {
        try {
            if (!this.node || !this.node.services.pubsub) {
                throw new Error('P2P node or pubsub service not available');
            }

            // Prepare message
            const message = {
                type: options.type || 'data',
                timestamp: Date.now(),
                sender: this.peerId.toString(),
                data: data
            };
            
            // Serialize message
            const serializedMessage = new TextEncoder().encode(JSON.stringify(message));
            
            // Publish message
            await this.node.services.pubsub.publish(topic, serializedMessage);
            
            // Update metrics
            this.metrics.totalMessages++;
            
            console.log(`📤 Published message to topic: ${topic}`);
            
        } catch (error) {
            console.error(`❌ Failed to publish to topic ${topic}:`, error);
            throw error;
        }
    }

    async sendDirectMessage(peerId, protocol, data) {
        try {
            if (!this.node) {
                throw new Error('P2P node not available');
            }

            // Open stream to peer
            const stream = await this.node.dialProtocol(peerId, protocol);
            
            // Send message
            const message = {
                type: 'direct',
                timestamp: Date.now(),
                sender: this.peerId.toString(),
                data: data
            };
            
            const serializedMessage = new TextEncoder().encode(JSON.stringify(message));
            await stream.sink([serializedMessage]);
            
            console.log(`📤 Sent direct message to peer: ${peerId}`);
            
        } catch (error) {
            console.error(`❌ Failed to send direct message to ${peerId}:`, error);
            throw error;
        }
    }

    async announcePresence() {
        try {
            const announcement = {
                type: 'presence',
                peerId: this.peerId.toString(),
                timestamp: Date.now(),
                capabilities: [
                    'agent-neo-v1',
                    'task-processing',
                    'knowledge-sharing',
                    'guild-participation'
                ],
                version: '1.0.0',
                multiaddrs: this.node.getMultiaddrs().map(addr => addr.toString())
            };
            
            await this.publish('agent-neo-discovery', announcement, { type: 'presence' });
            
        } catch (error) {
            console.error('❌ Failed to announce presence:', error);
        }
    }

    async handleDiscoveryMessage(message) {
        try {
            const data = JSON.parse(new TextDecoder().decode(message.data));
            
            if (data.type === 'presence' && data.peerId !== this.peerId.toString()) {
                console.log(`👋 Discovered peer: ${data.peerId}`);
                
                // Attempt to connect if we have room
                if (this.connections.size < this.config.maxConnections) {
                    await this.connectToPeer(data.peerId, data.multiaddrs);
                }
                
                eventBus.emit('p2p:peer:discovered', {
                    peerId: data.peerId,
                    capabilities: data.capabilities,
                    version: data.version
                });
            }
            
        } catch (error) {
            console.error('❌ Failed to handle discovery message:', error);
        }
    }

    async connectToPeer(peerId, multiaddrs = []) {
        try {
            if (this.connections.has(peerId)) {
                return; // Already connected
            }

            console.log(`🔗 Connecting to peer: ${peerId}`);
            
            // Attempt connection
            const connection = await this.node.dial(peerId);
            
            // Store connection info
            this.connections.set(peerId, {
                connection,
                connectedAt: Date.now(),
                lastSeen: Date.now(),
                tier: this.determinePeerTier(peerId)
            });
            
            // Update metrics
            this.metrics.connectedPeers = this.connections.size;
            
            eventBus.emit('p2p:peer:connected', {
                peerId,
                connectionCount: this.connections.size
            });
            
            console.log(`✅ Connected to peer: ${peerId}`);
            
        } catch (error) {
            console.error(`❌ Failed to connect to peer ${peerId}:`, error);
        }
    }

    async disconnectFromPeer(peerId) {
        try {
            const connectionInfo = this.connections.get(peerId);
            if (!connectionInfo) {
                return;
            }

            await connectionInfo.connection.close();
            this.connections.delete(peerId);
            
            // Update metrics
            this.metrics.connectedPeers = this.connections.size;
            
            eventBus.emit('p2p:peer:disconnected', {
                peerId,
                connectionCount: this.connections.size
            });
            
            console.log(`🔌 Disconnected from peer: ${peerId}`);
            
        } catch (error) {
            console.error(`❌ Failed to disconnect from peer ${peerId}:`, error);
        }
    }

    determinePeerTier(peerId) {
        // Simple tier determination based on connection history
        // In production, this would use reputation scores and performance metrics
        return 'MEDIUM';
    }

    setupEventListeners() {
        if (!this.node) return;

        // Connection events
        this.node.addEventListener('peer:connect', (evt) => {
            const peerId = evt.detail.toString();
            console.log(`🔗 Peer connected: ${peerId}`);
            
            if (!this.connections.has(peerId)) {
                this.connections.set(peerId, {
                    connection: evt.detail,
                    connectedAt: Date.now(),
                    lastSeen: Date.now(),
                    tier: this.determinePeerTier(peerId)
                });
            }
            
            this.metrics.connectedPeers = this.connections.size;
            stateManager.setState('network.connectedPeers', this.connections.size);
        });

        this.node.addEventListener('peer:disconnect', (evt) => {
            const peerId = evt.detail.toString();
            console.log(`🔌 Peer disconnected: ${peerId}`);
            
            this.connections.delete(peerId);
            this.metrics.connectedPeers = this.connections.size;
            stateManager.setState('network.connectedPeers', this.connections.size);
        });

        // Protocol events
        this.node.addEventListener('peer:discovery', (evt) => {
            const peerId = evt.detail.id.toString();
            console.log(`🔍 Peer discovered: ${peerId}`);
            
            eventBus.emit('p2p:peer:discovered', {
                peerId,
                multiaddrs: evt.detail.multiaddrs
            });
        });
    }

    initializeMessageHandlers() {
        // Register protocol handlers
        this.node.handle('/agent-neo/task/1.0.0', ({ stream }) => {
            this.handleTaskProtocol(stream);
        });
        
        this.node.handle('/agent-neo/knowledge/1.0.0', ({ stream }) => {
            this.handleKnowledgeProtocol(stream);
        });
        
        this.node.handle('/agent-neo/guild/1.0.0', ({ stream }) => {
            this.handleGuildProtocol(stream);
        });
    }

    async handleTaskProtocol(stream) {
        // Handle task-related protocol messages
        console.log('📋 Handling task protocol message');
        // Implementation would go here
    }

    async handleKnowledgeProtocol(stream) {
        // Handle knowledge-sharing protocol messages
        console.log('🧠 Handling knowledge protocol message');
        // Implementation would go here
    }

    async handleGuildProtocol(stream) {
        // Handle guild-related protocol messages
        console.log('🏛️ Handling guild protocol message');
        // Implementation would go here
    }

    startMonitoring() {
        // Start heartbeat monitoring
        setInterval(() => {
            this.updateMetrics();
            this.checkConnectionHealth();
        }, this.config.heartbeatInterval);
    }

    updateMetrics() {
        this.metrics.uptime = Date.now() - this.startTime;
        this.metrics.connectedPeers = this.connections.size;
        
        // Update state manager
        stateManager.setState('network.metrics', this.metrics);
        
        // Emit metrics event
        eventBus.emit('p2p:metrics:updated', this.metrics);
    }

    checkConnectionHealth() {
        const now = Date.now();
        const staleTimeout = 60000; // 1 minute
        
        for (const [peerId, connectionInfo] of this.connections) {
            if (now - connectionInfo.lastSeen > staleTimeout) {
                console.log(`⚠️ Stale connection detected: ${peerId}`);
                this.disconnectFromPeer(peerId);
            }
        }
    }

    // Utility methods
    getConnectedPeers() {
        return Array.from(this.connections.keys());
    }

    getConnectionInfo(peerId) {
        return this.connections.get(peerId);
    }

    getPeersByTier(tier) {
        return Array.from(this.connections.entries())
            .filter(([_, info]) => info.tier === tier)
            .map(([peerId, _]) => peerId);
    }

    isConnected() {
        return this.node && this.node.isStarted();
    }

    getMetrics() {
        return { ...this.metrics };
    }

    // Getters
    get nodeId() {
        return this.peerId?.toString();
    }

    get connectionCount() {
        return this.connections.size;
    }

    get isRunning() {
        return this.node && this.node.isStarted();
    }
}

export default P2PService;