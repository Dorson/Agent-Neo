/**
 * IndexedDB Manager
 * 
 * Provides a robust, asynchronous wrapper for IndexedDB operations,
 * abstracting away complexities as specified in the implementation plan.
 * 
 * Features:
 * - Database opening, versioning, object store creation
 * - Generic utility functions for CRUD operations
 * - Error handling and transaction management
 * - Support for Agent Neo's data stores
 */

import eventBus from '../core/EventBus.js';
import { config } from '../core/config.js';

class IndexedDBManager {
    constructor() {
        this.name = 'IndexedDBManager';
        this.version = '1.0.0';
        this.initialized = false;
        this.db = null;
        this.dbName = config.database.name;
        this.dbVersion = config.database.version;
        this.stores = config.database.stores;
        
        this.init();
    }

    async init() {
        try {
            console.log('🗄️ Initializing IndexedDB Manager...');
            
            await this.openDatabase();
            this.setupEventListeners();
            
            this.initialized = true;
            console.log('✅ IndexedDB Manager initialized');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version,
                capabilities: ['data_storage', 'transaction_management', 'crud_operations']
            });
            
        } catch (error) {
            console.error('❌ IndexedDB Manager initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        eventBus.on('db:clear', this.clearDatabase.bind(this));
        eventBus.on('db:export', this.exportDatabase.bind(this));
        eventBus.on('db:import', this.importDatabase.bind(this));
    }

    async openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                reject(new Error(`Failed to open database: ${request.error}`));
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log(`📂 Database ${this.dbName} opened successfully`);
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log(`🔄 Upgrading database from version ${event.oldVersion} to ${event.newVersion}`);
                
                // Create object stores
                Object.entries(this.stores).forEach(([key, storeName]) => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        let store;
                        
                        switch (storeName) {
                            case 'identity':
                                store = db.createObjectStore(storeName, { keyPath: 'id' });
                                store.createIndex('did', 'did', { unique: true });
                                break;
                                
                            case 'operational_keys':
                                store = db.createObjectStore(storeName, { keyPath: 'id' });
                                store.createIndex('validUntil', 'validUntil', { unique: false });
                                break;
                                
                            case 'recovery':
                                store = db.createObjectStore(storeName, { keyPath: 'id' });
                                break;
                                
                            case 'ledger':
                                store = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
                                store.createIndex('timestamp', 'timestamp', { unique: false });
                                store.createIndex('type', 'type', { unique: false });
                                store.createIndex('fromDID', 'fromDID', { unique: false });
                                break;
                                
                            case 'trust_lists':
                                store = db.createObjectStore(storeName, { keyPath: 'did' });
                                store.createIndex('trustScore', 'trustScore', { unique: false });
                                store.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                                break;
                                
                            case 'knowledge_chunks':
                                store = db.createObjectStore(storeName, { keyPath: 'id' });
                                store.createIndex('contentHash', 'contentHash', { unique: true });
                                store.createIndex('type', 'type', { unique: false });
                                store.createIndex('timestamp', 'timestamp', { unique: false });
                                break;
                                
                            case 'session_context':
                                store = db.createObjectStore(storeName, { keyPath: 'id' });
                                store.createIndex('sessionId', 'sessionId', { unique: false });
                                store.createIndex('timestamp', 'timestamp', { unique: false });
                                break;
                                
                            case 'guilds':
                                store = db.createObjectStore(storeName, { keyPath: 'id' });
                                store.createIndex('name', 'name', { unique: false });
                                store.createIndex('trustLevel', 'trustLevel', { unique: false });
                                break;
                                
                            case 'tasks':
                                store = db.createObjectStore(storeName, { keyPath: 'id' });
                                store.createIndex('status', 'status', { unique: false });
                                store.createIndex('timestamp', 'timestamp', { unique: false });
                                store.createIndex('priority', 'priority', { unique: false });
                                break;
                                
                            case 'metrics':
                                store = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
                                store.createIndex('timestamp', 'timestamp', { unique: false });
                                store.createIndex('type', 'type', { unique: false });
                                break;
                                
                            default:
                                store = db.createObjectStore(storeName, { keyPath: 'id' });
                                break;
                        }
                        
                        console.log(`📋 Created object store: ${storeName}`);
                    }
                });
            };
        });
    }

    // Generic CRUD operations
    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async query(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async queryRange(storeName, indexName, range) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(range);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async count(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Transaction management
    async performTransaction(storeNames, mode, operation) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeNames, mode);
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(new Error('Transaction aborted'));
            
            try {
                operation(transaction);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Database utilities
    async clearDatabase() {
        try {
            const storeNames = Object.values(this.stores);
            
            await this.performTransaction(storeNames, 'readwrite', (transaction) => {
                storeNames.forEach(storeName => {
                    const store = transaction.objectStore(storeName);
                    store.clear();
                });
            });
            
            console.log('🗑️ Database cleared successfully');
            eventBus.emit('db:cleared');
            
        } catch (error) {
            console.error('❌ Failed to clear database:', error);
            throw error;
        }
    }

    async exportDatabase() {
        try {
            const data = {};
            
            for (const [key, storeName] of Object.entries(this.stores)) {
                data[storeName] = await this.getAll(storeName);
            }
            
            const exportData = {
                version: this.dbVersion,
                timestamp: Date.now(),
                data: data
            };
            
            console.log('📤 Database exported successfully');
            eventBus.emit('db:exported', exportData);
            
            return exportData;
            
        } catch (error) {
            console.error('❌ Failed to export database:', error);
            throw error;
        }
    }

    async importDatabase(importData) {
        try {
            if (!importData.data || !importData.version) {
                throw new Error('Invalid import data format');
            }
            
            // Clear existing data
            await this.clearDatabase();
            
            // Import data
            for (const [storeName, records] of Object.entries(importData.data)) {
                if (records && Array.isArray(records)) {
                    for (const record of records) {
                        await this.put(storeName, record);
                    }
                }
            }
            
            console.log('📥 Database imported successfully');
            eventBus.emit('db:imported', importData);
            
        } catch (error) {
            console.error('❌ Failed to import database:', error);
            throw error;
        }
    }

    // Specialized methods for Agent Neo data structures
    async addLedgerEntry(entry) {
        const ledgerEntry = {
            ...entry,
            timestamp: Date.now(),
            id: undefined // Let autoIncrement handle this
        };
        
        return await this.put(this.stores.ledger, ledgerEntry);
    }

    async getLedgerHistory(limit = 100) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.stores.ledger], 'readonly');
            const store = transaction.objectStore(this.stores.ledger);
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev');
            
            const results = [];
            let count = 0;
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && count < limit) {
                    results.push(cursor.value);
                    count++;
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    async updateTrustScore(did, trustScore) {
        const trustEntry = {
            did: did,
            trustScore: trustScore,
            lastUpdated: Date.now()
        };
        
        return await this.put(this.stores.trust_lists, trustEntry);
    }

    async getTrustScore(did) {
        const entry = await this.get(this.stores.trust_lists, did);
        return entry ? entry.trustScore : 0;
    }

    async addKnowledgeChunk(chunk) {
        const knowledgeChunk = {
            ...chunk,
            timestamp: Date.now()
        };
        
        return await this.put(this.stores.knowledge_chunks, knowledgeChunk);
    }

    async searchKnowledge(query) {
        const allChunks = await this.getAll(this.stores.knowledge_chunks);
        
        // Simple text search - in production, this would use more sophisticated indexing
        return allChunks.filter(chunk => 
            chunk.content && chunk.content.toLowerCase().includes(query.toLowerCase())
        );
    }

    // Health check
    async healthCheck() {
        try {
            const storeNames = Object.values(this.stores);
            const health = {
                connected: !!this.db,
                stores: {},
                totalRecords: 0
            };
            
            for (const storeName of storeNames) {
                const count = await this.count(storeName);
                health.stores[storeName] = count;
                health.totalRecords += count;
            }
            
            return health;
            
        } catch (error) {
            return {
                connected: false,
                error: error.message
            };
        }
    }

    // Cleanup and shutdown
    async shutdown() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('📂 IndexedDB connection closed');
        }
    }
}

// Create singleton instance
const indexedDBManager = new IndexedDBManager();

export default indexedDBManager;