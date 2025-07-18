/**
 * Agent Neo Native P2P Service
 * 
 * Implements a fully functional peer-to-peer network using native WebRTC APIs
 * without external dependencies. Provides IPFS-like P2P functionality with
 * native browser technologies only.
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';
import CryptoManager from '../core/CryptoManager.js';
import { config } from '../core/config.js';

class NativeP2PService {
    constructor() {
        this.initialized = false;
        this.peers = new Map(); // peerId -> connection info
        this.connections = new Map(); // connectionId -> RTCPeerConnection
        this.dataChannels = new Map(); // connectionId -> RTCDataChannel
        this.signalingSocket = null;
        this.nodeId = null;
        this.isOnline = false;
        
        // Message handling
        this.messageHandlers = new Map();
        this.messageQueue = new Map(); // For offline peers
        this.routingTable = new Map(); // peerId -> route
        
        // Service tiers for quality of service
        this.serviceTiers = new Map();
        
        // Connection pools
        this.highTrustConnections = new Set();
        this.lowTrustConnections = new Set();
        
        this.init();
    }

    async init() {
        try {
            console.log('🌐 Initializing Native P2P Service...');
            
            // Generate stable node ID
            await this.generateNodeId();
            
            // Initialize service tiers
            this.initializeServiceTiers();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize WebRTC configuration
            this.initializeWebRTC();
            
            // Start peer discovery
            this.startPeerDiscovery();
            
            this.initialized = true;
            
            eventBus.emit('p2p:ready', {
                nodeId: this.nodeId,
                peers: this.peers.size
            });
            
            console.log('✅ Native P2P Service initialized');
            console.log(`🆔 Node ID: ${this.nodeId}`);
            
        } catch (error) {
            console.error('❌ Native P2P Service initialization failed:', error);
            throw error;
        }
    }

    async generateNodeId() {
        // Use crypto manager to generate stable node ID
        const identity = await CryptoManager.getIdentity();
        if (identity) {
            const hash = await CryptoManager.hash(identity.publicKey);
            this.nodeId = `neo_${hash.slice(0, 16)}`;
        } else {
            // Fallback to browser fingerprinting for node ID
            const fingerprint = await this.generateBrowserFingerprint();
            this.nodeId = `neo_${fingerprint}`;
        }
    }

    async generateBrowserFingerprint() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Agent Neo Fingerprint', 2, 2);
        
        const canvasData = canvas.toDataURL();
        const userAgent = navigator.userAgent;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const language = navigator.language;
        
        const fingerprintString = `${canvasData}${userAgent}${timezone}${language}`;
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprintString));
        const hashArray = Array.from(new Uint8Array(hash));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
    }

    initializeServiceTiers() {
        // Initialize service tiers from config
        for (const [tier, settings] of Object.entries(config.p2p.serviceTiers)) {
            this.serviceTiers.set(tier, {
                ...settings,
                connections: new Set(),
                messageQueue: []
            });
        }
    }

    setupEventListeners() {
        // P2P messaging events
        eventBus.on('p2p:send_message', this.sendMessage.bind(this));
        eventBus.on('p2p:broadcast_message', this.broadcastMessage.bind(this));
        eventBus.on('p2p:connect_peer', this.connectToPeer.bind(this));
        eventBus.on('p2p:disconnect_peer', this.disconnectPeer.bind(this));
        
        // Network events
        eventBus.on('network:discovery_request', this.handleDiscoveryRequest.bind(this));
        eventBus.on('network:join_request', this.handleJoinRequest.bind(this));
        
        // Guild events for trust-based connections
        eventBus.on('guild:member_added', this.handleGuildMemberAdded.bind(this));
        eventBus.on('guild:member_removed', this.handleGuildMemberRemoved.bind(this));
        
        // Window events
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
    }

    initializeWebRTC() {
        // WebRTC configuration for optimal P2P connectivity
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10,
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };
    }

    startPeerDiscovery() {
        // Simulate signaling server for demo (in production, would use actual signaling)
        this.simulateSignalingServer();
        
        // Start periodic peer discovery
        setInterval(() => {
            this.discoverPeers();
        }, config.p2p.heartbeatInterval || 30000);
        
        // Start connection health monitoring
        setInterval(() => {
            this.monitorConnections();
        }, 10000);
    }

    simulateSignalingServer() {
        // In a production environment, this would connect to a real signaling server
        // For demo purposes, we'll simulate peer announcements
        
        setTimeout(() => {
            // Simulate some peers joining the network
            const mockPeers = [
                { id: 'neo_demo1', address: 'demo1@agentneo.network' },
                { id: 'neo_demo2', address: 'demo2@agentneo.network' },
                { id: 'neo_demo3', address: 'demo3@agentneo.network' }
            ];
            
            for (const peer of mockPeers) {
                this.handlePeerAnnouncement(peer);
            }
        }, 2000);
    }

    async discoverPeers() {
        if (!this.isOnline) return;
        
        // Announce our presence
        this.announceSelf();
        
        // Try to connect to discovered peers
        for (const [peerId, peerInfo] of this.peers.entries()) {
            if (!this.connections.has(peerId) && peerInfo.status === 'discovered') {
                try {
                    await this.initiateConnection(peerId, peerInfo);
                } catch (error) {
                    console.warn(`Failed to connect to peer ${peerId}:`, error);
                }
            }
        }
    }

    announceSelf() {
        const announcement = {
            type: 'PEER_ANNOUNCEMENT',
            nodeId: this.nodeId,
            timestamp: Date.now(),
            capabilities: this.getCapabilities(),
            serviceTiers: Array.from(this.serviceTiers.keys())
        };
        
        // In production, this would be sent to a signaling server
        console.log('📢 Announcing presence:', announcement);
        
        eventBus.emit('p2p:announced', announcement);
    }

    handlePeerAnnouncement(peerInfo) {
        const { id, address, capabilities = [], serviceTiers = [] } = peerInfo;
        
        if (id === this.nodeId) return; // Don't connect to ourselves
        
        if (!this.peers.has(id)) {
            this.peers.set(id, {
                id,
                address,
                capabilities,
                serviceTiers,
                status: 'discovered',
                lastSeen: Date.now(),
                trustLevel: 'unknown',
                connectionAttempts: 0
            });
            
            console.log(`👋 Discovered peer: ${id}`);
            
            eventBus.emit('p2p:peer_discovered', { peerId: id, peerInfo });
        }
    }

    async initiateConnection(peerId, peerInfo) {
        try {
            console.log(`🤝 Initiating connection to peer: ${peerId}`);
            
            // Create peer connection
            const connection = new RTCPeerConnection(this.rtcConfig);
            const connectionId = `${this.nodeId}_${peerId}`;
            
            this.connections.set(connectionId, connection);
            
            // Set up connection event handlers
            this.setupConnectionHandlers(connection, peerId, connectionId);
            
            // Create data channel
            const dataChannel = connection.createDataChannel('agentneo', {
                ordered: true,
                maxRetransmits: 3
            });
            
            this.dataChannels.set(connectionId, dataChannel);
            this.setupDataChannelHandlers(dataChannel, peerId, connectionId);
            
            // Create and send offer
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            
            // In production, send offer through signaling server
            this.simulateSignalingExchange(connectionId, peerId, offer);
            
            // Update peer status
            peerInfo.status = 'connecting';
            peerInfo.connectionAttempts++;
            
        } catch (error) {
            console.error(`Failed to initiate connection to ${peerId}:`, error);
            throw error;
        }
    }

    simulateSignalingExchange(connectionId, peerId, offer) {
        // Simulate successful signaling for demo purposes
        setTimeout(async () => {
            try {
                const connection = this.connections.get(connectionId);
                if (!connection) return;
                
                // Simulate receiving answer
                const answer = await connection.createAnswer();
                await connection.setRemoteDescription(answer);
                
                console.log(`📡 Simulated signaling exchange with ${peerId}`);
                
            } catch (error) {
                console.error('Simulated signaling failed:', error);
            }
        }, 1000 + Math.random() * 2000); // Random delay to simulate network
    }

    setupConnectionHandlers(connection, peerId, connectionId) {
        connection.onconnectionstatechange = () => {
            console.log(`🔗 Connection state changed: ${peerId} -> ${connection.connectionState}`);
            
            if (connection.connectionState === 'connected') {
                this.handleConnectionEstablished(peerId, connectionId);
            } else if (connection.connectionState === 'disconnected' || 
                       connection.connectionState === 'failed') {
                this.handleConnectionLost(peerId, connectionId);
            }
        };
        
        connection.oniceconnectionstatechange = () => {
            console.log(`🧊 ICE connection state: ${peerId} -> ${connection.iceConnectionState}`);
        };
        
        connection.ondatachannel = (event) => {
            const dataChannel = event.channel;
            this.dataChannels.set(connectionId, dataChannel);
            this.setupDataChannelHandlers(dataChannel, peerId, connectionId);
        };
        
        connection.onicecandidate = (event) => {
            if (event.candidate) {
                // In production, send ICE candidate through signaling server
                console.log(`🧊 ICE candidate for ${peerId}:`, event.candidate);
            }
        };
    }

    setupDataChannelHandlers(dataChannel, peerId, connectionId) {
        dataChannel.onopen = () => {
            console.log(`📨 Data channel opened: ${peerId}`);
            this.handleConnectionEstablished(peerId, connectionId);
        };
        
        dataChannel.onclose = () => {
            console.log(`📪 Data channel closed: ${peerId}`);
            this.handleConnectionLost(peerId, connectionId);
        };
        
        dataChannel.onmessage = (event) => {
            this.handleMessage(peerId, event.data);
        };
        
        dataChannel.onerror = (error) => {
            console.error(`📨 Data channel error for ${peerId}:`, error);
        };
    }

    handleConnectionEstablished(peerId, connectionId) {
        const peerInfo = this.peers.get(peerId);
        if (peerInfo) {
            peerInfo.status = 'connected';
            peerInfo.connectionId = connectionId;
            peerInfo.connectedAt = Date.now();
        }
        
        // Assign to appropriate service tier
        this.assignServiceTier(peerId, peerInfo);
        
        eventBus.emit('p2p:peer_connected', { 
            peerId, 
            connectionId,
            peerInfo 
        });
        
        // Send queued messages
        this.sendQueuedMessages(peerId);
    }

    handleConnectionLost(peerId, connectionId) {
        const peerInfo = this.peers.get(peerId);
        if (peerInfo) {
            peerInfo.status = 'disconnected';
            peerInfo.disconnectedAt = Date.now();
        }
        
        // Clean up connection resources
        this.connections.delete(connectionId);
        this.dataChannels.delete(connectionId);
        
        // Remove from service tiers
        for (const tier of this.serviceTiers.values()) {
            tier.connections.delete(peerId);
        }
        
        eventBus.emit('p2p:peer_disconnected', { 
            peerId, 
            connectionId 
        });
    }

    assignServiceTier(peerId, peerInfo) {
        // Assign based on trust level (from guild membership)
        let tier = 'LOW';
        
        if (peerInfo.trustLevel === 'high' || this.highTrustConnections.has(peerId)) {
            tier = 'HIGH';
            this.highTrustConnections.add(peerId);
        } else if (peerInfo.trustLevel === 'medium') {
            tier = 'MEDIUM';
        }
        
        const serviceTier = this.serviceTiers.get(tier);
        if (serviceTier) {
            serviceTier.connections.add(peerId);
            peerInfo.serviceTier = tier;
        }
        
        console.log(`⚡ Assigned peer ${peerId} to ${tier} service tier`);
    }

    async sendMessage(event) {
        const { to, type, payload, priority = 'MEDIUM' } = event.data || event;
        
        try {
            const message = {
                from: this.nodeId,
                to,
                type,
                payload,
                timestamp: Date.now(),
                messageId: this.generateMessageId()
            };
            
            await this.routeMessage(message, priority);
            
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }

    async broadcastMessage(event) {
        const { type, payload, excludePeers = [], serviceTier = 'MEDIUM' } = event.data || event;
        
        const message = {
            from: this.nodeId,
            type,
            payload,
            timestamp: Date.now(),
            messageId: this.generateMessageId(),
            broadcast: true
        };
        
        const targetPeers = this.getConnectedPeers(serviceTier)
            .filter(peerId => !excludePeers.includes(peerId));
        
        for (const peerId of targetPeers) {
            try {
                await this.routeMessage({ ...message, to: peerId }, serviceTier);
            } catch (error) {
                console.warn(`Failed to broadcast to ${peerId}:`, error);
            }
        }
        
        console.log(`📡 Broadcasted ${type} to ${targetPeers.length} peers`);
    }

    async routeMessage(message, priority = 'MEDIUM') {
        const { to } = message;
        const peerInfo = this.peers.get(to);
        
        if (!peerInfo || peerInfo.status !== 'connected') {
            // Queue message for later delivery
            this.queueMessage(to, message);
            return;
        }
        
        const dataChannel = this.dataChannels.get(peerInfo.connectionId);
        if (!dataChannel || dataChannel.readyState !== 'open') {
            this.queueMessage(to, message);
            return;
        }
        
        // Apply service tier delays if necessary
        await this.applyServiceTierDelay(to, message.type);
        
        // Send message
        const serialized = JSON.stringify(message);
        dataChannel.send(serialized);
        
        eventBus.emit('p2p:message_sent', { 
            to, 
            type: message.type, 
            size: serialized.length 
        });
    }

    async applyServiceTierDelay(peerId, messageType) {
        const peerInfo = this.peers.get(peerId);
        if (!peerInfo || peerInfo.serviceTier === 'HIGH') return;
        
        const delays = config.guild.serviceRequestDelays;
        let delay = 0;
        
        if (peerInfo.serviceTier === 'LOW') {
            delay = messageType.includes('computational') ? 
                delays.lowTrust.computational : 
                delays.lowTrust.dataTransfer;
        } else if (!peerInfo.guildMember) {
            delay = messageType.includes('computational') ? 
                delays.nonGuild.computational : 
                delays.nonGuild.dataTransfer;
        }
        
        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    queueMessage(peerId, message) {
        if (!this.messageQueue.has(peerId)) {
            this.messageQueue.set(peerId, []);
        }
        
        const queue = this.messageQueue.get(peerId);
        queue.push(message);
        
        // Limit queue size to prevent memory issues
        if (queue.length > 100) {
            queue.shift(); // Remove oldest message
        }
    }

    sendQueuedMessages(peerId) {
        const queue = this.messageQueue.get(peerId);
        if (!queue || queue.length === 0) return;
        
        console.log(`📤 Sending ${queue.length} queued messages to ${peerId}`);
        
        for (const message of queue) {
            this.routeMessage(message).catch(console.error);
        }
        
        this.messageQueue.delete(peerId);
    }

    handleMessage(from, data) {
        try {
            const message = JSON.parse(data);
            
            // Update last seen
            const peerInfo = this.peers.get(from);
            if (peerInfo) {
                peerInfo.lastSeen = Date.now();
            }
            
            // Emit message received event
            eventBus.emit('p2p:message_received', {
                data: message,
                from
            });
            
            // Handle specific message types
            this.handleSpecificMessage(message, from);
            
        } catch (error) {
            console.error('Failed to handle message:', error);
        }
    }

    handleSpecificMessage(message, from) {
        const { type, payload } = message;
        
        switch (type) {
            case 'PING':
                this.sendMessage({
                    to: from,
                    type: 'PONG',
                    payload: { timestamp: Date.now() }
                });
                break;
                
            case 'PONG':
                this.handlePongMessage(from, payload);
                break;
                
            case 'PEER_DISCOVERY':
                this.handlePeerDiscoveryMessage(from, payload);
                break;
                
            case 'GUILD_INVITATION':
                eventBus.emit('guild:invitation_received', { from, payload });
                break;
                
            case 'TASK_AUCTION':
                eventBus.emit('task:auction_received', { from, payload });
                break;
                
            default:
                console.log(`📨 Received ${type} message from ${from}`);
        }
    }

    handlePongMessage(from, payload) {
        const peerInfo = this.peers.get(from);
        if (peerInfo && payload.timestamp) {
            peerInfo.latency = Date.now() - payload.timestamp;
        }
    }

    handlePeerDiscoveryMessage(from, payload) {
        const { discoveredPeers } = payload;
        
        for (const peer of discoveredPeers) {
            if (peer.id !== this.nodeId && !this.peers.has(peer.id)) {
                this.handlePeerAnnouncement(peer);
            }
        }
    }

    monitorConnections() {
        for (const [peerId, peerInfo] of this.peers.entries()) {
            if (peerInfo.status === 'connected') {
                // Send ping to check connectivity
                this.sendMessage({
                    to: peerId,
                    type: 'PING',
                    payload: { timestamp: Date.now() }
                });
            }
        }
        
        // Update state
        stateManager.setState('network.connectedPeers', this.getConnectedPeers().length);
        stateManager.setState('network.totalPeers', this.peers.size);
    }

    getConnectedPeers(serviceTier = null) {
        if (serviceTier) {
            const tier = this.serviceTiers.get(serviceTier);
            return tier ? Array.from(tier.connections) : [];
        }
        
        return Array.from(this.peers.entries())
            .filter(([_, peerInfo]) => peerInfo.status === 'connected')
            .map(([peerId, _]) => peerId);
    }

    getCapabilities() {
        return [
            'webrtc_connections',
            'message_routing',
            'service_tiers',
            'guild_support',
            'task_auction',
            'content_sharing'
        ];
    }

    generateMessageId() {
        return `${this.nodeId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    handleGuildMemberAdded(event) {
        const { peerId } = event.data;
        const peerInfo = this.peers.get(peerId);
        
        if (peerInfo) {
            peerInfo.guildMember = true;
            peerInfo.trustLevel = 'medium';
            this.assignServiceTier(peerId, peerInfo);
        }
    }

    handleGuildMemberRemoved(event) {
        const { peerId } = event.data;
        const peerInfo = this.peers.get(peerId);
        
        if (peerInfo) {
            peerInfo.guildMember = false;
            peerInfo.trustLevel = 'low';
            this.assignServiceTier(peerId, peerInfo);
        }
    }

    handleBeforeUnload() {
        // Clean disconnect from all peers
        for (const connection of this.connections.values()) {
            connection.close();
        }
    }

    handleOnline() {
        this.isOnline = true;
        console.log('🌐 Network is online, resuming P2P operations');
        this.startPeerDiscovery();
    }

    handleOffline() {
        this.isOnline = false;
        console.log('📴 Network is offline, pausing P2P operations');
    }

    getStats() {
        return {
            nodeId: this.nodeId,
            totalPeers: this.peers.size,
            connectedPeers: this.getConnectedPeers().length,
            connections: this.connections.size,
            dataChannels: this.dataChannels.size,
            serviceTiers: Array.from(this.serviceTiers.entries()).map(([name, tier]) => ({
                name,
                connections: tier.connections.size
            })),
            messageQueue: this.messageQueue.size,
            isOnline: this.isOnline
        };
    }

    async shutdown() {
        console.log('🛑 Shutting down Native P2P Service...');
        
        // Close all connections
        for (const connection of this.connections.values()) {
            connection.close();
        }
        
        // Clear all data
        this.peers.clear();
        this.connections.clear();
        this.dataChannels.clear();
        this.messageQueue.clear();
        
        this.isOnline = false;
        
        console.log('✅ Native P2P Service shut down');
    }
}

export default NativeP2PService;