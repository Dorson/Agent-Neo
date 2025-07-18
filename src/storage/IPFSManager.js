/**
 * Native Content-Addressed Storage Manager
 * 
 * Implements content-addressed storage using native web technologies
 * instead of external IPFS/Helia dependencies. Provides IPFS-like
 * functionality using only native JS/HTML/CSS.
 */

import eventBus from '../core/EventBus.js';
import indexedDBManager from './IndexedDBManager.js';
import CryptoManager from '../core/CryptoManager.js';

class NativeContentManager {
    constructor() {
        this.initialized = false;
        this.storage = new Map();
        this.contentIndex = new Map();
        this.db = null;
        this.chunkSize = 64 * 1024; // 64KB chunks
        this.maxCacheSize = 100 * 1024 * 1024; // 100MB cache
        
        this.init();
    }

    async init() {
        try {
            console.log('📦 Initializing Native Content Manager...');
            
            // Initialize database
            this.db = indexedDBManager;
            
            // Create content stores
            await this.createObjectStores();
            
            // Load existing content index
            await this.loadContentIndex();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.initialized = true;
            
            eventBus.emit('storage:ready', {
                type: 'native-content',
                cacheSize: this.storage.size,
                indexSize: this.contentIndex.size
            });
            
            console.log('✅ Native Content Manager initialized');
            
        } catch (error) {
            console.error('❌ Native Content Manager initialization failed:', error);
            throw error;
        }
    }

    async createObjectStores() {
        // Content storage
        await this.db.createObjectStore('content', {
            keyPath: 'hash',
            indexes: [
                { name: 'timestamp', keyPath: 'timestamp' },
                { name: 'size', keyPath: 'size' },
                { name: 'type', keyPath: 'type' }
            ]
        });
        
        // Content metadata
        await this.db.createObjectStore('metadata', {
            keyPath: 'hash',
            indexes: [
                { name: 'filename', keyPath: 'filename' },
                { name: 'pinned', keyPath: 'pinned' },
                { name: 'accessed', keyPath: 'lastAccessed' }
            ]
        });
        
        // Chunk storage for large files
        await this.db.createObjectStore('chunks', {
            keyPath: 'id',
            indexes: [
                { name: 'parentHash', keyPath: 'parentHash' },
                { name: 'index', keyPath: 'index' }
            ]
        });
    }

    setupEventListeners() {
        eventBus.on('storage:store', this.storeContent.bind(this));
        eventBus.on('storage:retrieve', this.retrieveContent.bind(this));
        eventBus.on('storage:pin', this.pinContent.bind(this));
        eventBus.on('storage:unpin', this.unpinContent.bind(this));
        eventBus.on('storage:list', this.listContent.bind(this));
        eventBus.on('storage:stats', this.getStats.bind(this));
    }

    /**
     * Store content with content addressing
     */
    async storeContent(data, options = {}) {
        try {
            // Normalize data to Uint8Array
            const content = this.normalizeContent(data);
            
            // Generate content hash
            const hash = await this.generateHash(content);
            
            // Check if already exists
            if (this.storage.has(hash)) {
                return { hash, size: content.length, cached: true };
            }
            
            // Store metadata
            const metadata = {
                hash,
                filename: options.filename || `content_${hash.slice(0, 8)}`,
                size: content.length,
                type: options.type || 'application/octet-stream',
                pinned: options.pin || false,
                timestamp: Date.now(),
                lastAccessed: Date.now()
            };
            
            // Handle large files with chunking
            if (content.length > this.chunkSize) {
                await this.storeChunked(hash, content, metadata);
            } else {
                await this.storeDirect(hash, content, metadata);
            }
            
            // Update cache if under limit
            if (this.getCacheSize() < this.maxCacheSize) {
                this.storage.set(hash, content);
            }
            
            this.contentIndex.set(hash, metadata);
            
            eventBus.emit('storage:stored', {
                hash,
                size: content.length,
                chunked: content.length > this.chunkSize
            });
            
            return { hash, size: content.length };
            
        } catch (error) {
            console.error('Failed to store content:', error);
            throw error;
        }
    }

    /**
     * Retrieve content by hash
     */
    async retrieveContent(hash, options = {}) {
        try {
            // Check cache first
            if (this.storage.has(hash)) {
                this.updateAccessTime(hash);
                return this.storage.get(hash);
            }
            
            // Get metadata
            const metadata = this.contentIndex.get(hash) || 
                            await this.db.get('metadata', hash);
            
            if (!metadata) {
                throw new Error(`Content not found: ${hash}`);
            }
            
            // Retrieve content
            let content;
            if (metadata.size > this.chunkSize) {
                content = await this.retrieveChunked(hash, metadata);
            } else {
                content = await this.retrieveDirect(hash);
            }
            
            // Update cache and access time
            if (content && this.getCacheSize() < this.maxCacheSize) {
                this.storage.set(hash, content);
            }
            
            this.updateAccessTime(hash);
            
            eventBus.emit('storage:retrieved', {
                hash,
                size: content.length,
                source: this.storage.has(hash) ? 'cache' : 'storage'
            });
            
            return content;
            
        } catch (error) {
            console.error('Failed to retrieve content:', error);
            throw error;
        }
    }

    async storeDirect(hash, content, metadata) {
        // Store content directly
        await this.db.put('content', {
            hash,
            data: Array.from(content),
            timestamp: Date.now(),
            size: content.length,
            type: metadata.type
        });
        
        // Store metadata
        await this.db.put('metadata', metadata);
    }

    async storeChunked(hash, content, metadata) {
        const chunks = this.createChunks(content);
        
        // Store each chunk
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkHash = await this.generateHash(chunk);
            
            await this.db.put('chunks', {
                id: `${hash}_${i}`,
                parentHash: hash,
                index: i,
                hash: chunkHash,
                data: Array.from(chunk),
                size: chunk.length
            });
        }
        
        // Store metadata with chunk info
        metadata.chunks = chunks.length;
        await this.db.put('metadata', metadata);
    }

    async retrieveDirect(hash) {
        const record = await this.db.get('content', hash);
        if (!record) return null;
        
        return new Uint8Array(record.data);
    }

    async retrieveChunked(hash, metadata) {
        const chunks = [];
        
        // Retrieve all chunks
        for (let i = 0; i < metadata.chunks; i++) {
            const chunk = await this.db.get('chunks', `${hash}_${i}`);
            if (!chunk) {
                throw new Error(`Missing chunk ${i} for content ${hash}`);
            }
            chunks.push(new Uint8Array(chunk.data));
        }
        
        // Concatenate chunks
        return this.concatenateChunks(chunks);
    }

    createChunks(content) {
        const chunks = [];
        
        for (let i = 0; i < content.length; i += this.chunkSize) {
            chunks.push(content.slice(i, i + this.chunkSize));
        }
        
        return chunks;
    }

    concatenateChunks(chunks) {
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        
        return result;
    }

    async generateHash(content) {
        // Use Web Crypto API for hashing
        const buffer = await crypto.subtle.digest('SHA-256', content);
        const hashArray = Array.from(new Uint8Array(buffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    normalizeContent(data) {
        if (data instanceof Uint8Array) {
            return data;
        }
        
        if (typeof data === 'string') {
            return new TextEncoder().encode(data);
        }
        
        if (data instanceof ArrayBuffer) {
            return new Uint8Array(data);
        }
        
        // Serialize objects/arrays to JSON
        return new TextEncoder().encode(JSON.stringify(data));
    }

    async loadContentIndex() {
        try {
            const allMetadata = await this.db.getAll('metadata');
            
            for (const metadata of allMetadata) {
                this.contentIndex.set(metadata.hash, metadata);
            }
            
            console.log(`📋 Loaded ${allMetadata.length} content entries`);
            
        } catch (error) {
            console.warn('Could not load content index:', error);
        }
    }

    updateAccessTime(hash) {
        const metadata = this.contentIndex.get(hash);
        if (metadata) {
            metadata.lastAccessed = Date.now();
            this.contentIndex.set(hash, metadata);
            
            // Update in database asynchronously
            this.db.put('metadata', metadata).catch(console.error);
        }
    }

    async pinContent(hash) {
        const metadata = this.contentIndex.get(hash);
        if (metadata) {
            metadata.pinned = true;
            this.contentIndex.set(hash, metadata);
            await this.db.put('metadata', metadata);
            
            eventBus.emit('storage:pinned', { hash });
            return true;
        }
        return false;
    }

    async unpinContent(hash) {
        const metadata = this.contentIndex.get(hash);
        if (metadata) {
            metadata.pinned = false;
            this.contentIndex.set(hash, metadata);
            await this.db.put('metadata', metadata);
            
            eventBus.emit('storage:unpinned', { hash });
            return true;
        }
        return false;
    }

    listContent(filter = {}) {
        const results = [];
        
        for (const [hash, metadata] of this.contentIndex.entries()) {
            let include = true;
            
            if (filter.pinned !== undefined && metadata.pinned !== filter.pinned) {
                include = false;
            }
            
            if (filter.type && metadata.type !== filter.type) {
                include = false;
            }
            
            if (filter.minSize && metadata.size < filter.minSize) {
                include = false;
            }
            
            if (filter.maxSize && metadata.size > filter.maxSize) {
                include = false;
            }
            
            if (include) {
                results.push({ hash, ...metadata });
            }
        }
        
        return results.sort((a, b) => b.lastAccessed - a.lastAccessed);
    }

    getCacheSize() {
        let size = 0;
        for (const content of this.storage.values()) {
            size += content.length;
        }
        return size;
    }

    getStats() {
        const stats = {
            totalContent: this.contentIndex.size,
            cacheSize: this.getCacheSize(),
            maxCacheSize: this.maxCacheSize,
            pinned: 0,
            totalSize: 0
        };
        
        for (const metadata of this.contentIndex.values()) {
            if (metadata.pinned) stats.pinned++;
            stats.totalSize += metadata.size;
        }
        
        return stats;
    }

    async garbageCollect() {
        const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
        const toDelete = [];
        
        for (const [hash, metadata] of this.contentIndex.entries()) {
            if (!metadata.pinned && metadata.lastAccessed < cutoffTime) {
                toDelete.push(hash);
            }
        }
        
        for (const hash of toDelete) {
            await this.deleteContent(hash);
        }
        
        console.log(`🗑️ Garbage collected ${toDelete.length} content items`);
        
        return toDelete.length;
    }

    async deleteContent(hash) {
        const metadata = this.contentIndex.get(hash);
        if (!metadata || metadata.pinned) return false;
        
        try {
            // Delete from cache
            this.storage.delete(hash);
            this.contentIndex.delete(hash);
            
            // Delete from storage
            if (metadata.chunks) {
                // Delete chunks
                for (let i = 0; i < metadata.chunks; i++) {
                    await this.db.delete('chunks', `${hash}_${i}`);
                }
            } else {
                await this.db.delete('content', hash);
            }
            
            await this.db.delete('metadata', hash);
            
            eventBus.emit('storage:deleted', { hash });
            return true;
            
        } catch (error) {
            console.error('Failed to delete content:', error);
            return false;
        }
    }

    async shutdown() {
        console.log('🛑 Shutting down Native Content Manager...');
        
        this.storage.clear();
        this.contentIndex.clear();
        
        if (this.db) {
            await this.db.close();
        }
        
        console.log('✅ Native Content Manager shut down');
    }
}

export default NativeContentManager;