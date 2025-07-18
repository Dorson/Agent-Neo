/**
 * Network Manager Module
 * 
 * Handles network operations and integration with P2P service as specified
 * in the implementation plan. Provides network monitoring, connection management,
 * and peer discovery capabilities.
 * 
 * Features:
 * - Network status monitoring
 * - Connection quality assessment
 * - Peer discovery and management
 * - Network topology optimization
 * - Bandwidth management
 * - Offline/online state handling
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';
import { config } from '../core/config.js';

class NetworkManager {
    constructor() {
        this.name = 'NetworkManager';
        this.version = '1.0.0';
        this.initialized = false;
        this.online = navigator.onLine;
        
        // Connection state
        this.connectionState = {
            online: this.online,
            type: 'unknown',
            effectiveType: 'unknown',
            downlink: 0,
            rtt: 0,
            saveData: false,
            quality: 'unknown'
        };
        
        // Peer connections
        this.peers = new Map();
        this.peerStats = new Map();
        
        // Network metrics
        this.metrics = {
            bytesReceived: 0,
            bytesSent: 0,
            packetsReceived: 0,
            packetsSent: 0,
            connectionsActive: 0,
            connectionsTotal: 0,
            averageLatency: 0,
            bandwidth: 0,
            history: []
        };
        
        // Network configuration
        this.config = {
            maxConnections: config.p2p.maxConnections,
            minConnections: config.p2p.minConnections,
            heartbeatInterval: config.p2p.heartbeatInterval,
            connectionTimeout: config.p2p.connectionTimeout,
            retryAttempts: config.p2p.retryAttempts,
            qualityThresholds: {
                excellent: { rtt: 50, downlink: 10 },
                good: { rtt: 150, downlink: 5 },
                fair: { rtt: 300, downlink: 1 },
                poor: { rtt: 1000, downlink: 0.5 }
            }
        };
        
        // Monitoring intervals
        this.monitoringInterval = null;
        this.heartbeatInterval = null;
        
        this.init();
    }

    async init() {
        try {
            console.log('🌐 Initializing Network Manager...');
            
            this.setupEventListeners();
            this.detectNetworkCapabilities();
            this.startNetworkMonitoring();
            
            this.initialized = true;
            console.log('✅ Network Manager initialized');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version,
                capabilities: ['network_monitoring', 'peer_management', 'connection_quality']
            });
            
        } catch (error) {
            console.error('❌ Network Manager initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Browser network events
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
        
        // P2P events
        eventBus.on('p2p:peer-connected', this.handlePeerConnected.bind(this));
        eventBus.on('p2p:peer-disconnected', this.handlePeerDisconnected.bind(this));
        eventBus.on('p2p:message-sent', this.handleMessageSent.bind(this));
        eventBus.on('p2p:message-received', this.handleMessageReceived.bind(this));
        
        // Network management events
        eventBus.on('network:optimize-connections', this.optimizeConnections.bind(this));
        eventBus.on('network:test-connection', this.testConnection.bind(this));
        eventBus.on('network:get-status', this.getNetworkStatus.bind(this));
        
        // Configuration events
        eventBus.on('settings:network-config', this.updateNetworkConfig.bind(this));
    }

    detectNetworkCapabilities() {
        console.log('🔍 Detecting network capabilities...');
        
        // Check Network Information API
        if (navigator.connection) {
            const connection = navigator.connection;
            
            this.connectionState = {
                online: navigator.onLine,
                type: connection.type || 'unknown',
                effectiveType: connection.effectiveType || 'unknown',
                downlink: connection.downlink || 0,
                rtt: connection.rtt || 0,
                saveData: connection.saveData || false,
                quality: this.assessConnectionQuality(connection)
            };
            
            // Listen for connection changes
            connection.addEventListener('change', this.handleConnectionChange.bind(this));
            
            console.log('📡 Network Information API available:', this.connectionState);
        } else {
            console.log('⚠️ Network Information API not available');
            this.connectionState.online = navigator.onLine;
        }
        
        // Check WebRTC support
        if (window.RTCPeerConnection) {
            console.log('🔗 WebRTC support detected');
        } else {
            console.log('⚠️ WebRTC not supported');
        }
    }

    startNetworkMonitoring() {
        console.log('📊 Starting network monitoring...');
        
        // Main monitoring loop
        this.monitoringInterval = setInterval(() => {
            this.updateNetworkMetrics();
            this.assessConnectionQuality();
            this.checkPeerConnections();
            this.updateNetworkState();
        }, 5000); // Every 5 seconds
        
        // Heartbeat for active connections
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeats();
        }, this.config.heartbeatInterval);
    }

    stopNetworkMonitoring() {
        console.log('🛑 Stopping network monitoring...');
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    updateNetworkMetrics() {
        // Update connection state if Network Information API is available
        if (navigator.connection) {
            const connection = navigator.connection;
            this.connectionState = {
                ...this.connectionState,
                type: connection.type || 'unknown',
                effectiveType: connection.effectiveType || 'unknown',
                downlink: connection.downlink || 0,
                rtt: connection.rtt || 0,
                saveData: connection.saveData || false
            };
        }
        
        // Update peer connection metrics
        this.metrics.connectionsActive = this.peers.size;
        
        // Calculate average latency from peer stats
        const latencies = Array.from(this.peerStats.values())
            .map(stats => stats.latency)
            .filter(latency => latency > 0);
        
        if (latencies.length > 0) {
            this.metrics.averageLatency = latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length;
        }
        
        // Store metrics history
        this.metrics.history.push({
            timestamp: Date.now(),
            connectionState: { ...this.connectionState },
            connectionsActive: this.metrics.connectionsActive,
            averageLatency: this.metrics.averageLatency
        });
        
        // Limit history size
        if (this.metrics.history.length > 100) {
            this.metrics.history.shift();
        }
    }

    assessConnectionQuality(connection = navigator.connection) {
        if (!connection) {
            return 'unknown';
        }
        
        const { rtt, downlink } = connection;
        const thresholds = this.config.qualityThresholds;
        
        if (rtt <= thresholds.excellent.rtt && downlink >= thresholds.excellent.downlink) {
            return 'excellent';
        } else if (rtt <= thresholds.good.rtt && downlink >= thresholds.good.downlink) {
            return 'good';
        } else if (rtt <= thresholds.fair.rtt && downlink >= thresholds.fair.downlink) {
            return 'fair';
        } else {
            return 'poor';
        }
    }

    checkPeerConnections() {
        const now = Date.now();
        const staleConnections = [];
        
        // Check for stale connections
        this.peers.forEach((peer, peerId) => {
            const stats = this.peerStats.get(peerId);
            if (stats && (now - stats.lastSeen) > this.config.connectionTimeout) {
                staleConnections.push(peerId);
            }
        });
        
        // Remove stale connections
        staleConnections.forEach(peerId => {
            console.log(`🔌 Removing stale connection: ${peerId}`);
            this.removePeer(peerId);
        });
    }

    sendHeartbeats() {
        this.peers.forEach((peer, peerId) => {
            const heartbeat = {
                type: 'heartbeat',
                timestamp: Date.now(),
                peerId: peerId
            };
            
            eventBus.emit('p2p:send-message', {
                peerId: peerId,
                message: heartbeat
            });
        });
    }

    updateNetworkState() {
        stateManager.setState('network.connectionState', this.connectionState);
        stateManager.setState('network.metrics', this.metrics);
        stateManager.setState('network.peers', Array.from(this.peers.keys()));
        stateManager.setState('network.recentActivity', this.calculateRecentActivity());
    }

    calculateRecentActivity() {
        const recentMetrics = this.metrics.history.slice(-5);
        if (recentMetrics.length === 0) return 0;
        
        const totalBytes = recentMetrics.reduce((sum, metric) => 
            sum + (metric.bytesReceived || 0) + (metric.bytesSent || 0), 0);
        
        return Math.min(totalBytes / 1024, 100); // KB, capped at 100
    }

    // Event handlers
    handleOnline() {
        console.log('🌐 Network came online');
        this.connectionState.online = true;
        eventBus.emit('network:online');
        
        // Attempt to reconnect to peers
        this.reconnectPeers();
    }

    handleOffline() {
        console.log('🌐 Network went offline');
        this.connectionState.online = false;
        eventBus.emit('network:offline');
    }

    handleConnectionChange() {
        console.log('🔄 Network connection changed');
        this.detectNetworkCapabilities();
        eventBus.emit('network:connection-changed', this.connectionState);
    }

    handlePeerConnected(event) {
        const { peerId, peer } = event.detail;
        
        this.peers.set(peerId, peer);
        this.peerStats.set(peerId, {
            connectedAt: Date.now(),
            lastSeen: Date.now(),
            messagesSent: 0,
            messagesReceived: 0,
            bytesSent: 0,
            bytesReceived: 0,
            latency: 0
        });
        
        this.metrics.connectionsTotal++;
        
        console.log(`🤝 Peer connected: ${peerId}`);
        eventBus.emit('network:peer-added', { peerId, totalPeers: this.peers.size });
    }

    handlePeerDisconnected(event) {
        const { peerId } = event.detail;
        
        this.removePeer(peerId);
        
        console.log(`👋 Peer disconnected: ${peerId}`);
        eventBus.emit('network:peer-removed', { peerId, totalPeers: this.peers.size });
    }

    handleMessageSent(event) {
        const { peerId, message, size } = event.detail;
        
        this.metrics.bytesSent += size || 0;
        this.metrics.packetsSent++;
        
        const stats = this.peerStats.get(peerId);
        if (stats) {
            stats.messagesSent++;
            stats.bytesSent += size || 0;
        }
    }

    handleMessageReceived(event) {
        const { peerId, message, size } = event.detail;
        
        this.metrics.bytesReceived += size || 0;
        this.metrics.packetsReceived++;
        
        const stats = this.peerStats.get(peerId);
        if (stats) {
            stats.messagesReceived++;
            stats.bytesReceived += size || 0;
            stats.lastSeen = Date.now();
            
            // Calculate latency if this is a heartbeat response
            if (message.type === 'heartbeat-response') {
                stats.latency = Date.now() - message.originalTimestamp;
            }
        }
    }

    removePeer(peerId) {
        this.peers.delete(peerId);
        this.peerStats.delete(peerId);
    }

    reconnectPeers() {
        console.log('🔄 Attempting to reconnect to peers...');
        eventBus.emit('p2p:reconnect-peers');
    }

    // Connection optimization
    optimizeConnections() {
        console.log('🔧 Optimizing network connections...');
        
        const currentConnections = this.peers.size;
        const targetConnections = this.calculateOptimalConnections();
        
        if (currentConnections < targetConnections) {
            // Need more connections
            const needed = targetConnections - currentConnections;
            console.log(`📈 Need ${needed} more connections`);
            eventBus.emit('p2p:discover-peers', { count: needed });
        } else if (currentConnections > targetConnections) {
            // Too many connections, drop the worst ones
            const excess = currentConnections - targetConnections;
            this.dropWorstConnections(excess);
        }
    }

    calculateOptimalConnections() {
        const quality = this.connectionState.quality;
        const baseConnections = this.config.minConnections;
        
        switch (quality) {
            case 'excellent':
                return Math.min(this.config.maxConnections, baseConnections + 10);
            case 'good':
                return Math.min(this.config.maxConnections, baseConnections + 5);
            case 'fair':
                return baseConnections + 2;
            case 'poor':
                return baseConnections;
            default:
                return baseConnections;
        }
    }

    dropWorstConnections(count) {
        const peersByQuality = Array.from(this.peerStats.entries())
            .sort((a, b) => {
                const statsA = a[1];
                const statsB = b[1];
                
                // Sort by latency (higher is worse) and activity (lower is worse)
                const scoreA = statsA.latency + (1000 / Math.max(1, statsA.messagesReceived));
                const scoreB = statsB.latency + (1000 / Math.max(1, statsB.messagesReceived));
                
                return scoreB - scoreA;
            });
        
        for (let i = 0; i < count && i < peersByQuality.length; i++) {
            const [peerId] = peersByQuality[i];
            console.log(`🔌 Dropping poor quality connection: ${peerId}`);
            eventBus.emit('p2p:disconnect-peer', { peerId });
        }
    }

    // Connection testing
    async testConnection(peerId) {
        const startTime = Date.now();
        
        try {
            const testMessage = {
                type: 'connection-test',
                timestamp: startTime,
                data: 'x'.repeat(1024) // 1KB test data
            };
            
            eventBus.emit('p2p:send-message', {
                peerId: peerId,
                message: testMessage
            });
            
            // Wait for response (simplified - in real implementation would use promise)
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    resolve({
                        success: false,
                        latency: -1,
                        error: 'timeout'
                    });
                }, 5000);
                
                const handleResponse = (event) => {
                    if (event.detail.message.type === 'connection-test-response') {
                        clearTimeout(timeout);
                        eventBus.off('p2p:message-received', handleResponse);
                        
                        resolve({
                            success: true,
                            latency: Date.now() - startTime,
                            bandwidth: 1024 / ((Date.now() - startTime) / 1000) // bytes per second
                        });
                    }
                };
                
                eventBus.on('p2p:message-received', handleResponse);
            });
            
        } catch (error) {
            return {
                success: false,
                latency: -1,
                error: error.message
            };
        }
    }

    // Configuration management
    updateNetworkConfig(event) {
        const { config: newConfig } = event.detail;
        this.config = { ...this.config, ...newConfig };
        
        console.log('🔧 Network configuration updated:', this.config);
        eventBus.emit('network:config-updated', this.config);
    }

    // Public API
    getNetworkStatus() {
        return {
            initialized: this.initialized,
            connectionState: this.connectionState,
            metrics: this.metrics,
            peers: Array.from(this.peers.keys()),
            peerCount: this.peers.size,
            config: this.config
        };
    }

    getPeerStats(peerId) {
        return this.peerStats.get(peerId) || null;
    }

    getAllPeerStats() {
        return Object.fromEntries(this.peerStats);
    }

    getConnectionQuality() {
        return this.connectionState.quality;
    }

    isOnline() {
        return this.connectionState.online;
    }

    getNetworkMetrics() {
        return { ...this.metrics };
    }

    // Health check
    async healthCheck() {
        const quality = this.assessConnectionQuality();
        
        return {
            initialized: this.initialized,
            online: this.connectionState.online,
            quality: quality,
            peers: this.peers.size,
            metrics: {
                averageLatency: this.metrics.averageLatency,
                connectionsActive: this.metrics.connectionsActive,
                bytesTransferred: this.metrics.bytesSent + this.metrics.bytesReceived
            }
        };
    }

    // Cleanup
    async shutdown() {
        console.log('🛑 Shutting down Network Manager...');
        
        this.stopNetworkMonitoring();
        
        // Disconnect all peers
        this.peers.forEach((peer, peerId) => {
            eventBus.emit('p2p:disconnect-peer', { peerId });
        });
        
        this.peers.clear();
        this.peerStats.clear();
        this.metrics.history = [];
        
        // Remove event listeners
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
        
        console.log('✅ Network Manager shutdown complete');
    }
}

// Create singleton instance
const networkManager = new NetworkManager();

export default networkManager;