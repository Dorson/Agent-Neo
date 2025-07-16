/**
 * NetworkView Component - P2P Network Visualization
 * 
 * Provides a comprehensive interface for monitoring P2P network health and connections
 * as described in the whitepaper. Features:
 * - Real-time peer connection visualization
 * - Network topology mapping
 * - Connection quality monitoring
 * - Protocol status tracking
 * - Network health analytics
 * - Peer discovery and management
 * - Network optimization controls
 */

import eventBus from '../../core/EventBus.js';
import stateManager from '../../core/StateManager.js';

class NetworkView {
    constructor() {
        this.name = 'NetworkView';
        this.initialized = false;
        this.container = null;
        
        // Network state
        this.networkState = {
            isOnline: navigator.onLine,
            nodeId: null,
            peers: new Map(),
            connections: new Map(),
            protocols: new Map(),
            topology: null
        };
        
        // Network metrics
        this.metrics = {
            totalPeers: 0,
            activePeers: 0,
            connectionQuality: 0,
            bandwidth: 0,
            latency: 0,
            throughput: 0,
            reliability: 0
        };
        
        // Visualization state
        this.visualization = {
            canvas: null,
            context: null,
            nodes: [],
            edges: [],
            animationId: null,
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            isDragging: false,
            selectedNode: null
        };
        
        // UI elements
        this.elements = {};
        
        // Configuration
        this.config = {
            maxPeers: 20,
            visualizationFPS: 30,
            nodeSize: 20,
            edgeWidth: 2,
            colors: {
                self: '#4CAF50',
                peer: '#2196F3',
                connection: '#FFC107',
                weakConnection: '#FF9800',
                strongConnection: '#4CAF50',
                background: '#1a1a2e'
            }
        };
        
        this.init();
    }
    
    async init() {
        try {
            console.log('🌐 Initializing NetworkView...');
            
            this.setupEventListeners();
            this.loadState();
            this.initializeVisualization();
            
            this.initialized = true;
            console.log('✅ NetworkView initialized');
            
        } catch (error) {
            console.error('❌ NetworkView initialization failed:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        // Network events
        eventBus.on('network:peer-connected', this.handlePeerConnected.bind(this));
        eventBus.on('network:peer-disconnected', this.handlePeerDisconnected.bind(this));
        eventBus.on('network:connection-updated', this.handleConnectionUpdated.bind(this));
        eventBus.on('network:protocol-updated', this.handleProtocolUpdated.bind(this));
        eventBus.on('network:topology-changed', this.handleTopologyChanged.bind(this));
        
        // System events
        eventBus.on('system:online', this.handleOnlineStatusChange.bind(this));
        eventBus.on('system:offline', this.handleOnlineStatusChange.bind(this));
        
        // UI events
        eventBus.on('view:activate', this.handleViewActivate.bind(this));
        eventBus.on('ui:network-optimize', this.optimizeNetwork.bind(this));
        eventBus.on('ui:network-refresh', this.refreshNetwork.bind(this));
        
        // Browser events
        window.addEventListener('online', this.handleOnlineStatusChange.bind(this));
        window.addEventListener('offline', this.handleOnlineStatusChange.bind(this));
    }
    
    loadState() {
        this.networkState = stateManager.getState('network', this.networkState);
        this.metrics = stateManager.getState('networkMetrics', this.metrics);
    }
    
    initializeVisualization() {
        // Initialize canvas-based network visualization
        this.visualization.nodes = [];
        this.visualization.edges = [];
        
        // Add self node
        this.visualization.nodes.push({
            id: 'self',
            x: 250,
            y: 250,
            vx: 0,
            vy: 0,
            type: 'self',
            label: 'Agent Neo',
            quality: 1.0,
            connections: 0
        });
    }
    
    render(container) {
        if (!container) return;
        
        this.container = container;
        
        container.innerHTML = `
            <div class="network-view">
                <div class="view-header">
                    <h2>P2P Network</h2>
                    <p>Monitor peer connections and network health</p>
                </div>
                
                <!-- Network Status -->
                <div class="network-status">
                    <div class="status-card">
                        <div class="status-indicator ${this.networkState.isOnline ? 'online' : 'offline'}"></div>
                        <div class="status-label">Network Status</div>
                        <div class="status-value">${this.networkState.isOnline ? 'Online' : 'Offline'}</div>
                    </div>
                    <div class="status-card">
                        <div class="status-label">Connected Peers</div>
                        <div class="status-value" id="connectedPeers">${this.metrics.activePeers}</div>
                    </div>
                    <div class="status-card">
                        <div class="status-label">Connection Quality</div>
                        <div class="status-value" id="connectionQuality">${Math.round(this.metrics.connectionQuality)}%</div>
                    </div>
                    <div class="status-card">
                        <div class="status-label">Bandwidth</div>
                        <div class="status-value" id="bandwidth">${this.formatBandwidth(this.metrics.bandwidth)}</div>
                    </div>
                </div>
                
                <!-- Network Controls -->
                <div class="network-controls">
                    <button class="btn btn-primary" id="refreshNetworkBtn">
                        <span class="btn-icon">🔄</span>
                        <span class="btn-text">Refresh</span>
                    </button>
                    <button class="btn btn-secondary" id="optimizeNetworkBtn">
                        <span class="btn-icon">⚡</span>
                        <span class="btn-text">Optimize</span>
                    </button>
                    <button class="btn btn-secondary" id="discoveryBtn">
                        <span class="btn-icon">🔍</span>
                        <span class="btn-text">Discover Peers</span>
                    </button>
                    <button class="btn btn-secondary" id="topologyBtn">
                        <span class="btn-icon">🗺️</span>
                        <span class="btn-text">Topology</span>
                    </button>
                </div>
                
                <!-- Network Visualization -->
                <div class="network-visualization">
                    <div class="visualization-header">
                        <h3>Network Topology</h3>
                        <div class="visualization-controls">
                            <button class="btn btn-small" id="zoomInBtn">🔍+</button>
                            <button class="btn btn-small" id="zoomOutBtn">🔍-</button>
                            <button class="btn btn-small" id="resetViewBtn">🎯</button>
                        </div>
                    </div>
                    <div class="visualization-container">
                        <canvas id="networkCanvas" width="500" height="400"></canvas>
                        <div class="visualization-overlay">
                            <div class="legend">
                                <div class="legend-item">
                                    <div class="legend-color self"></div>
                                    <span>This Node</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-color peer"></div>
                                    <span>Peer Node</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-color strong-connection"></div>
                                    <span>Strong Connection</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-color weak-connection"></div>
                                    <span>Weak Connection</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Peer List -->
                <div class="peer-list-section">
                    <h3>Connected Peers</h3>
                    <div class="peer-list" id="peerList">
                        ${this.renderPeerList()}
                    </div>
                </div>
                
                <!-- Network Metrics -->
                <div class="network-metrics">
                    <h3>Network Metrics</h3>
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <div class="metric-label">Average Latency</div>
                            <div class="metric-value" id="avgLatency">${this.metrics.latency}ms</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Throughput</div>
                            <div class="metric-value" id="throughput">${this.formatThroughput(this.metrics.throughput)}</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Reliability</div>
                            <div class="metric-value" id="reliability">${Math.round(this.metrics.reliability)}%</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-label">Protocol Version</div>
                            <div class="metric-value" id="protocolVersion">v2.0</div>
                        </div>
                    </div>
                </div>
                
                <!-- Protocol Status -->
                <div class="protocol-status">
                    <h3>Protocol Status</h3>
                    <div class="protocol-list" id="protocolList">
                        ${this.renderProtocolList()}
                    </div>
                </div>
            </div>
        `;
        
        this.bindEvents();
        this.setupVisualization();
        this.startVisualization();
    }
    
    bindEvents() {
        // Get UI elements
        this.elements.refreshNetworkBtn = this.container.querySelector('#refreshNetworkBtn');
        this.elements.optimizeNetworkBtn = this.container.querySelector('#optimizeNetworkBtn');
        this.elements.discoveryBtn = this.container.querySelector('#discoveryBtn');
        this.elements.topologyBtn = this.container.querySelector('#topologyBtn');
        this.elements.zoomInBtn = this.container.querySelector('#zoomInBtn');
        this.elements.zoomOutBtn = this.container.querySelector('#zoomOutBtn');
        this.elements.resetViewBtn = this.container.querySelector('#resetViewBtn');
        this.elements.networkCanvas = this.container.querySelector('#networkCanvas');
        this.elements.peerList = this.container.querySelector('#peerList');
        this.elements.protocolList = this.container.querySelector('#protocolList');
        
        // Button events
        this.elements.refreshNetworkBtn.addEventListener('click', this.refreshNetwork.bind(this));
        this.elements.optimizeNetworkBtn.addEventListener('click', this.optimizeNetwork.bind(this));
        this.elements.discoveryBtn.addEventListener('click', this.discoverPeers.bind(this));
        this.elements.topologyBtn.addEventListener('click', this.showTopology.bind(this));
        this.elements.zoomInBtn.addEventListener('click', this.zoomIn.bind(this));
        this.elements.zoomOutBtn.addEventListener('click', this.zoomOut.bind(this));
        this.elements.resetViewBtn.addEventListener('click', this.resetView.bind(this));
        
        // Canvas events
        this.elements.networkCanvas.addEventListener('mousedown', this.handleCanvasMouseDown.bind(this));
        this.elements.networkCanvas.addEventListener('mousemove', this.handleCanvasMouseMove.bind(this));
        this.elements.networkCanvas.addEventListener('mouseup', this.handleCanvasMouseUp.bind(this));
        this.elements.networkCanvas.addEventListener('wheel', this.handleCanvasWheel.bind(this));
        this.elements.networkCanvas.addEventListener('click', this.handleCanvasClick.bind(this));
    }
    
    setupVisualization() {
        if (!this.elements.networkCanvas) return;
        
        this.visualization.canvas = this.elements.networkCanvas;
        this.visualization.context = this.visualization.canvas.getContext('2d');
        
        // Set canvas size
        const rect = this.visualization.canvas.getBoundingClientRect();
        this.visualization.canvas.width = rect.width;
        this.visualization.canvas.height = rect.height;
        
        // Initialize simulation
        this.generateMockPeers();
        this.updateVisualization();
    }
    
    generateMockPeers() {
        // Generate mock peers for demonstration
        const peerCount = 5 + Math.floor(Math.random() * 10);
        
        for (let i = 0; i < peerCount; i++) {
            const peerId = `peer_${i}`;
            const angle = (i / peerCount) * 2 * Math.PI;
            const radius = 100 + Math.random() * 100;
            
            const peer = {
                id: peerId,
                x: 250 + Math.cos(angle) * radius,
                y: 250 + Math.sin(angle) * radius,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                type: 'peer',
                label: `Peer ${i + 1}`,
                quality: 0.3 + Math.random() * 0.7,
                connections: Math.floor(Math.random() * 5) + 1,
                latency: 50 + Math.random() * 200,
                bandwidth: Math.random() * 100
            };
            
            this.visualization.nodes.push(peer);
            
            // Add connection to self
            this.visualization.edges.push({
                from: 'self',
                to: peerId,
                quality: peer.quality,
                active: Math.random() > 0.3
            });
        }
        
        // Add some peer-to-peer connections
        for (let i = 0; i < this.visualization.nodes.length; i++) {
            for (let j = i + 1; j < this.visualization.nodes.length; j++) {
                if (Math.random() < 0.3) {
                    this.visualization.edges.push({
                        from: this.visualization.nodes[i].id,
                        to: this.visualization.nodes[j].id,
                        quality: 0.2 + Math.random() * 0.6,
                        active: Math.random() > 0.5
                    });
                }
            }
        }
    }
    
    startVisualization() {
        const animate = () => {
            this.updateVisualization();
            this.renderVisualization();
            
            if (this.visualization.animationId) {
                this.visualization.animationId = requestAnimationFrame(animate);
            }
        };
        
        this.visualization.animationId = requestAnimationFrame(animate);
    }
    
    updateVisualization() {
        // Simple physics simulation
        this.visualization.nodes.forEach(node => {
            if (node.id === 'self') return;
            
            // Apply forces
            let fx = 0, fy = 0;
            
            // Attraction to center
            const centerX = 250, centerY = 250;
            const dx = centerX - node.x;
            const dy = centerY - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                const force = 0.001;
                fx += (dx / distance) * force;
                fy += (dy / distance) * force;
            }
            
            // Repulsion from other nodes
            this.visualization.nodes.forEach(other => {
                if (other.id === node.id) return;
                
                const dx = other.x - node.x;
                const dy = other.y - node.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0 && distance < 50) {
                    const force = 0.1 / (distance * distance);
                    fx -= (dx / distance) * force;
                    fy -= (dy / distance) * force;
                }
            });
            
            // Apply forces
            node.vx += fx;
            node.vy += fy;
            
            // Damping
            node.vx *= 0.99;
            node.vy *= 0.99;
            
            // Update position
            node.x += node.vx;
            node.y += node.vy;
            
            // Boundary constraints
            const margin = 20;
            node.x = Math.max(margin, Math.min(500 - margin, node.x));
            node.y = Math.max(margin, Math.min(400 - margin, node.y));
        });
    }
    
    renderVisualization() {
        if (!this.visualization.context) return;
        
        const ctx = this.visualization.context;
        const canvas = this.visualization.canvas;
        
        // Clear canvas
        ctx.fillStyle = this.config.colors.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Apply transformations
        ctx.save();
        ctx.translate(this.visualization.offsetX, this.visualization.offsetY);
        ctx.scale(this.visualization.scale, this.visualization.scale);
        
        // Draw edges
        this.visualization.edges.forEach(edge => {
            const fromNode = this.visualization.nodes.find(n => n.id === edge.from);
            const toNode = this.visualization.nodes.find(n => n.id === edge.to);
            
            if (!fromNode || !toNode) return;
            
            ctx.beginPath();
            ctx.moveTo(fromNode.x, fromNode.y);
            ctx.lineTo(toNode.x, toNode.y);
            
            // Color based on quality
            if (edge.quality > 0.7) {
                ctx.strokeStyle = this.config.colors.strongConnection;
            } else if (edge.quality > 0.4) {
                ctx.strokeStyle = this.config.colors.connection;
            } else {
                ctx.strokeStyle = this.config.colors.weakConnection;
            }
            
            ctx.lineWidth = edge.active ? this.config.edgeWidth : this.config.edgeWidth * 0.5;
            ctx.globalAlpha = edge.active ? 0.8 : 0.4;
            ctx.stroke();
        });
        
        // Draw nodes
        this.visualization.nodes.forEach(node => {
            const size = node.id === 'self' ? this.config.nodeSize * 1.5 : this.config.nodeSize;
            
            // Node circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, size / 2, 0, Math.PI * 2);
            
            if (node.id === 'self') {
                ctx.fillStyle = this.config.colors.self;
            } else {
                ctx.fillStyle = this.config.colors.peer;
            }
            
            ctx.globalAlpha = 0.9;
            ctx.fill();
            
            // Node border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 1;
            ctx.stroke();
            
            // Quality indicator
            if (node.quality !== undefined) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, size / 2 - 3, 0, Math.PI * 2 * node.quality);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            
            // Label
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(node.label, node.x, node.y + size / 2 + 15);
        });
        
        ctx.restore();
    }
    
    renderPeerList() {
        if (this.visualization.nodes.length <= 1) {
            return `
                <div class="no-peers">
                    <div class="icon">🔍</div>
                    <div class="message">No peers connected</div>
                    <button class="btn btn-primary" onclick="eventBus.emit('ui:discover-peers')">
                        Discover Peers
                    </button>
                </div>
            `;
        }
        
        const peers = this.visualization.nodes.filter(node => node.id !== 'self');
        
        return peers.map(peer => `
            <div class="peer-item">
                <div class="peer-info">
                    <div class="peer-name">${peer.label}</div>
                    <div class="peer-id">${peer.id}</div>
                </div>
                <div class="peer-metrics">
                    <div class="metric">
                        <span class="metric-label">Quality:</span>
                        <span class="metric-value">${Math.round(peer.quality * 100)}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Latency:</span>
                        <span class="metric-value">${Math.round(peer.latency)}ms</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Bandwidth:</span>
                        <span class="metric-value">${this.formatBandwidth(peer.bandwidth)}</span>
                    </div>
                </div>
                <div class="peer-actions">
                    <button class="btn btn-small" onclick="eventBus.emit('ui:peer-details', '${peer.id}')">
                        Details
                    </button>
                    <button class="btn btn-small btn-danger" onclick="eventBus.emit('ui:disconnect-peer', '${peer.id}')">
                        Disconnect
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    renderProtocolList() {
        const protocols = [
            { name: 'WebRTC', version: '1.0', status: 'active', peers: 8 },
            { name: 'WebSocket', version: '2.0', status: 'active', peers: 3 },
            { name: 'IPFS', version: '0.8', status: 'initializing', peers: 0 },
            { name: 'LibP2P', version: '1.2', status: 'active', peers: 12 }
        ];
        
        return protocols.map(protocol => `
            <div class="protocol-item">
                <div class="protocol-info">
                    <div class="protocol-name">${protocol.name}</div>
                    <div class="protocol-version">v${protocol.version}</div>
                </div>
                <div class="protocol-status">
                    <span class="status-indicator ${protocol.status}"></span>
                    <span class="status-text">${protocol.status}</span>
                </div>
                <div class="protocol-peers">
                    ${protocol.peers} peers
                </div>
            </div>
        `).join('');
    }
    
    // Canvas event handlers
    handleCanvasMouseDown(event) {
        const rect = this.visualization.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        this.visualization.isDragging = true;
        this.visualization.lastMouseX = x;
        this.visualization.lastMouseY = y;
    }
    
    handleCanvasMouseMove(event) {
        if (!this.visualization.isDragging) return;
        
        const rect = this.visualization.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const dx = x - this.visualization.lastMouseX;
        const dy = y - this.visualization.lastMouseY;
        
        this.visualization.offsetX += dx;
        this.visualization.offsetY += dy;
        
        this.visualization.lastMouseX = x;
        this.visualization.lastMouseY = y;
    }
    
    handleCanvasMouseUp() {
        this.visualization.isDragging = false;
    }
    
    handleCanvasWheel(event) {
        event.preventDefault();
        
        const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
        this.visualization.scale *= scaleFactor;
        this.visualization.scale = Math.max(0.1, Math.min(3, this.visualization.scale));
    }
    
    handleCanvasClick(event) {
        const rect = this.visualization.canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left - this.visualization.offsetX) / this.visualization.scale;
        const y = (event.clientY - rect.top - this.visualization.offsetY) / this.visualization.scale;
        
        // Check if clicked on a node
        const clickedNode = this.visualization.nodes.find(node => {
            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < this.config.nodeSize;
        });
        
        if (clickedNode) {
            this.visualization.selectedNode = clickedNode;
            this.showNodeDetails(clickedNode);
        }
    }
    
    // Control methods
    zoomIn() {
        this.visualization.scale *= 1.2;
        this.visualization.scale = Math.min(3, this.visualization.scale);
    }
    
    zoomOut() {
        this.visualization.scale *= 0.8;
        this.visualization.scale = Math.max(0.1, this.visualization.scale);
    }
    
    resetView() {
        this.visualization.scale = 1;
        this.visualization.offsetX = 0;
        this.visualization.offsetY = 0;
    }
    
    refreshNetwork() {
        console.log('🔄 Refreshing network...');
        
        // Clear existing data
        this.visualization.nodes = [];
        this.visualization.edges = [];
        
        // Reinitialize
        this.initializeVisualization();
        this.generateMockPeers();
        
        // Update UI
        this.updatePeerList();
        this.updateProtocolList();
        this.updateMetrics();
        
        eventBus.emit('network:refreshed');
    }
    
    optimizeNetwork() {
        console.log('⚡ Optimizing network...');
        
        // Simulate network optimization
        this.visualization.nodes.forEach(node => {
            if (node.id !== 'self') {
                node.quality = Math.min(1, node.quality + 0.1);
                node.latency = Math.max(10, node.latency - 10);
            }
        });
        
        this.updateMetrics();
        eventBus.emit('network:optimized');
    }
    
    discoverPeers() {
        console.log('🔍 Discovering peers...');
        
        // Simulate peer discovery
        const newPeerCount = 2 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < newPeerCount; i++) {
            const peerId = `peer_${Date.now()}_${i}`;
            const angle = Math.random() * 2 * Math.PI;
            const radius = 80 + Math.random() * 120;
            
            const peer = {
                id: peerId,
                x: 250 + Math.cos(angle) * radius,
                y: 250 + Math.sin(angle) * radius,
                vx: 0,
                vy: 0,
                type: 'peer',
                label: `New Peer ${i + 1}`,
                quality: 0.5 + Math.random() * 0.5,
                connections: 1,
                latency: 30 + Math.random() * 100,
                bandwidth: 20 + Math.random() * 80
            };
            
            this.visualization.nodes.push(peer);
            
            // Add connection to self
            this.visualization.edges.push({
                from: 'self',
                to: peerId,
                quality: peer.quality,
                active: true
            });
        }
        
        this.updatePeerList();
        this.updateMetrics();
        eventBus.emit('network:peers-discovered', { count: newPeerCount });
    }
    
    showTopology() {
        console.log('🗺️ Showing topology...');
        // This could open a detailed topology view
        eventBus.emit('network:show-topology');
    }
    
    showNodeDetails(node) {
        console.log('Node details:', node);
        // This could show a detailed node information modal
        eventBus.emit('network:show-node-details', node);
    }
    
    // Event handlers
    handlePeerConnected(data) {
        console.log('Peer connected:', data);
        this.updatePeerList();
        this.updateMetrics();
    }
    
    handlePeerDisconnected(data) {
        console.log('Peer disconnected:', data);
        this.updatePeerList();
        this.updateMetrics();
    }
    
    handleConnectionUpdated(data) {
        console.log('Connection updated:', data);
        this.updateMetrics();
    }
    
    handleProtocolUpdated(data) {
        console.log('Protocol updated:', data);
        this.updateProtocolList();
    }
    
    handleTopologyChanged(data) {
        console.log('Topology changed:', data);
        this.refreshNetwork();
    }
    
    handleOnlineStatusChange() {
        this.networkState.isOnline = navigator.onLine;
        this.updateNetworkStatus();
    }
    
    handleViewActivate(data) {
        if (data.view === 'network') {
            this.loadState();
            this.updateUI();
        }
    }
    
    // UI update methods
    updatePeerList() {
        if (this.elements.peerList) {
            this.elements.peerList.innerHTML = this.renderPeerList();
        }
    }
    
    updateProtocolList() {
        if (this.elements.protocolList) {
            this.elements.protocolList.innerHTML = this.renderProtocolList();
        }
    }
    
    updateMetrics() {
        // Calculate metrics from visualization data
        const peers = this.visualization.nodes.filter(node => node.id !== 'self');
        const activeConnections = this.visualization.edges.filter(edge => edge.active);
        
        this.metrics.totalPeers = peers.length;
        this.metrics.activePeers = activeConnections.length;
        this.metrics.connectionQuality = peers.reduce((sum, peer) => sum + peer.quality, 0) / peers.length * 100 || 0;
        this.metrics.bandwidth = peers.reduce((sum, peer) => sum + peer.bandwidth, 0) / peers.length || 0;
        this.metrics.latency = peers.reduce((sum, peer) => sum + peer.latency, 0) / peers.length || 0;
        this.metrics.reliability = Math.min(100, this.metrics.connectionQuality * 0.8 + 20);
        
        // Update UI
        const elements = {
            connectedPeers: this.container.querySelector('#connectedPeers'),
            connectionQuality: this.container.querySelector('#connectionQuality'),
            bandwidth: this.container.querySelector('#bandwidth'),
            avgLatency: this.container.querySelector('#avgLatency'),
            reliability: this.container.querySelector('#reliability')
        };
        
        if (elements.connectedPeers) elements.connectedPeers.textContent = this.metrics.activePeers;
        if (elements.connectionQuality) elements.connectionQuality.textContent = `${Math.round(this.metrics.connectionQuality)}%`;
        if (elements.bandwidth) elements.bandwidth.textContent = this.formatBandwidth(this.metrics.bandwidth);
        if (elements.avgLatency) elements.avgLatency.textContent = `${Math.round(this.metrics.latency)}ms`;
        if (elements.reliability) elements.reliability.textContent = `${Math.round(this.metrics.reliability)}%`;
    }
    
    updateNetworkStatus() {
        const statusElements = this.container.querySelectorAll('.status-indicator');
        statusElements.forEach(element => {
            element.className = `status-indicator ${this.networkState.isOnline ? 'online' : 'offline'}`;
        });
        
        const statusTexts = this.container.querySelectorAll('.status-value');
        if (statusTexts[0]) {
            statusTexts[0].textContent = this.networkState.isOnline ? 'Online' : 'Offline';
        }
    }
    
    updateUI() {
        this.updatePeerList();
        this.updateProtocolList();
        this.updateMetrics();
        this.updateNetworkStatus();
    }
    
    // Utility methods
    formatBandwidth(bandwidth) {
        if (bandwidth < 1) return `${(bandwidth * 1000).toFixed(0)} Kbps`;
        if (bandwidth < 1000) return `${bandwidth.toFixed(1)} Mbps`;
        return `${(bandwidth / 1000).toFixed(1)} Gbps`;
    }
    
    formatThroughput(throughput) {
        if (throughput < 1024) return `${throughput.toFixed(0)} B/s`;
        if (throughput < 1024 * 1024) return `${(throughput / 1024).toFixed(1)} KB/s`;
        return `${(throughput / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    
    destroy() {
        if (this.visualization.animationId) {
            cancelAnimationFrame(this.visualization.animationId);
            this.visualization.animationId = null;
        }
        
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // Remove event listeners
        window.removeEventListener('online', this.handleOnlineStatusChange);
        window.removeEventListener('offline', this.handleOnlineStatusChange);
        
        this.initialized = false;
    }
}

export default NetworkView;