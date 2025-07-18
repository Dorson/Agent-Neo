/**
 * Agent Neo Native IPFS-like Module
 * 
 * Implements distributed storage and content addressing using native web technologies
 * instead of external Helia/IPFS dependencies. This complies with the white paper
 * requirement for native JS/HTML/CSS implementation only.
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';
import CryptoManager from '../core/CryptoManager.js';
import { config } from '../core/config.js';

class NativeIPFSModule {
    constructor() {
        this.initialized = false;
        this.storage = new Map(); // Local content store
        this.contentIndex = new Map(); // CID to location mapping
        this.peers = new Set(); // Connected peers for data sharing
        this.chunkSize = 256 * 1024; // 256KB chunks
        this.replicationFactor = 3; // Store data on 3 peers minimum
        
        this.init();
    }

    async init() {
        try {
            console.log('📁 Native IPFS Module initializing...');
            
            // Initialize storage backend
            await this.initializeStorage();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Start content discovery
            this.startContentDiscovery();
            
            this.initialized = true;
            
            eventBus.emit('ipfs:ready', {
                nodeId: await this.getNodeId(),
                storageSize: this.storage.size
            });
            
            console.log('✅ Native IPFS Module initialized');
            
        } catch (error) {
            console.error('❌ Native IPFS Module initialization failed:', error);
            throw error;
        }
    }

    async initializeStorage() {
        // Initialize IndexedDB for persistent storage
        const dbRequest = indexedDB.open('AgentNeoIPFS', 1);
        
        return new Promise((resolve, reject) => {
            dbRequest.onerror = () => reject(dbRequest.error);
            dbRequest.onsuccess = () => {
                this.db = dbRequest.result;
                resolve();
            };
            
            dbRequest.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Content store
                if (!db.objectStoreNames.contains('content')) {
                    const contentStore = db.createObjectStore('content', { keyPath: 'cid' });
                    contentStore.createIndex('timestamp', 'timestamp');
                    contentStore.createIndex('size', 'size');
                }
                
                // Metadata store
                if (!db.objectStoreNames.contains('metadata')) {
                    const metaStore = db.createObjectStore('metadata', { keyPath: 'cid' });
                    metaStore.createIndex('type', 'type');
                    metaStore.createIndex('peers', 'peers', { multiEntry: true });
                }
            };
        });
    }

    setupEventListeners() {
        // P2P events
        eventBus.on('p2p:peer_connected', this.handlePeerConnected.bind(this));
        eventBus.on('p2p:peer_disconnected', this.handlePeerDisconnected.bind(this));
        eventBus.on('p2p:message_received', this.handleP2PMessage.bind(this));
        
        // Storage events
        eventBus.on('ipfs:store_content', this.storeContent.bind(this));
        eventBus.on('ipfs:retrieve_content', this.retrieveContent.bind(this));
        eventBus.on('ipfs:pin_content', this.pinContent.bind(this));
    }

    async getNodeId() {
        // Generate stable node ID from crypto manager
        const identity = await CryptoManager.getIdentity();
        return CryptoManager.hash(identity.publicKey).slice(0, 16);
    }

    /**
     * Store content with content-addressed storage
     */
    async storeContent(data, options = {}) {
        try {
            // Convert data to Uint8Array if needed
            const content = typeof data === 'string' ? 
                new TextEncoder().encode(data) : 
                new Uint8Array(data);
            
            // Generate content ID (CID)
            const cid = await this.generateCID(content);
            
            // Check if already stored
            if (this.storage.has(cid)) {
                return { cid, size: content.length, cached: true };
            }
            
            // Chunk large content
            const chunks = await this.chunkContent(content);
            
            // Store locally
            await this.storeLocal(cid, content, chunks, options);
            
            // Replicate to peers if requested
            if (options.replicate !== false) {
                await this.replicateToPeers(cid, content, chunks);
            }
            
            eventBus.emit('ipfs:content_stored', {
                cid,
                size: content.length,
                chunks: chunks.length,
                replicated: options.replicate !== false
            });
            
            return { cid, size: content.length, chunks: chunks.length };
            
        } catch (error) {
            console.error('Failed to store content:', error);
            throw error;
        }
    }

    /**
     * Retrieve content by CID
     */
    async retrieveContent(cid, options = {}) {
        try {
            // Check local storage first
            let content = await this.getLocal(cid);
            
            if (!content && options.network !== false) {
                // Try to fetch from peers
                content = await this.fetchFromPeers(cid);
            }
            
            if (!content) {
                throw new Error(`Content not found: ${cid}`);
            }
            
            eventBus.emit('ipfs:content_retrieved', {
                cid,
                size: content.length,
                source: this.storage.has(cid) ? 'local' : 'network'
            });
            
            return content;
            
        } catch (error) {
            console.error('Failed to retrieve content:', error);
            throw error;
        }
    }

    async generateCID(content) {
        // Use SHA-256 hash as CID (simplified IPFS-like addressing)
        const hash = await CryptoManager.hash(content);
        return `Qm${hash.slice(0, 44)}`; // IPFS-like format
    }

    async chunkContent(content) {
        const chunks = [];
        
        for (let i = 0; i < content.length; i += this.chunkSize) {
            const chunk = content.slice(i, i + this.chunkSize);
            const chunkCID = await this.generateCID(chunk);
            
            chunks.push({
                cid: chunkCID,
                data: chunk,
                index: chunks.length,
                size: chunk.length
            });
        }
        
        return chunks;
    }

    async storeLocal(cid, content, chunks, options) {
        // Store in memory
        this.storage.set(cid, content);
        this.contentIndex.set(cid, {
            size: content.length,
            chunks: chunks.length,
            timestamp: Date.now(),
            pinned: options.pin || false
        });
        
        // Store in IndexedDB for persistence
        if (this.db) {
            const tx = this.db.transaction(['content', 'metadata'], 'readwrite');
            
            // Store content
            tx.objectStore('content').add({
                cid,
                data: Array.from(content),
                timestamp: Date.now()
            });
            
            // Store metadata
            tx.objectStore('metadata').add({
                cid,
                size: content.length,
                chunks: chunks.length,
                type: options.type || 'unknown',
                pinned: options.pin || false,
                peers: Array.from(this.peers)
            });
        }
    }

    async getLocal(cid) {
        // Check memory first
        if (this.storage.has(cid)) {
            return this.storage.get(cid);
        }
        
        // Check IndexedDB
        if (this.db) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(['content'], 'readonly');
                const request = tx.objectStore('content').get(cid);
                
                request.onsuccess = () => {
                    if (request.result) {
                        const content = new Uint8Array(request.result.data);
                        this.storage.set(cid, content); // Cache in memory
                        resolve(content);
                    } else {
                        resolve(null);
                    }
                };
                
                request.onerror = () => reject(request.error);
            });
        }
        
        return null;
    }

    async replicateToPeers(cid, content, chunks) {
        if (this.peers.size === 0) return;
        
        const peerArray = Array.from(this.peers);
        const targetPeers = peerArray.slice(0, Math.min(this.replicationFactor, peerArray.length));
        
        for (const peerId of targetPeers) {
            eventBus.emit('p2p:send_message', {
                to: peerId,
                type: 'CONTENT_STORE',
                payload: {
                    cid,
                    content: Array.from(content),
                    chunks: chunks.length
                }
            });
        }
    }

    async fetchFromPeers(cid) {
        if (this.peers.size === 0) return null;
        
        // Request content from all peers
        for (const peerId of this.peers) {
            eventBus.emit('p2p:send_message', {
                to: peerId,
                type: 'CONTENT_REQUEST',
                payload: { cid }
            });
        }
        
        // Wait for response (simplified - in production would use Promise.race with timeout)
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(null), 5000);
            
            const handler = (event) => {
                if (event.data?.type === 'CONTENT_RESPONSE' && event.data?.payload?.cid === cid) {
                    clearTimeout(timeout);
                    eventBus.off('p2p:message_received', handler);
                    
                    const content = new Uint8Array(event.data.payload.content);
                    this.storeLocal(cid, content, [], { replicate: false });
                    resolve(content);
                }
            };
            
            eventBus.on('p2p:message_received', handler);
        });
    }

    startContentDiscovery() {
        // Periodically announce available content to peers
        setInterval(() => {
            if (this.peers.size > 0 && this.contentIndex.size > 0) {
                const availableContent = Array.from(this.contentIndex.keys()).slice(0, 100);
                
                eventBus.emit('p2p:broadcast_message', {
                    type: 'CONTENT_ANNOUNCEMENT',
                    payload: {
                        nodeId: this.getNodeId(),
                        content: availableContent,
                        count: this.contentIndex.size
                    }
                });
            }
        }, config.p2p.heartbeatInterval || 30000);
    }

    handlePeerConnected(event) {
        this.peers.add(event.data.peerId);
        console.log(`📡 IPFS: Peer connected: ${event.data.peerId}`);
    }

    handlePeerDisconnected(event) {
        this.peers.delete(event.data.peerId);
        console.log(`📡 IPFS: Peer disconnected: ${event.data.peerId}`);
    }

    handleP2PMessage(event) {
        const { type, payload, from } = event.data;
        
        switch (type) {
            case 'CONTENT_REQUEST':
                this.handleContentRequest(payload.cid, from);
                break;
                
            case 'CONTENT_STORE':
                this.handleContentStore(payload.cid, payload.content, from);
                break;
                
            case 'CONTENT_ANNOUNCEMENT':
                this.handleContentAnnouncement(payload, from);
                break;
        }
    }

    async handleContentRequest(cid, from) {
        const content = await this.getLocal(cid);
        
        if (content) {
            eventBus.emit('p2p:send_message', {
                to: from,
                type: 'CONTENT_RESPONSE',
                payload: {
                    cid,
                    content: Array.from(content)
                }
            });
        }
    }

    async handleContentStore(cid, contentArray, from) {
        const content = new Uint8Array(contentArray);
        await this.storeLocal(cid, content, [], { replicate: false });
        
        console.log(`📥 Stored content from peer ${from}: ${cid}`);
    }

    handleContentAnnouncement(payload, from) {
        // Update peer content index for future requests
        console.log(`📢 Peer ${from} announced ${payload.count} content items`);
    }

    /**
     * Pin content to prevent garbage collection
     */
    async pinContent(cid) {
        if (this.contentIndex.has(cid)) {
            const info = this.contentIndex.get(cid);
            info.pinned = true;
            this.contentIndex.set(cid, info);
            
            // Update in database
            if (this.db) {
                const tx = this.db.transaction(['metadata'], 'readwrite');
                const store = tx.objectStore('metadata');
                const request = store.get(cid);
                
                request.onsuccess = () => {
                    if (request.result) {
                        request.result.pinned = true;
                        store.put(request.result);
                    }
                };
            }
            
            return true;
        }
        return false;
    }

    /**
     * Get storage statistics
     */
    getStats() {
        return {
            totalContent: this.contentIndex.size,
            memoryUsage: this.storage.size,
            connectedPeers: this.peers.size,
            pinned: Array.from(this.contentIndex.values()).filter(info => info.pinned).length
        };
    }

    /**
     * Clean up resources
     */
    async shutdown() {
        console.log('🛑 Shutting down Native IPFS Module...');
        
        this.storage.clear();
        this.contentIndex.clear();
        this.peers.clear();
        
        if (this.db) {
            this.db.close();
        }
        
        console.log('✅ Native IPFS Module shut down');
    }
}

export default NativeIPFSModule;