/**
 * Data Resource Manager
 * 
 * Provides hybrid local and cloud data resource management capabilities:
 * - Local storage optimization (IndexedDB, localStorage, caching)
 * - IPFS/Helia integration for distributed storage
 * - Intelligent data synchronization and replication
 * - Tiered storage with automatic promotion/demotion
 * - Compression and deduplication
 * - Offline-first architecture with sync on reconnect
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class DataResourceManager {
    constructor() {
        this.name = 'DataResourceManager';
        this.version = '1.0.0';
        this.isRunning = false;
        
        // Storage backends
        this.storageBackends = {
            local: null,           // IndexedDB
            memory: new Map(),     // In-memory cache
            ipfs: null,           // IPFS/Helia
            webrtc: null,         // WebRTC data channels
            websocket: null       // WebSocket backup
        };
        
        // Data management state
        this.dataIndex = new Map();        // Global data index
        this.replicationMap = new Map();   // Replication tracking
        this.syncQueue = [];              // Pending sync operations
        this.cacheHits = new Map();       // Cache hit statistics
        this.accessPatterns = new Map();  // Access pattern analysis
        
        // Configuration
        this.config = {
            localStorageQuota: 500 * 1024 * 1024,      // 500MB
            memoryCache: 50 * 1024 * 1024,             // 50MB
            compressionEnabled: true,
            deduplicationEnabled: true,
            replicationFactor: 3,
            syncInterval: 30000,                         // 30 seconds
            offlineMode: false,
            autoTiering: true,
            cacheStrategy: 'lru',                        // lru, lfu, fifo
            ipfsEnabled: true,
            encryptionEnabled: true,
            batchSize: 100,
            maxRetries: 3
        };
        
        // Tiered storage levels
        this.storageTiers = {
            hot: {
                name: 'hot',
                backend: 'memory',
                maxSize: 50 * 1024 * 1024,
                ttl: 3600000,  // 1 hour
                accessThreshold: 10
            },
            warm: {
                name: 'warm',
                backend: 'local',
                maxSize: 200 * 1024 * 1024,
                ttl: 86400000,  // 24 hours
                accessThreshold: 3
            },
            cold: {
                name: 'cold',
                backend: 'ipfs',
                maxSize: Infinity,
                ttl: Infinity,
                accessThreshold: 0
            }
        };
        
        // Metrics
        this.metrics = {
            reads: { local: 0, remote: 0, cache: 0 },
            writes: { local: 0, remote: 0 },
            sync: { success: 0, failures: 0, conflicts: 0 },
            storage: { used: 0, available: 0, compressed: 0 },
            network: { uploaded: 0, downloaded: 0 },
            performance: { avgReadTime: 0, avgWriteTime: 0 }
        };
        
        this.init();
    }
    
    async init() {
        console.log(`💾 Initializing ${this.name} v${this.version}`);
        
        // Load configuration
        await this.loadConfiguration();
        
        // Initialize storage backends
        await this.initializeStorageBackends();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start background services
        this.startBackgroundServices();
        
        this.isRunning = true;
        
        eventBus.emit('data-resource-manager:initialized', {
            version: this.version,
            config: this.config,
            backends: Object.keys(this.storageBackends).filter(k => this.storageBackends[k] !== null)
        });
    }
    
    async loadConfiguration() {
        try {
            const savedConfig = await stateManager.getState('dataResourceManager.config');
            if (savedConfig) {
                this.config = { ...this.config, ...savedConfig };
            }
        } catch (error) {
            console.warn('Failed to load data resource manager configuration:', error);
        }
    }
    
    async initializeStorageBackends() {
        // Initialize IndexedDB
        await this.initializeIndexedDB();
        
        // Initialize IPFS/Helia if enabled
        if (this.config.ipfsEnabled) {
            await this.initializeIPFS();
        }
        
        // Initialize WebRTC data channels
        await this.initializeWebRTC();
        
        // Initialize WebSocket backup
        await this.initializeWebSocket();
    }
    
    async initializeIndexedDB() {
        try {
            const dbRequest = indexedDB.open('AgentNeoDataStore', 1);
            
            dbRequest.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('data')) {
                    const dataStore = db.createObjectStore('data', { keyPath: 'id' });
                    dataStore.createIndex('timestamp', 'timestamp');
                    dataStore.createIndex('type', 'type');
                    dataStore.createIndex('tier', 'tier');
                }
                
                if (!db.objectStoreNames.contains('metadata')) {
                    const metaStore = db.createObjectStore('metadata', { keyPath: 'id' });
                    metaStore.createIndex('hash', 'hash');
                    metaStore.createIndex('size', 'size');
                }
            };
            
            this.storageBackends.local = await new Promise((resolve, reject) => {
                dbRequest.onsuccess = () => resolve(dbRequest.result);
                dbRequest.onerror = () => reject(dbRequest.error);
            });
            
            console.log('✅ IndexedDB initialized');
            eventBus.emit('data-resource-manager:indexeddb-ready');
            
        } catch (error) {
            console.error('Failed to initialize IndexedDB:', error);
            this.storageBackends.local = null;
        }
    }
    
    async initializeIPFS() {
        try {
            // Initialize IPFS/Helia integration
            const ipfsModule = await stateManager.getState('ipfs.module');
            if (ipfsModule) {
                this.storageBackends.ipfs = ipfsModule;
                console.log('✅ IPFS backend connected');
                eventBus.emit('data-resource-manager:ipfs-ready');
            } else {
                console.log('⚠️ IPFS module not available');
            }
        } catch (error) {
            console.error('Failed to initialize IPFS:', error);
            this.storageBackends.ipfs = null;
        }
    }
    
    async initializeWebRTC() {
        // WebRTC data channels for peer-to-peer data sync
        this.storageBackends.webrtc = {
            channels: new Map(),
            peers: new Set(),
            send: async (peerId, data) => {
                // Implementation for WebRTC data channel communication
                const channel = this.storageBackends.webrtc.channels.get(peerId);
                if (channel && channel.readyState === 'open') {
                    channel.send(JSON.stringify(data));
                    return true;
                }
                return false;
            }
        };
        
        console.log('✅ WebRTC data channels initialized');
    }
    
    async initializeWebSocket() {
        // WebSocket backup for data sync
        this.storageBackends.websocket = {
            connections: new Map(),
            send: async (endpoint, data) => {
                // Implementation for WebSocket communication
                const ws = this.storageBackends.websocket.connections.get(endpoint);
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(data));
                    return true;
                }
                return false;
            }
        };
        
        console.log('✅ WebSocket backup initialized');
    }
    
    setupEventListeners() {
        // Data operations
        eventBus.on('data-resource-manager:store', (data) => this.store(data));
        eventBus.on('data-resource-manager:retrieve', (data) => this.retrieve(data));
        eventBus.on('data-resource-manager:delete', (data) => this.delete(data));
        eventBus.on('data-resource-manager:sync', (data) => this.sync(data));
        
        // Storage management
        eventBus.on('data-resource-manager:optimize', () => this.optimize());
        eventBus.on('data-resource-manager:cleanup', () => this.cleanup());
        eventBus.on('data-resource-manager:rebalance', () => this.rebalanceTiers());
        
        // Configuration
        eventBus.on('data-resource-manager:configure', (config) => this.configure(config));
        eventBus.on('data-resource-manager:get-status', () => this.getStatus());
        
        // Network events
        eventBus.on('network:peer-connected', (data) => this.handlePeerConnected(data));
        eventBus.on('network:peer-disconnected', (data) => this.handlePeerDisconnected(data));
        eventBus.on('network:online', () => this.handleOnline());
        eventBus.on('network:offline', () => this.handleOffline());
    }
    
    async store(request) {
        const { 
            id, 
            data, 
            type = 'generic', 
            tier = 'auto', 
            replicate = true, 
            compress = this.config.compressionEnabled,
            encrypt = this.config.encryptionEnabled 
        } = request;
        
        try {
            const storeStart = performance.now();
            
            // Process data
            let processedData = data;
            let metadata = {
                id,
                type,
                originalSize: this.calculateSize(data),
                timestamp: Date.now(),
                accessCount: 0,
                lastAccessed: Date.now()
            };
            
            // Compression
            if (compress) {
                processedData = await this.compress(processedData);
                metadata.compressed = true;
                metadata.compressedSize = this.calculateSize(processedData);
            }
            
            // Encryption
            if (encrypt) {
                processedData = await this.encrypt(processedData);
                metadata.encrypted = true;
            }
            
            // Deduplication
            if (this.config.deduplicationEnabled) {
                const hash = await this.calculateHash(processedData);
                metadata.hash = hash;
                
                // Check if data already exists
                const existingEntry = await this.findByHash(hash);
                if (existingEntry) {
                    // Update reference count
                    await this.updateReferenceCount(existingEntry.id, 1);
                    return existingEntry.id;
                }
            }
            
            // Determine storage tier
            const targetTier = tier === 'auto' ? this.selectOptimalTier(metadata) : tier;
            metadata.tier = targetTier;
            
            // Store in appropriate backend
            const storageResult = await this.storeInBackend(targetTier, id, processedData, metadata);
            
            // Update index
            this.dataIndex.set(id, {
                ...metadata,
                tier: targetTier,
                backend: this.storageTiers[targetTier].backend,
                replicated: replicate,
                locations: [targetTier]
            });
            
            // Replicate if requested
            if (replicate && this.config.replicationFactor > 1) {
                await this.scheduleReplication(id, targetTier);
            }
            
            const storeTime = performance.now() - storeStart;
            this.updateMetrics('write', storeTime, metadata.originalSize);
            
            console.log(`✅ Data stored: ${id} (${targetTier} tier) in ${storeTime.toFixed(2)}ms`);
            
            eventBus.emit('data-resource-manager:stored', {
                id,
                tier: targetTier,
                size: metadata.originalSize,
                compressed: metadata.compressed,
                encrypted: metadata.encrypted,
                storeTime
            });
            
            return id;
            
        } catch (error) {
            console.error(`❌ Failed to store data ${id}:`, error);
            eventBus.emit('data-resource-manager:store-failed', { id, error: error.message });
            throw error;
        }
    }
    
    async retrieve(request) {
        const { id, preferredTier = null } = request;
        
        try {
            const retrieveStart = performance.now();
            
            // Check index
            const indexEntry = this.dataIndex.get(id);
            if (!indexEntry) {
                throw new Error(`Data not found: ${id}`);
            }
            
            // Update access pattern
            this.updateAccessPattern(id);
            
            // Try to retrieve from preferred tier first
            let data = null;
            let actualTier = null;
            
            if (preferredTier && indexEntry.locations.includes(preferredTier)) {
                data = await this.retrieveFromBackend(preferredTier, id);
                actualTier = preferredTier;
            } else {
                // Try tiers in order of preference (hot -> warm -> cold)
                for (const tier of ['hot', 'warm', 'cold']) {
                    if (indexEntry.locations.includes(tier)) {
                        data = await this.retrieveFromBackend(tier, id);
                        if (data) {
                            actualTier = tier;
                            break;
                        }
                    }
                }
            }
            
            if (!data) {
                throw new Error(`Data not available: ${id}`);
            }
            
            // Decrypt if needed
            if (indexEntry.encrypted) {
                data = await this.decrypt(data);
            }
            
            // Decompress if needed
            if (indexEntry.compressed) {
                data = await this.decompress(data);
            }
            
            // Update statistics
            const retrieveTime = performance.now() - retrieveStart;
            this.updateMetrics('read', retrieveTime, indexEntry.originalSize);
            
            // Update index with access info
            indexEntry.accessCount++;
            indexEntry.lastAccessed = Date.now();
            this.dataIndex.set(id, indexEntry);
            
            // Promote to higher tier if access pattern suggests it
            if (this.config.autoTiering && actualTier !== 'hot') {
                await this.considerTierPromotion(id, indexEntry);
            }
            
            console.log(`✅ Data retrieved: ${id} from ${actualTier} tier in ${retrieveTime.toFixed(2)}ms`);
            
            eventBus.emit('data-resource-manager:retrieved', {
                id,
                tier: actualTier,
                size: indexEntry.originalSize,
                retrieveTime,
                cacheHit: actualTier === 'hot'
            });
            
            return data;
            
        } catch (error) {
            console.error(`❌ Failed to retrieve data ${id}:`, error);
            eventBus.emit('data-resource-manager:retrieve-failed', { id, error: error.message });
            throw error;
        }
    }
    
    async delete(request) {
        const { id, purgeReplicas = true } = request;
        
        try {
            const indexEntry = this.dataIndex.get(id);
            if (!indexEntry) {
                console.log(`⚠️ Data not found for deletion: ${id}`);
                return;
            }
            
            // Delete from all locations
            for (const tier of indexEntry.locations) {
                await this.deleteFromBackend(tier, id);
            }
            
            // Delete replicas if requested
            if (purgeReplicas) {
                await this.deleteReplicas(id);
            }
            
            // Update deduplication references
            if (indexEntry.hash) {
                await this.updateReferenceCount(id, -1);
            }
            
            // Remove from index
            this.dataIndex.delete(id);
            this.accessPatterns.delete(id);
            
            console.log(`✅ Data deleted: ${id}`);
            
            eventBus.emit('data-resource-manager:deleted', { id });
            
        } catch (error) {
            console.error(`❌ Failed to delete data ${id}:`, error);
            eventBus.emit('data-resource-manager:delete-failed', { id, error: error.message });
            throw error;
        }
    }
    
    async sync(request = {}) {
        const { full = false, peers = [], direction = 'bidirectional' } = request;
        
        try {
            console.log(`🔄 Starting data sync (full: ${full}, peers: ${peers.length})`);
            
            const syncStart = performance.now();
            let syncedItems = 0;
            let conflicts = 0;
            
            // Get local data inventory
            const localInventory = await this.getLocalInventory();
            
            // Sync with each peer
            for (const peer of peers) {
                try {
                    const peerInventory = await this.getPeerInventory(peer);
                    
                    // Determine sync operations
                    const syncOps = this.calculateSyncOperations(localInventory, peerInventory, direction);
                    
                    // Execute sync operations
                    for (const op of syncOps) {
                        try {
                            await this.executeSyncOperation(op, peer);
                            syncedItems++;
                        } catch (error) {
                            console.warn(`Sync operation failed: ${op.type} ${op.id}`, error);
                            if (error.type === 'conflict') {
                                conflicts++;
                            }
                        }
                    }
                    
                } catch (error) {
                    console.warn(`Failed to sync with peer ${peer}:`, error);
                }
            }
            
            const syncTime = performance.now() - syncStart;
            
            // Update metrics
            this.metrics.sync.success += syncedItems;
            this.metrics.sync.conflicts += conflicts;
            
            console.log(`✅ Sync completed: ${syncedItems} items, ${conflicts} conflicts in ${syncTime.toFixed(2)}ms`);
            
            eventBus.emit('data-resource-manager:sync-complete', {
                syncedItems,
                conflicts,
                syncTime,
                peers: peers.length
            });
            
            return { syncedItems, conflicts, syncTime };
            
        } catch (error) {
            console.error('Sync operation failed:', error);
            this.metrics.sync.failures++;
            
            eventBus.emit('data-resource-manager:sync-failed', { error: error.message });
            throw error;
        }
    }
    
    // Backend-specific operations
    async storeInBackend(tier, id, data, metadata) {
        const backend = this.storageTiers[tier].backend;
        
        switch (backend) {
            case 'memory':
                return this.storeInMemory(id, data, metadata);
            case 'local':
                return this.storeInIndexedDB(id, data, metadata);
            case 'ipfs':
                return this.storeInIPFS(id, data, metadata);
            default:
                throw new Error(`Unknown backend: ${backend}`);
        }
    }
    
    async retrieveFromBackend(tier, id) {
        const backend = this.storageTiers[tier].backend;
        
        switch (backend) {
            case 'memory':
                return this.retrieveFromMemory(id);
            case 'local':
                return this.retrieveFromIndexedDB(id);
            case 'ipfs':
                return this.retrieveFromIPFS(id);
            default:
                throw new Error(`Unknown backend: ${backend}`);
        }
    }
    
    async deleteFromBackend(tier, id) {
        const backend = this.storageTiers[tier].backend;
        
        switch (backend) {
            case 'memory':
                return this.deleteFromMemory(id);
            case 'local':
                return this.deleteFromIndexedDB(id);
            case 'ipfs':
                return this.deleteFromIPFS(id);
            default:
                throw new Error(`Unknown backend: ${backend}`);
        }
    }
    
    // Memory storage operations
    async storeInMemory(id, data, metadata) {
        this.storageBackends.memory.set(id, { data, metadata });
        return true;
    }
    
    async retrieveFromMemory(id) {
        const entry = this.storageBackends.memory.get(id);
        return entry ? entry.data : null;
    }
    
    async deleteFromMemory(id) {
        return this.storageBackends.memory.delete(id);
    }
    
    // IndexedDB storage operations
    async storeInIndexedDB(id, data, metadata) {
        if (!this.storageBackends.local) {
            throw new Error('IndexedDB not available');
        }
        
        const transaction = this.storageBackends.local.transaction(['data'], 'readwrite');
        const store = transaction.objectStore('data');
        
        await new Promise((resolve, reject) => {
            const request = store.put({ id, data, metadata });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        return true;
    }
    
    async retrieveFromIndexedDB(id) {
        if (!this.storageBackends.local) {
            throw new Error('IndexedDB not available');
        }
        
        const transaction = this.storageBackends.local.transaction(['data'], 'readonly');
        const store = transaction.objectStore('data');
        
        const result = await new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        return result ? result.data : null;
    }
    
    async deleteFromIndexedDB(id) {
        if (!this.storageBackends.local) {
            throw new Error('IndexedDB not available');
        }
        
        const transaction = this.storageBackends.local.transaction(['data'], 'readwrite');
        const store = transaction.objectStore('data');
        
        await new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        return true;
    }
    
    // IPFS storage operations
    async storeInIPFS(id, data, metadata) {
        if (!this.storageBackends.ipfs) {
            throw new Error('IPFS not available');
        }
        
        // Use IPFS module's storage methods
        const cid = await this.storageBackends.ipfs.add(data);
        
        // Store mapping in local index
        await this.storeInIndexedDB(`ipfs:${id}`, { cid, metadata });
        
        return cid;
    }
    
    async retrieveFromIPFS(id) {
        if (!this.storageBackends.ipfs) {
            throw new Error('IPFS not available');
        }
        
        // Get CID from local index
        const mapping = await this.retrieveFromIndexedDB(`ipfs:${id}`);
        if (!mapping) {
            throw new Error(`IPFS mapping not found for ${id}`);
        }
        
        // Retrieve from IPFS
        const data = await this.storageBackends.ipfs.get(mapping.cid);
        return data;
    }
    
    async deleteFromIPFS(id) {
        if (!this.storageBackends.ipfs) {
            throw new Error('IPFS not available');
        }
        
        // Remove local mapping
        await this.deleteFromIndexedDB(`ipfs:${id}`);
        
        // Note: IPFS doesn't have explicit delete - data is garbage collected
        return true;
    }
    
    // Utility methods
    selectOptimalTier(metadata) {
        // Select tier based on data characteristics
        const size = metadata.originalSize;
        const type = metadata.type;
        
        // Hot tier for small, frequently accessed data
        if (size < 1024 * 1024) {  // < 1MB
            return 'hot';
        }
        
        // Warm tier for medium-sized data
        if (size < 10 * 1024 * 1024) {  // < 10MB
            return 'warm';
        }
        
        // Cold tier for large data
        return 'cold';
    }
    
    updateAccessPattern(id) {
        if (!this.accessPatterns.has(id)) {
            this.accessPatterns.set(id, {
                count: 0,
                lastAccess: 0,
                frequency: 0
            });
        }
        
        const pattern = this.accessPatterns.get(id);
        pattern.count++;
        pattern.lastAccess = Date.now();
        pattern.frequency = pattern.count / ((Date.now() - pattern.firstAccess) / 1000 / 60); // per minute
        
        this.accessPatterns.set(id, pattern);
    }
    
    async considerTierPromotion(id, indexEntry) {
        const pattern = this.accessPatterns.get(id);
        if (!pattern) return;
        
        // Promote to hot tier if frequently accessed
        if (pattern.frequency > 1 && indexEntry.tier !== 'hot') {
            await this.promoteTier(id, 'hot');
        }
        // Promote to warm tier if moderately accessed
        else if (pattern.frequency > 0.1 && indexEntry.tier === 'cold') {
            await this.promoteTier(id, 'warm');
        }
    }
    
    async promoteTier(id, targetTier) {
        const indexEntry = this.dataIndex.get(id);
        if (!indexEntry) return;
        
        try {
            // Retrieve from current tier
            const data = await this.retrieveFromBackend(indexEntry.tier, id);
            if (!data) return;
            
            // Store in target tier
            await this.storeInBackend(targetTier, id, data, indexEntry);
            
            // Update index
            indexEntry.locations.push(targetTier);
            indexEntry.tier = targetTier;
            this.dataIndex.set(id, indexEntry);
            
            console.log(`📈 Promoted ${id} from ${indexEntry.tier} to ${targetTier}`);
            
            eventBus.emit('data-resource-manager:tier-promoted', {
                id,
                from: indexEntry.tier,
                to: targetTier
            });
            
        } catch (error) {
            console.error(`Failed to promote ${id} to ${targetTier}:`, error);
        }
    }
    
    calculateSize(data) {
        if (typeof data === 'string') {
            return new Blob([data]).size;
        } else if (data instanceof ArrayBuffer) {
            return data.byteLength;
        } else {
            return new Blob([JSON.stringify(data)]).size;
        }
    }
    
    async calculateHash(data) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(typeof data === 'string' ? data : JSON.stringify(data));
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    async compress(data) {
        // Simple compression using built-in compression
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        const chunks = [];
        
        const readPromise = (async () => {
            let done = false;
            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    chunks.push(value);
                }
            }
        })();
        
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(typeof data === 'string' ? data : JSON.stringify(data));
        
        await writer.write(dataBuffer);
        await writer.close();
        await readPromise;
        
        return new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
    }
    
    async decompress(compressedData) {
        // Simple decompression using built-in decompression
        const stream = new DecompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        const chunks = [];
        
        const readPromise = (async () => {
            let done = false;
            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    chunks.push(value);
                }
            }
        })();
        
        await writer.write(compressedData);
        await writer.close();
        await readPromise;
        
        const decoder = new TextDecoder();
        return decoder.decode(new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], [])));
    }
    
    async encrypt(data) {
        // Simple encryption using Web Crypto API
        const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
        
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(typeof data === 'string' ? data : JSON.stringify(data));
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            dataBuffer
        );
        
        return {
            data: encrypted,
            iv,
            key: await crypto.subtle.exportKey('raw', key)
        };
    }
    
    async decrypt(encryptedData) {
        // Simple decryption using Web Crypto API
        const key = await crypto.subtle.importKey(
            'raw',
            encryptedData.key,
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );
        
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: encryptedData.iv },
            key,
            encryptedData.data
        );
        
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }
    
    updateMetrics(operation, time, size) {
        if (operation === 'read') {
            this.metrics.reads.total = (this.metrics.reads.total || 0) + 1;
            this.metrics.performance.avgReadTime = 
                (this.metrics.performance.avgReadTime + time) / 2;
        } else if (operation === 'write') {
            this.metrics.writes.total = (this.metrics.writes.total || 0) + 1;
            this.metrics.performance.avgWriteTime = 
                (this.metrics.performance.avgWriteTime + time) / 2;
        }
    }
    
    startBackgroundServices() {
        // Start periodic sync
        setInterval(() => {
            if (!this.config.offlineMode) {
                this.sync({ full: false });
            }
        }, this.config.syncInterval);
        
        // Start cleanup service
        setInterval(() => {
            this.cleanup();
        }, 300000); // 5 minutes
        
        // Start tier rebalancing
        setInterval(() => {
            if (this.config.autoTiering) {
                this.rebalanceTiers();
            }
        }, 600000); // 10 minutes
    }
    
    async cleanup() {
        console.log('🧹 Starting data cleanup');
        
        // Clean up expired cache entries
        const now = Date.now();
        for (const [id, entry] of this.dataIndex) {
            const tier = this.storageTiers[entry.tier];
            if (tier.ttl !== Infinity && (now - entry.lastAccessed) > tier.ttl) {
                await this.delete({ id, purgeReplicas: false });
            }
        }
        
        // Clean up memory cache if over limit
        const memoryUsage = this.calculateMemoryUsage();
        if (memoryUsage > this.config.memoryCache) {
            await this.evictFromMemory();
        }
    }
    
    calculateMemoryUsage() {
        let total = 0;
        for (const [id, entry] of this.storageBackends.memory) {
            total += this.calculateSize(entry.data);
        }
        return total;
    }
    
    async evictFromMemory() {
        // Implement LRU eviction
        const entries = Array.from(this.dataIndex.entries())
            .filter(([id, entry]) => entry.tier === 'hot')
            .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        
        // Remove 25% of least recently used entries
        const toEvict = entries.slice(0, Math.ceil(entries.length * 0.25));
        
        for (const [id] of toEvict) {
            await this.deleteFromMemory(id);
            
            // Move to warm tier
            const indexEntry = this.dataIndex.get(id);
            if (indexEntry) {
                indexEntry.tier = 'warm';
                indexEntry.locations = indexEntry.locations.filter(t => t !== 'hot');
                if (!indexEntry.locations.includes('warm')) {
                    indexEntry.locations.push('warm');
                }
                this.dataIndex.set(id, indexEntry);
            }
        }
    }
    
    async rebalanceTiers() {
        console.log('⚖️ Rebalancing storage tiers');
        
        // Analyze access patterns and rebalance
        for (const [id, entry] of this.dataIndex) {
            const pattern = this.accessPatterns.get(id);
            if (pattern) {
                const optimalTier = this.calculateOptimalTier(pattern, entry);
                if (optimalTier !== entry.tier) {
                    await this.promoteTier(id, optimalTier);
                }
            }
        }
    }
    
    calculateOptimalTier(pattern, entry) {
        // High frequency recent access -> hot
        if (pattern.frequency > 1 && (Date.now() - pattern.lastAccess) < 3600000) {
            return 'hot';
        }
        
        // Moderate frequency -> warm
        if (pattern.frequency > 0.1 && (Date.now() - pattern.lastAccess) < 86400000) {
            return 'warm';
        }
        
        // Low frequency or old -> cold
        return 'cold';
    }
    
    // Event handlers
    handlePeerConnected(data) {
        const { peerId } = data;
        
        // Set up data channel for peer
        if (this.storageBackends.webrtc) {
            this.storageBackends.webrtc.peers.add(peerId);
        }
        
        // Schedule sync with new peer
        this.sync({ peers: [peerId] });
    }
    
    handlePeerDisconnected(data) {
        const { peerId } = data;
        
        // Clean up peer connections
        if (this.storageBackends.webrtc) {
            this.storageBackends.webrtc.peers.delete(peerId);
            this.storageBackends.webrtc.channels.delete(peerId);
        }
    }
    
    handleOnline() {
        console.log('📡 Network online - resuming sync');
        this.config.offlineMode = false;
        this.sync({ full: true });
    }
    
    handleOffline() {
        console.log('📡 Network offline - entering offline mode');
        this.config.offlineMode = true;
    }
    
    // Configuration and status
    async configure(newConfig) {
        this.config = { ...this.config, ...newConfig };
        await stateManager.setState('dataResourceManager.config', this.config);
        
        eventBus.emit('data-resource-manager:configured', { config: this.config });
    }
    
    getStatus() {
        return {
            name: this.name,
            version: this.version,
            isRunning: this.isRunning,
            config: this.config,
            metrics: this.metrics,
            storage: {
                totalItems: this.dataIndex.size,
                memoryUsage: this.calculateMemoryUsage(),
                backends: Object.keys(this.storageBackends).filter(k => this.storageBackends[k] !== null)
            },
            tiers: Object.keys(this.storageTiers).map(tier => ({
                name: tier,
                items: Array.from(this.dataIndex.values()).filter(entry => entry.tier === tier).length
            }))
        };
    }
}

export default DataResourceManager;