/**
 * Network Monitor Module
 * 
 * Monitors the agent's network connectivity, peer status, and overall network health
 * as specified in the Agent Neo implementation plan Step 13.
 * 
 * Features:
 * - Real-time peer connection monitoring
 * - Latency and bandwidth measurement
 * - Network health assessment
 * - Peer scoring and reputation tracking
 * - Connection quality metrics
 * - Network topology analysis
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';
import p2pService from './P2PService.js';

class NetworkMonitor {
    constructor() {
        this.initialized = false;
        this.version = '1.0.0';
        
        // Network state tracking
        this.peers = new Map(); // peerId -> PeerMetrics
        this.connectionHistory = new Map(); // peerId -> ConnectionHistory[]
        this.networkHealth = {
            overallScore: 0,
            connectedPeers: 0,
            averageLatency: 0,
            averageBandwidth: 0,
            uptime: 0,
            lastUpdate: Date.now()
        };
        
        // Monitoring configuration
        this.config = {
            pingInterval: 10000,      // 10 seconds
            healthCheckInterval: 30000, // 30 seconds
            latencyThreshold: 1000,   // 1 second
            bandwidthThreshold: 100000, // 100KB/s
            connectionTimeout: 30000, // 30 seconds
            maxHistoryEntries: 1000,  // Per peer
            peerScoreDecay: 0.95,     // Score decay per interval
            minPeersThreshold: 3,     // Minimum healthy peer count
            maxPeersThreshold: 50     // Maximum peer count
        };
        
        // Performance metrics
        this.metrics = {
            totalBytesReceived: 0,
            totalBytesSent: 0,
            totalMessages: 0,
            errorCount: 0,
            reconnectCount: 0,
            startTime: Date.now()
        };
        
        // Network topology data
        this.topology = {
            nodes: new Map(),
            edges: new Map(),
            clusters: new Map(),
            centralityScores: new Map()
        };
        
        this.init();
    }

    async init() {
        try {
            console.log('📊 Network Monitor initializing...');
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Start monitoring processes
            this.startPingMonitoring();
            this.startHealthChecking();
            this.startTopologyAnalysis();
            
            this.initialized = true;
            console.log('✅ Network Monitor initialized successfully');
            
        } catch (error) {
            console.error('❌ Network Monitor initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // P2P network events
        eventBus.on('p2p:peer_connected', this.handlePeerConnected.bind(this));
        eventBus.on('p2p:peer_disconnected', this.handlePeerDisconnected.bind(this));
        eventBus.on('p2p:message_received', this.handleMessageReceived.bind(this));
        eventBus.on('p2p:message_sent', this.handleMessageSent.bind(this));
        eventBus.on('p2p:connection_error', this.handleConnectionError.bind(this));
        
        // Data transfer events
        eventBus.on('transport:download_progress', this.handleDataTransfer.bind(this));
        eventBus.on('transport:upload_progress', this.handleDataTransfer.bind(this));
        
        // Network requests
        eventBus.on('monitor:get_peer_metrics', this.handleGetPeerMetrics.bind(this));
        eventBus.on('monitor:get_network_health', this.handleGetNetworkHealth.bind(this));
        eventBus.on('monitor:get_topology', this.handleGetTopology.bind(this));
    }

    /**
     * Handle new peer connection
     */
    handlePeerConnected(event) {
        try {
            const { peerId, connectionInfo } = event.detail;
            
            console.log(`🔗 Peer connected: ${peerId}`);
            
            // Initialize peer metrics
            const peerMetrics = {
                peerId: peerId,
                connected: true,
                connectedAt: Date.now(),
                lastSeen: Date.now(),
                
                // Connection metrics
                latency: 0,
                bandwidth: 0,
                jitter: 0,
                packetLoss: 0,
                
                // Quality metrics
                reliability: 1.0,
                score: 1.0,
                trustLevel: 'UNKNOWN',
                
                // Traffic metrics
                bytesReceived: 0,
                bytesSent: 0,
                messagesReceived: 0,
                messagesSent: 0,
                errors: 0,
                
                // Connection details
                transport: connectionInfo?.transport || 'unknown',
                protocol: connectionInfo?.protocol || 'unknown',
                remoteAddress: connectionInfo?.remoteAddress || 'unknown',
                
                // History
                connectionHistory: [],
                latencyHistory: [],
                bandwidthHistory: []
            };
            
            this.peers.set(peerId, peerMetrics);
            
            // Update network health
            this.updateNetworkHealth();
            
            // Notify state manager
            stateManager.setState('network.connectedPeers', this.peers.size);
            
            // Emit monitoring event
            eventBus.emit('monitor:peer_connected', {
                peerId: peerId,
                metrics: peerMetrics
            });
            
        } catch (error) {
            console.error('❌ Failed to handle peer connected:', error);
        }
    }

    /**
     * Handle peer disconnection
     */
    handlePeerDisconnected(event) {
        try {
            const { peerId, reason } = event.detail;
            
            console.log(`🔌 Peer disconnected: ${peerId} (${reason})`);
            
            const peerMetrics = this.peers.get(peerId);
            if (peerMetrics) {
                // Update connection state
                peerMetrics.connected = false;
                peerMetrics.disconnectedAt = Date.now();
                peerMetrics.disconnectReason = reason;
                
                // Record connection history
                const connectionDuration = Date.now() - peerMetrics.connectedAt;
                peerMetrics.connectionHistory.push({
                    connectedAt: peerMetrics.connectedAt,
                    disconnectedAt: Date.now(),
                    duration: connectionDuration,
                    reason: reason,
                    avgLatency: this.calculateAverageLatency(peerMetrics),
                    avgBandwidth: this.calculateAverageBandwidth(peerMetrics)
                });
                
                // Keep in peers map for a while for historical data
                setTimeout(() => {
                    this.peers.delete(peerId);
                }, 5 * 60 * 1000); // 5 minutes
            }
            
            // Update network health
            this.updateNetworkHealth();
            
            // Update state
            stateManager.setState('network.connectedPeers', this.peers.size);
            
            // Emit monitoring event
            eventBus.emit('monitor:peer_disconnected', {
                peerId: peerId,
                reason: reason,
                metrics: peerMetrics
            });
            
        } catch (error) {
            console.error('❌ Failed to handle peer disconnected:', error);
        }
    }

    /**
     * Handle received message for metrics
     */
    handleMessageReceived(event) {
        try {
            const { peerId, message, size } = event.detail;
            
            const peerMetrics = this.peers.get(peerId);
            if (peerMetrics) {
                peerMetrics.lastSeen = Date.now();
                peerMetrics.messagesReceived++;
                peerMetrics.bytesReceived += size || 0;
                
                // Calculate latency if message has timestamp
                if (message.timestamp) {
                    const latency = Date.now() - new Date(message.timestamp).getTime();
                    this.updateLatencyMetrics(peerId, latency);
                }
            }
            
            this.metrics.totalMessages++;
            this.metrics.totalBytesReceived += size || 0;
            
        } catch (error) {
            console.error('❌ Failed to handle message received:', error);
        }
    }

    /**
     * Handle sent message for metrics
     */
    handleMessageSent(event) {
        try {
            const { peerId, message, size } = event.detail;
            
            const peerMetrics = this.peers.get(peerId);
            if (peerMetrics) {
                peerMetrics.messagesSent++;
                peerMetrics.bytesSent += size || 0;
            }
            
            this.metrics.totalBytesSent += size || 0;
            
        } catch (error) {
            console.error('❌ Failed to handle message sent:', error);
        }
    }

    /**
     * Handle connection errors
     */
    handleConnectionError(event) {
        try {
            const { peerId, error } = event.detail;
            
            const peerMetrics = this.peers.get(peerId);
            if (peerMetrics) {
                peerMetrics.errors++;
                peerMetrics.reliability = Math.max(0, peerMetrics.reliability - 0.1);
                peerMetrics.score = Math.max(0, peerMetrics.score - 0.05);
            }
            
            this.metrics.errorCount++;
            
            console.warn(`⚠️ Connection error with peer ${peerId}:`, error);
            
        } catch (error) {
            console.error('❌ Failed to handle connection error:', error);
        }
    }

    /**
     * Handle data transfer events for bandwidth calculation
     */
    handleDataTransfer(event) {
        try {
            const { peerId, bytes, duration } = event.detail;
            
            if (peerId && bytes && duration) {
                const bandwidth = bytes / (duration / 1000); // bytes per second
                this.updateBandwidthMetrics(peerId, bandwidth);
            }
            
        } catch (error) {
            console.error('❌ Failed to handle data transfer:', error);
        }
    }

    /**
     * Update latency metrics for a peer
     */
    updateLatencyMetrics(peerId, latency) {
        try {
            const peerMetrics = this.peers.get(peerId);
            if (!peerMetrics) return;
            
            // Add to history
            peerMetrics.latencyHistory.push({
                timestamp: Date.now(),
                latency: latency
            });
            
            // Limit history size
            if (peerMetrics.latencyHistory.length > this.config.maxHistoryEntries) {
                peerMetrics.latencyHistory.shift();
            }
            
            // Update current latency (moving average)
            const recentLatencies = peerMetrics.latencyHistory
                .slice(-10)
                .map(entry => entry.latency);
            
            peerMetrics.latency = recentLatencies.reduce((sum, lat) => sum + lat, 0) / recentLatencies.length;
            
            // Calculate jitter
            if (recentLatencies.length > 1) {
                const diffs = [];
                for (let i = 1; i < recentLatencies.length; i++) {
                    diffs.push(Math.abs(recentLatencies[i] - recentLatencies[i-1]));
                }
                peerMetrics.jitter = diffs.reduce((sum, diff) => sum + diff, 0) / diffs.length;
            }
            
            // Update peer score based on latency
            if (latency > this.config.latencyThreshold) {
                peerMetrics.score = Math.max(0, peerMetrics.score - 0.01);
            } else {
                peerMetrics.score = Math.min(1, peerMetrics.score + 0.001);
            }
            
        } catch (error) {
            console.error('❌ Failed to update latency metrics:', error);
        }
    }

    /**
     * Update bandwidth metrics for a peer
     */
    updateBandwidthMetrics(peerId, bandwidth) {
        try {
            const peerMetrics = this.peers.get(peerId);
            if (!peerMetrics) return;
            
            // Add to history
            peerMetrics.bandwidthHistory.push({
                timestamp: Date.now(),
                bandwidth: bandwidth
            });
            
            // Limit history size
            if (peerMetrics.bandwidthHistory.length > this.config.maxHistoryEntries) {
                peerMetrics.bandwidthHistory.shift();
            }
            
            // Update current bandwidth (moving average)
            const recentBandwidths = peerMetrics.bandwidthHistory
                .slice(-10)
                .map(entry => entry.bandwidth);
            
            peerMetrics.bandwidth = recentBandwidths.reduce((sum, bw) => sum + bw, 0) / recentBandwidths.length;
            
            // Update peer score based on bandwidth
            if (bandwidth < this.config.bandwidthThreshold) {
                peerMetrics.score = Math.max(0, peerMetrics.score - 0.01);
            } else {
                peerMetrics.score = Math.min(1, peerMetrics.score + 0.001);
            }
            
        } catch (error) {
            console.error('❌ Failed to update bandwidth metrics:', error);
        }
    }

    /**
     * Start periodic ping monitoring
     */
    startPingMonitoring() {
        setInterval(() => {
            this.pingAllPeers();
        }, this.config.pingInterval);
    }

    /**
     * Ping all connected peers to measure latency
     */
    async pingAllPeers() {
        try {
            const connectedPeers = Array.from(this.peers.entries())
                .filter(([_, metrics]) => metrics.connected);
            
            for (const [peerId, metrics] of connectedPeers) {
                await this.pingPeer(peerId);
            }
            
        } catch (error) {
            console.error('❌ Failed to ping peers:', error);
        }
    }

    /**
     * Ping specific peer
     */
    async pingPeer(peerId) {
        try {
            const startTime = Date.now();
            
            // Send ping message
            eventBus.emit('p2p:send_message', {
                recipient: peerId,
                message: {
                    type: 'PING',
                    timestamp: startTime,
                    nonce: Math.random().toString(36).substr(2, 9)
                }
            });
            
            // Set timeout for response
            const timeout = setTimeout(() => {
                this.handlePingTimeout(peerId);
            }, this.config.connectionTimeout);
            
            // Listen for pong response
            const handlePong = (event) => {
                const { message, sender } = event.detail;
                if (sender === peerId && message.type === 'PONG') {
                    clearTimeout(timeout);
                    const latency = Date.now() - startTime;
                    this.updateLatencyMetrics(peerId, latency);
                    eventBus.off('protocol:pong', handlePong);
                }
            };
            
            eventBus.on('protocol:pong', handlePong);
            
        } catch (error) {
            console.error(`❌ Failed to ping peer ${peerId}:`, error);
        }
    }

    /**
     * Handle ping timeout
     */
    handlePingTimeout(peerId) {
        try {
            const peerMetrics = this.peers.get(peerId);
            if (peerMetrics) {
                peerMetrics.score = Math.max(0, peerMetrics.score - 0.1);
                peerMetrics.reliability = Math.max(0, peerMetrics.reliability - 0.05);
                
                console.warn(`⚠️ Ping timeout for peer: ${peerId}`);
            }
            
        } catch (error) {
            console.error('❌ Failed to handle ping timeout:', error);
        }
    }

    /**
     * Start periodic health checking
     */
    startHealthChecking() {
        setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
    }

    /**
     * Perform comprehensive network health check
     */
    performHealthCheck() {
        try {
            // Update network health metrics
            this.updateNetworkHealth();
            
            // Check for stale peers
            this.checkStalePeers();
            
            // Decay peer scores
            this.decayPeerScores();
            
            // Analyze network topology
            this.analyzeTopology();
            
            // Emit health update
            eventBus.emit('monitor:health_updated', {
                health: this.networkHealth,
                peerCount: this.peers.size,
                metrics: this.metrics
            });
            
        } catch (error) {
            console.error('❌ Failed to perform health check:', error);
        }
    }

    /**
     * Update overall network health
     */
    updateNetworkHealth() {
        try {
            const connectedPeers = Array.from(this.peers.values())
                .filter(metrics => metrics.connected);
            
            this.networkHealth.connectedPeers = connectedPeers.length;
            
            if (connectedPeers.length > 0) {
                // Calculate average latency
                const latencies = connectedPeers
                    .map(peer => peer.latency)
                    .filter(lat => lat > 0);
                
                this.networkHealth.averageLatency = latencies.length > 0 
                    ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length 
                    : 0;
                
                // Calculate average bandwidth
                const bandwidths = connectedPeers
                    .map(peer => peer.bandwidth)
                    .filter(bw => bw > 0);
                
                this.networkHealth.averageBandwidth = bandwidths.length > 0
                    ? bandwidths.reduce((sum, bw) => sum + bw, 0) / bandwidths.length
                    : 0;
                
                // Calculate overall health score
                const peerScores = connectedPeers.map(peer => peer.score);
                const avgScore = peerScores.reduce((sum, score) => sum + score, 0) / peerScores.length;
                
                const peerCountScore = Math.min(1, connectedPeers.length / this.config.minPeersThreshold);
                const latencyScore = Math.max(0, 1 - (this.networkHealth.averageLatency / this.config.latencyThreshold));
                const bandwidthScore = Math.min(1, this.networkHealth.averageBandwidth / this.config.bandwidthThreshold);
                
                this.networkHealth.overallScore = (avgScore + peerCountScore + latencyScore + bandwidthScore) / 4;
            } else {
                this.networkHealth.overallScore = 0;
                this.networkHealth.averageLatency = 0;
                this.networkHealth.averageBandwidth = 0;
            }
            
            // Calculate uptime
            this.networkHealth.uptime = Date.now() - this.metrics.startTime;
            this.networkHealth.lastUpdate = Date.now();
            
            // Update state manager
            stateManager.setState('network.health', this.networkHealth);
            
        } catch (error) {
            console.error('❌ Failed to update network health:', error);
        }
    }

    /**
     * Check for stale peers and clean up
     */
    checkStalePeers() {
        try {
            const now = Date.now();
            const staleThreshold = 5 * 60 * 1000; // 5 minutes
            
            for (const [peerId, metrics] of this.peers) {
                if (metrics.connected && (now - metrics.lastSeen) > staleThreshold) {
                    console.warn(`⚠️ Peer appears stale: ${peerId}`);
                    
                    // Mark as potentially stale
                    metrics.score = Math.max(0, metrics.score - 0.2);
                    
                    // Attempt to reconnect or disconnect
                    eventBus.emit('p2p:check_peer_connection', { peerId });
                }
            }
            
        } catch (error) {
            console.error('❌ Failed to check stale peers:', error);
        }
    }

    /**
     * Decay peer scores over time
     */
    decayPeerScores() {
        try {
            for (const [peerId, metrics] of this.peers) {
                if (metrics.connected) {
                    metrics.score *= this.config.peerScoreDecay;
                    metrics.reliability *= this.config.peerScoreDecay;
                }
            }
            
        } catch (error) {
            console.error('❌ Failed to decay peer scores:', error);
        }
    }

    /**
     * Start topology analysis
     */
    startTopologyAnalysis() {
        setInterval(() => {
            this.analyzeTopology();
        }, 60000); // 1 minute
    }

    /**
     * Analyze network topology
     */
    analyzeTopology() {
        try {
            // Update topology data
            this.updateTopologyData();
            
            // Calculate centrality measures
            this.calculateCentralityScores();
            
            // Detect clusters
            this.detectClusters();
            
            // Emit topology update
            eventBus.emit('monitor:topology_updated', {
                topology: this.topology
            });
            
        } catch (error) {
            console.error('❌ Failed to analyze topology:', error);
        }
    }

    /**
     * Update topology data structures
     */
    updateTopologyData() {
        try {
            // Clear existing data
            this.topology.nodes.clear();
            this.topology.edges.clear();
            
            // Add connected peers as nodes
            for (const [peerId, metrics] of this.peers) {
                if (metrics.connected) {
                    this.topology.nodes.set(peerId, {
                        id: peerId,
                        score: metrics.score,
                        latency: metrics.latency,
                        bandwidth: metrics.bandwidth,
                        connections: 0
                    });
                }
            }
            
            // Add edges (this would be populated by peer discovery information)
            // For now, assume all peers are connected to us
            const ourId = 'self'; // This would be our actual peer ID
            
            for (const peerId of this.topology.nodes.keys()) {
                if (peerId !== ourId) {
                    const edgeId = `${ourId}-${peerId}`;
                    this.topology.edges.set(edgeId, {
                        from: ourId,
                        to: peerId,
                        weight: this.peers.get(peerId)?.score || 0
                    });
                }
            }
            
        } catch (error) {
            console.error('❌ Failed to update topology data:', error);
        }
    }

    /**
     * Calculate centrality scores
     */
    calculateCentralityScores() {
        try {
            // Simple degree centrality for now
            this.topology.centralityScores.clear();
            
            for (const [nodeId, node] of this.topology.nodes) {
                let degree = 0;
                
                for (const edge of this.topology.edges.values()) {
                    if (edge.from === nodeId || edge.to === nodeId) {
                        degree++;
                    }
                }
                
                this.topology.centralityScores.set(nodeId, degree);
            }
            
        } catch (error) {
            console.error('❌ Failed to calculate centrality scores:', error);
        }
    }

    /**
     * Detect network clusters
     */
    detectClusters() {
        try {
            // Simple clustering based on connection quality
            this.topology.clusters.clear();
            
            const highQualityPeers = Array.from(this.peers.entries())
                .filter(([_, metrics]) => metrics.connected && metrics.score > 0.7)
                .map(([peerId, _]) => peerId);
            
            if (highQualityPeers.length > 0) {
                this.topology.clusters.set('high-quality', {
                    id: 'high-quality',
                    members: highQualityPeers,
                    avgScore: this.calculateClusterScore(highQualityPeers)
                });
            }
            
        } catch (error) {
            console.error('❌ Failed to detect clusters:', error);
        }
    }

    /**
     * Calculate average score for cluster
     */
    calculateClusterScore(peerIds) {
        try {
            const scores = peerIds
                .map(peerId => this.peers.get(peerId)?.score || 0)
                .filter(score => score > 0);
            
            return scores.length > 0 
                ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
                : 0;
                
        } catch (error) {
            console.error('❌ Failed to calculate cluster score:', error);
            return 0;
        }
    }

    /**
     * Calculate average latency for peer
     */
    calculateAverageLatency(peerMetrics) {
        try {
            if (peerMetrics.latencyHistory.length === 0) return 0;
            
            const latencies = peerMetrics.latencyHistory.map(entry => entry.latency);
            return latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
            
        } catch (error) {
            console.error('❌ Failed to calculate average latency:', error);
            return 0;
        }
    }

    /**
     * Calculate average bandwidth for peer
     */
    calculateAverageBandwidth(peerMetrics) {
        try {
            if (peerMetrics.bandwidthHistory.length === 0) return 0;
            
            const bandwidths = peerMetrics.bandwidthHistory.map(entry => entry.bandwidth);
            return bandwidths.reduce((sum, bw) => sum + bw, 0) / bandwidths.length;
            
        } catch (error) {
            console.error('❌ Failed to calculate average bandwidth:', error);
            return 0;
        }
    }

    /**
     * Handle request for peer metrics
     */
    handleGetPeerMetrics(event) {
        try {
            const { peerId } = event.detail;
            
            if (peerId) {
                const metrics = this.peers.get(peerId);
                eventBus.emit('monitor:peer_metrics_response', {
                    peerId: peerId,
                    metrics: metrics
                });
            } else {
                // Return all peer metrics
                const allMetrics = Array.from(this.peers.entries()).map(([id, metrics]) => ({
                    peerId: id,
                    ...metrics
                }));
                
                eventBus.emit('monitor:peer_metrics_response', {
                    metrics: allMetrics
                });
            }
            
        } catch (error) {
            console.error('❌ Failed to handle get peer metrics:', error);
        }
    }

    /**
     * Handle request for network health
     */
    handleGetNetworkHealth(event) {
        try {
            eventBus.emit('monitor:network_health_response', {
                health: this.networkHealth,
                metrics: this.metrics
            });
            
        } catch (error) {
            console.error('❌ Failed to handle get network health:', error);
        }
    }

    /**
     * Handle request for topology data
     */
    handleGetTopology(event) {
        try {
            eventBus.emit('monitor:topology_response', {
                topology: this.topology
            });
            
        } catch (error) {
            console.error('❌ Failed to handle get topology:', error);
        }
    }

    /**
     * Get current network statistics
     */
    getNetworkStats() {
        return {
            health: this.networkHealth,
            metrics: this.metrics,
            peerCount: this.peers.size,
            connectedPeerCount: Array.from(this.peers.values()).filter(p => p.connected).length,
            topology: this.topology
        };
    }

    /**
     * Get peer statistics by ID
     */
    getPeerStats(peerId) {
        return this.peers.get(peerId) || null;
    }

    /**
     * Get top peers by score
     */
    getTopPeers(limit = 10) {
        return Array.from(this.peers.entries())
            .filter(([_, metrics]) => metrics.connected)
            .sort((a, b) => b[1].score - a[1].score)
            .slice(0, limit)
            .map(([peerId, metrics]) => ({ peerId, ...metrics }));
    }
}

// Create and export singleton instance
const networkMonitor = new NetworkMonitor();
export default networkMonitor;