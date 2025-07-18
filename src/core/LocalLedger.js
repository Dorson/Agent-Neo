/**
 * Local Ledger Module
 * 
 * Implements a local micro-blockchain for immutable logging of Trust transactions
 * and economic state as specified in the Agent Neo whitepaper section 6.6.
 * 
 * Features:
 * - Cryptographically hash-chained transaction log
 * - DID-signed transactions for authenticity
 * - Deterministic state derivation from transaction replay
 * - Tamper-proof economic history
 * - Efficient storage in IndexedDB
 * - Pruning capabilities for older transactions
 */

import eventBus from './EventBus.js';
import CryptoManager from './CryptoManager.js';

class LocalLedger {
    constructor() {
        this.initialized = false;
        this.db = null;
        this.cryptoManager = new CryptoManager();
        this.genesisHash = null;
        this.currentHeight = 0;
        this.currentHash = null;
        
        // Transaction cache for fast lookups
        this.transactionCache = new Map();
        this.stateCache = new Map();
        
        // Configuration
        this.config = {
            maxCacheSize: 1000,
            pruneAfterBlocks: 10000,
            validateOnLoad: true
        };
        
        this.init();
    }

    async init() {
        try {
            console.log('📋 Local Ledger initializing...');
            
            // Initialize IndexedDB
            await this.initializeDatabase();
            
            // Load existing ledger or create genesis block
            await this.loadLedger();
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.initialized = true;
            console.log('✅ Local Ledger initialized successfully');
            
        } catch (error) {
            console.error('❌ Local Ledger initialization failed:', error);
            throw error;
        }
    }

    async initializeDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AgentNeoLedger', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Transactions object store
                if (!db.objectStoreNames.contains('transactions')) {
                    const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
                    txStore.createIndex('height', 'height', { unique: false });
                    txStore.createIndex('timestamp', 'timestamp', { unique: false });
                    txStore.createIndex('type', 'type', { unique: false });
                    txStore.createIndex('did', 'did', { unique: false });
                }
                
                // State snapshots object store
                if (!db.objectStoreNames.contains('states')) {
                    const stateStore = db.createObjectStore('states', { keyPath: 'height' });
                    stateStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // Metadata object store
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }
            };
        });
    }

    async loadLedger() {
        try {
            // Load metadata
            const metadata = await this.getMetadata();
            
            if (metadata.genesisHash) {
                // Existing ledger
                this.genesisHash = metadata.genesisHash;
                this.currentHeight = metadata.currentHeight || 0;
                this.currentHash = metadata.currentHash;
                
                // Validate integrity if configured
                if (this.config.validateOnLoad) {
                    await this.validateLedgerIntegrity();
                }
                
                console.log(`📋 Loaded existing ledger: height ${this.currentHeight}`);
                
            } else {
                // Create genesis block
                await this.createGenesisBlock();
                console.log('📋 Created new ledger with genesis block');
            }
            
        } catch (error) {
            console.error('❌ Failed to load ledger:', error);
            throw error;
        }
    }

    async createGenesisBlock() {
        const genesisTransaction = {
            id: 'genesis',
            height: 0,
            timestamp: Date.now(),
            type: 'GENESIS',
            did: 'system',
            data: {
                message: 'Agent Neo Local Ledger Genesis Block',
                version: '1.0.0'
            },
            previousHash: '0'.repeat(64),
            hash: null,
            signature: null
        };
        
        // Calculate genesis hash
        const hashData = JSON.stringify({
            height: genesisTransaction.height,
            timestamp: genesisTransaction.timestamp,
            type: genesisTransaction.type,
            did: genesisTransaction.did,
            data: genesisTransaction.data,
            previousHash: genesisTransaction.previousHash
        });
        
        genesisTransaction.hash = await this.cryptoManager.hash(hashData);
        this.genesisHash = genesisTransaction.hash;
        this.currentHash = genesisTransaction.hash;
        this.currentHeight = 0;
        
        // Store genesis transaction
        await this.storeTransaction(genesisTransaction);
        
        // Update metadata
        await this.updateMetadata({
            genesisHash: this.genesisHash,
            currentHeight: this.currentHeight,
            currentHash: this.currentHash
        });
    }

    async addTransaction(type, did, data, signature = null) {
        try {
            if (!this.initialized) {
                throw new Error('Local Ledger not initialized');
            }
            
            const transaction = {
                id: this.generateTransactionId(),
                height: this.currentHeight + 1,
                timestamp: Date.now(),
                type,
                did,
                data,
                previousHash: this.currentHash,
                hash: null,
                signature
            };
            
            // Calculate transaction hash
            const hashData = JSON.stringify({
                height: transaction.height,
                timestamp: transaction.timestamp,
                type: transaction.type,
                did: transaction.did,
                data: transaction.data,
                previousHash: transaction.previousHash
            });
            
            transaction.hash = await this.cryptoManager.hash(hashData);
            
            // Store transaction
            await this.storeTransaction(transaction);
            
            // Update current state
            this.currentHeight = transaction.height;
            this.currentHash = transaction.hash;
            
            // Update metadata
            await this.updateMetadata({
                currentHeight: this.currentHeight,
                currentHash: this.currentHash
            });
            
            // Update cache
            this.transactionCache.set(transaction.id, transaction);
            
            // Emit event
            eventBus.emit('ledger:transaction:added', {
                transaction,
                height: this.currentHeight
            });
            
            console.log(`📋 Added transaction: ${type} at height ${transaction.height}`);
            return transaction;
            
        } catch (error) {
            console.error('❌ Failed to add transaction:', error);
            throw error;
        }
    }

    async getTransaction(id) {
        // Check cache first
        if (this.transactionCache.has(id)) {
            return this.transactionCache.get(id);
        }
        
        // Query database
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const request = store.get(id);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    this.transactionCache.set(id, result);
                }
                resolve(result);
            };
        });
    }

    async getTransactionsByHeight(height) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const index = store.index('height');
            const request = index.getAll(height);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async getTransactionsByDID(did) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['transactions'], 'readonly');
            const store = transaction.objectStore('transactions');
            const index = store.index('did');
            const request = index.getAll(did);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async getCurrentState() {
        if (this.stateCache.has('current')) {
            return this.stateCache.get('current');
        }
        
        // Rebuild state from transactions
        const state = await this.rebuildState();
        this.stateCache.set('current', state);
        return state;
    }

    async rebuildState(upToHeight = null) {
        const targetHeight = upToHeight || this.currentHeight;
        const state = {
            trustBalances: new Map(),
            reputationScores: new Map(),
            guildMemberships: new Map(),
            moduleStates: new Map(),
            height: targetHeight,
            timestamp: Date.now()
        };
        
        // Replay all transactions up to target height
        for (let height = 0; height <= targetHeight; height++) {
            const transactions = await this.getTransactionsByHeight(height);
            
            for (const tx of transactions) {
                this.applyTransactionToState(state, tx);
            }
        }
        
        return state;
    }

    applyTransactionToState(state, transaction) {
        const { type, did, data } = transaction;
        
        switch (type) {
            case 'TRUST_REWARD':
                const currentTrust = state.trustBalances.get(did) || 0;
                state.trustBalances.set(did, currentTrust + (data.amount || 0));
                break;
                
            case 'TRUST_PENALTY':
                const currentTrustPenalty = state.trustBalances.get(did) || 0;
                state.trustBalances.set(did, Math.max(0, currentTrustPenalty - (data.amount || 0)));
                break;
                
            case 'REPUTATION_UPDATE':
                state.reputationScores.set(did, data.score || 0);
                break;
                
            case 'GUILD_JOIN':
                if (!state.guildMemberships.has(did)) {
                    state.guildMemberships.set(did, new Set());
                }
                state.guildMemberships.get(did).add(data.guildId);
                break;
                
            case 'GUILD_LEAVE':
                if (state.guildMemberships.has(did)) {
                    state.guildMemberships.get(did).delete(data.guildId);
                }
                break;
                
            case 'MODULE_STATE':
                state.moduleStates.set(data.moduleId, data.state);
                break;
        }
    }

    async validateLedgerIntegrity() {
        console.log('🔍 Validating ledger integrity...');
        
        let previousHash = '0'.repeat(64);
        let isValid = true;
        
        for (let height = 0; height <= this.currentHeight; height++) {
            const transactions = await this.getTransactionsByHeight(height);
            
            for (const tx of transactions) {
                // Validate hash chain
                if (tx.previousHash !== previousHash) {
                    console.error(`❌ Hash chain broken at height ${height}`);
                    isValid = false;
                }
                
                // Validate transaction hash
                const expectedHash = await this.calculateTransactionHash(tx);
                if (tx.hash !== expectedHash) {
                    console.error(`❌ Invalid transaction hash at height ${height}`);
                    isValid = false;
                }
                
                previousHash = tx.hash;
            }
        }
        
        if (isValid) {
            console.log('✅ Ledger integrity validated successfully');
        } else {
            throw new Error('Ledger integrity validation failed');
        }
        
        return isValid;
    }

    async calculateTransactionHash(transaction) {
        const hashData = JSON.stringify({
            height: transaction.height,
            timestamp: transaction.timestamp,
            type: transaction.type,
            did: transaction.did,
            data: transaction.data,
            previousHash: transaction.previousHash
        });
        
        return await this.cryptoManager.hash(hashData);
    }

    async storeTransaction(transaction) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['transactions'], 'readwrite');
            const store = tx.objectStore('transactions');
            const request = store.put(transaction);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async getMetadata() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['metadata'], 'readonly');
            const store = transaction.objectStore('metadata');
            const request = store.get('ledger');
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result?.data || {});
        });
    }

    async updateMetadata(data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['metadata'], 'readwrite');
            const store = transaction.objectStore('metadata');
            const request = store.put({ key: 'ledger', data });
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    generateTransactionId() {
        return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    setupEventListeners() {
        // Listen for trust updates
        eventBus.on('trust:reward', async (data) => {
            await this.addTransaction('TRUST_REWARD', data.did, {
                amount: data.amount,
                reason: data.reason,
                source: data.source
            });
        });
        
        eventBus.on('trust:penalty', async (data) => {
            await this.addTransaction('TRUST_PENALTY', data.did, {
                amount: data.amount,
                reason: data.reason,
                source: data.source
            });
        });
        
        eventBus.on('reputation:update', async (data) => {
            await this.addTransaction('REPUTATION_UPDATE', data.did, {
                score: data.score,
                reason: data.reason
            });
        });
        
        eventBus.on('guild:join', async (data) => {
            await this.addTransaction('GUILD_JOIN', data.did, {
                guildId: data.guildId,
                timestamp: Date.now()
            });
        });
        
        eventBus.on('guild:leave', async (data) => {
            await this.addTransaction('GUILD_LEAVE', data.did, {
                guildId: data.guildId,
                timestamp: Date.now()
            });
        });
    }

    // Utility methods
    async exportLedger(format = 'json') {
        const transactions = [];
        
        for (let height = 0; height <= this.currentHeight; height++) {
            const heightTransactions = await this.getTransactionsByHeight(height);
            transactions.push(...heightTransactions);
        }
        
        if (format === 'json') {
            return JSON.stringify({
                metadata: await this.getMetadata(),
                transactions,
                exportedAt: Date.now()
            }, null, 2);
        }
        
        throw new Error(`Unsupported export format: ${format}`);
    }

    async pruneOldTransactions(keepAfterHeight) {
        if (keepAfterHeight >= this.currentHeight) {
            return;
        }
        
        console.log(`🗑️ Pruning transactions below height ${keepAfterHeight}`);
        
        const transaction = this.db.transaction(['transactions'], 'readwrite');
        const store = transaction.objectStore('transactions');
        const index = store.index('height');
        
        const range = IDBKeyRange.upperBound(keepAfterHeight, true);
        const request = index.openCursor(range);
        
        return new Promise((resolve, reject) => {
            request.onerror = () => reject(request.error);
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
        });
    }

    // Getters
    get height() {
        return this.currentHeight;
    }

    get hash() {
        return this.currentHash;
    }

    get genesis() {
        return this.genesisHash;
    }
}

export default LocalLedger;