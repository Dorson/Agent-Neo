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

import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { webRTC } from '@libp2p/webrtc';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { kadDHT } from '@libp2p/kad-dht';
import { identify } from '@libp2p/identify';
import { bootstrap } from '@libp2p/bootstrap';
import { mdns } from '@libp2p/mdns';
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery';

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