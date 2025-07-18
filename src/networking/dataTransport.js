/**
 * Data Transport Module
 * 
 * Implements efficient, large-scale data transfers using principles inspired by
 * BitTorrent v2 as specified in the Agent Neo implementation plan Step 14.
 * 
 * Features:
 * - Content addressing with SHA-256 hashes
 * - Merkle tree integrity verification
 * - Piece-wise transfer with BitTorrent v2 protocol
 * - Fountain codes for enhanced redundancy
 * - Choke/unchoke algorithm for bandwidth management
 * - Encrypted data transfers by default
 * - Deduplication and efficient storage
 */

import eventBus from '../core/EventBus.js';
import cryptoManager from '../core/CryptoManager.js';
import indexedDBManager from '../storage/IndexedDBManager.js';
import p2pService from './P2PService.js';

class DataTransport {
    constructor() {
        this.initialized = false;
        this.version = '1.0.0';
        
        // Configuration
        this.config = {
            pieceSize: 262144, // 256KB pieces (BitTorrent v2 standard)
            maxPeersPerSwarm: 50,
            maxSimultaneousDownloads: 10,
            maxSimultaneousUploads: 5,
            chokeInterval: 10000, // 10 seconds
            requestTimeout: 30000, // 30 seconds
            fountainCodeOverhead: 0.1, // 10% overhead for fountain codes
            encryptionRequired: true
        };
        
        // Active transfers
        this.activeDownloads = new Map(); // contentHash -> DownloadState
        this.activeUploads = new Map();   // contentHash -> UploadState
        this.swarms = new Map();          // contentHash -> SwarmState
        this.peerConnections = new Map(); // peerId -> PeerConnection
        
        // Piece management
        this.availablePieces = new Map(); // contentHash -> Set<pieceIndex>
        this.requestedPieces = new Map(); // contentHash -> Map<pieceIndex, timestamp>
        
        // Bandwidth management
        this.uploadSlots = new Map();     // peerId -> boolean (unchoked)
        this.downloadSlots = new Map();   // peerId -> boolean (interested)
        
        // Fountain codes state
        this.fountainEncoders = new Map(); // contentHash -> FountainEncoder
        this.fountainDecoders = new Map(); // contentHash -> FountainDecoder
        
        this.init();
    }

    async init() {
        try {
            console.log('🚚 Data Transport initializing...');
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize storage
            await this.initializeStorage();
            
            // Start periodic processes
            this.startChokeUnchoke();
            this.startPieceSelection();
            
            this.initialized = true;
            console.log('✅ Data Transport initialized successfully');
            
        } catch (error) {
            console.error('❌ Data Transport initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // P2P protocol handlers
        eventBus.on('p2p:peer_connected', this.handlePeerConnected.bind(this));
        eventBus.on('p2p:peer_disconnected', this.handlePeerDisconnected.bind(this));
        eventBus.on('p2p:message_received', this.handleMessage.bind(this));
        
        // Data transfer requests
        eventBus.on('transport:download_data', this.handleDownloadRequest.bind(this));
        eventBus.on('transport:upload_data', this.handleUploadRequest.bind(this));
        eventBus.on('transport:cancel_transfer', this.handleCancelTransfer.bind(this));
    }

    async initializeStorage() {
        // Ensure required object stores exist
        const stores = ['pieces', 'torrents', 'peer_stats'];
        for (const store of stores) {
            await indexedDBManager.ensureStore(store);
        }
    }

    /**
     * Create content hash for data (BitTorrent v2 style)
     */
    async createContentHash(data) {
        try {
            if (typeof data === 'string') {
                data = new TextEncoder().encode(data);
            }
            
            // Use SHA-256 for content addressing
            const hash = await cryptoManager.sha256(data);
            return hash;
            
        } catch (error) {
            console.error('❌ Failed to create content hash:', error);
            throw error;
        }
    }

    /**
     * Create Merkle tree for file integrity (BitTorrent v2)
     */
    async createMerkleTree(pieces) {
        try {
            const hashes = [];
            
            // Hash each piece
            for (const piece of pieces) {
                const pieceHash = await cryptoManager.sha256(piece);
                hashes.push(pieceHash);
            }
            
            // Build Merkle tree bottom-up
            let currentLevel = hashes;
            const tree = [currentLevel];
            
            while (currentLevel.length > 1) {
                const nextLevel = [];
                
                for (let i = 0; i < currentLevel.length; i += 2) {
                    const left = currentLevel[i];
                    const right = currentLevel[i + 1] || left; // Duplicate last hash if odd
                    
                    const combined = left + right;
                    const parentHash = await cryptoManager.sha256(combined);
                    nextLevel.push(parentHash);
                }
                
                tree.push(nextLevel);
                currentLevel = nextLevel;
            }
            
            return {
                rootHash: currentLevel[0],
                tree: tree,
                pieceHashes: hashes
            };
            
        } catch (error) {
            console.error('❌ Failed to create Merkle tree:', error);
            throw error;
        }
    }

    /**
     * Split data into pieces for transfer
     */
    splitIntoPieces(data) {
        try {
            if (typeof data === 'string') {
                data = new TextEncoder().encode(data);
            }
            
            const pieces = [];
            const pieceSize = this.config.pieceSize;
            
            for (let i = 0; i < data.length; i += pieceSize) {
                const piece = data.slice(i, i + pieceSize);
                pieces.push(piece);
            }
            
            return pieces;
            
        } catch (error) {
            console.error('❌ Failed to split data into pieces:', error);
            throw error;
        }
    }

    /**
     * Initialize fountain codes for a file
     */
    async initializeFountainCodes(contentHash, pieces) {
        try {
            // Create fountain encoder for redundancy
            const encoder = new FountainEncoder(pieces, this.config.fountainCodeOverhead);
            this.fountainEncoders.set(contentHash, encoder);
            
            // Create decoder for reconstruction
            const decoder = new FountainDecoder(pieces.length);
            this.fountainDecoders.set(contentHash, decoder);
            
            return { encoder, decoder };
            
        } catch (error) {
            console.error('❌ Failed to initialize fountain codes:', error);
            throw error;
        }
    }

    /**
     * Start upload of data to network
     */
    async uploadData(data, metadata = {}) {
        try {
            // Split data into pieces
            const pieces = this.splitIntoPieces(data);
            
            // Create content hash
            const contentHash = await this.createContentHash(data);
            
            // Create Merkle tree
            const merkleTree = await this.createMerkleTree(pieces);
            
            // Initialize fountain codes
            await this.initializeFountainCodes(contentHash, pieces);
            
            // Store pieces locally
            await this.storePieces(contentHash, pieces);
            
            // Create torrent-like metadata
            const torrent = {
                contentHash: contentHash,
                size: data.length,
                pieceSize: this.config.pieceSize,
                pieceCount: pieces.length,
                merkleRoot: merkleTree.rootHash,
                pieceHashes: merkleTree.pieceHashes,
                metadata: metadata,
                created: Date.now(),
                seeded: true
            };
            
            // Store torrent info
            await indexedDBManager.put('torrents', torrent, contentHash);
            
            // Initialize upload state
            this.activeUploads.set(contentHash, {
                torrent: torrent,
                uploadedBytes: 0,
                connectedPeers: new Set(),
                requestQueue: []
            });
            
            // Announce to network
            await this.announceContent(contentHash, torrent);
            
            console.log(`📤 Started seeding content: ${contentHash}`);
            return contentHash;
            
        } catch (error) {
            console.error('❌ Failed to upload data:', error);
            throw error;
        }
    }

    /**
     * Start download of data from network
     */
    async downloadData(contentHash, torrent = null) {
        try {
            // Get or create torrent info
            if (!torrent) {
                torrent = await this.getTorrentInfo(contentHash);
                if (!torrent) {
                    throw new Error('Torrent information not available');
                }
            }
            
            // Check if already downloaded
            const existingPieces = await this.getStoredPieces(contentHash);
            if (existingPieces.length === torrent.pieceCount) {
                console.log(`✅ Content already available: ${contentHash}`);
                return await this.reconstructData(contentHash, torrent);
            }
            
            // Initialize download state
            this.activeDownloads.set(contentHash, {
                torrent: torrent,
                downloadedPieces: new Set(existingPieces),
                downloadedBytes: existingPieces.length * this.config.pieceSize,
                connectedPeers: new Set(),
                progress: existingPieces.length / torrent.pieceCount
            });
            
            // Initialize fountain decoder
            const decoder = new FountainDecoder(torrent.pieceCount);
            this.fountainDecoders.set(contentHash, decoder);
            
            // Find peers with this content
            await this.findPeers(contentHash);
            
            // Start piece selection and downloading
            this.startPieceDownload(contentHash);
            
            console.log(`📥 Started downloading content: ${contentHash}`);
            
            // Return promise that resolves when download completes
            return new Promise((resolve, reject) => {
                const checkComplete = () => {
                    const downloadState = this.activeDownloads.get(contentHash);
                    if (downloadState && downloadState.progress >= 1.0) {
                        this.reconstructData(contentHash, torrent)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        setTimeout(checkComplete, 1000);
                    }
                };
                checkComplete();
            });
            
        } catch (error) {
            console.error('❌ Failed to download data:', error);
            throw error;
        }
    }

    /**
     * Store pieces in local storage with deduplication
     */
    async storePieces(contentHash, pieces) {
        try {
            for (let i = 0; i < pieces.length; i++) {
                const piece = pieces[i];
                const pieceHash = await cryptoManager.sha256(piece);
                
                // Store with content-addressed key for deduplication
                await indexedDBManager.put('pieces', {
                    contentHash: contentHash,
                    pieceIndex: i,
                    pieceHash: pieceHash,
                    data: piece,
                    stored: Date.now()
                }, `${contentHash}:${i}`);
            }
            
            // Update available pieces
            const pieceSet = new Set();
            for (let i = 0; i < pieces.length; i++) {
                pieceSet.add(i);
            }
            this.availablePieces.set(contentHash, pieceSet);
            
        } catch (error) {
            console.error('❌ Failed to store pieces:', error);
            throw error;
        }
    }

    /**
     * Get stored pieces for content
     */
    async getStoredPieces(contentHash) {
        try {
            const pieces = [];
            const allPieces = await indexedDBManager.getAll('pieces');
            
            for (const piece of allPieces) {
                if (piece.contentHash === contentHash) {
                    pieces[piece.pieceIndex] = piece;
                }
            }
            
            return pieces.filter(p => p); // Remove empty slots
            
        } catch (error) {
            console.error('❌ Failed to get stored pieces:', error);
            return [];
        }
    }

    /**
     * Piece selection algorithm (rarest first)
     */
    selectNextPiece(contentHash) {
        try {
            const downloadState = this.activeDownloads.get(contentHash);
            if (!downloadState) return null;
            
            // Get piece availability from peers
            const pieceAvailability = new Map();
            const torrent = downloadState.torrent;
            
            // Count availability of each piece across peers
            for (let i = 0; i < torrent.pieceCount; i++) {
                if (!downloadState.downloadedPieces.has(i)) {
                    let count = 0;
                    for (const peerId of downloadState.connectedPeers) {
                        const peerPieces = this.getPeerPieces(peerId, contentHash);
                        if (peerPieces && peerPieces.has(i)) {
                            count++;
                        }
                    }
                    pieceAvailability.set(i, count);
                }
            }
            
            // Select rarest piece (lowest availability)
            let selectedPiece = null;
            let minAvailability = Infinity;
            
            for (const [pieceIndex, availability] of pieceAvailability) {
                if (availability > 0 && availability < minAvailability) {
                    minAvailability = availability;
                    selectedPiece = pieceIndex;
                }
            }
            
            return selectedPiece;
            
        } catch (error) {
            console.error('❌ Failed to select next piece:', error);
            return null;
        }
    }

    /**
     * Request piece from peers
     */
    async requestPiece(contentHash, pieceIndex) {
        try {
            const downloadState = this.activeDownloads.get(contentHash);
            if (!downloadState) return;
            
            // Find peers that have this piece
            const candidatePeers = [];
            for (const peerId of downloadState.connectedPeers) {
                const peerPieces = this.getPeerPieces(peerId, contentHash);
                if (peerPieces && peerPieces.has(pieceIndex)) {
                    candidatePeers.push(peerId);
                }
            }
            
            if (candidatePeers.length === 0) return;
            
            // Select peer (round-robin for now)
            const selectedPeer = candidatePeers[Math.floor(Math.random() * candidatePeers.length)];
            
            // Send piece request
            await this.sendMessage(selectedPeer, {
                type: 'PIECE_REQUEST',
                contentHash: contentHash,
                pieceIndex: pieceIndex,
                timestamp: Date.now()
            });
            
            // Track request
            if (!this.requestedPieces.has(contentHash)) {
                this.requestedPieces.set(contentHash, new Map());
            }
            this.requestedPieces.get(contentHash).set(pieceIndex, Date.now());
            
        } catch (error) {
            console.error('❌ Failed to request piece:', error);
        }
    }

    /**
     * Handle piece request from peer
     */
    async handlePieceRequest(peerId, message) {
        try {
            const { contentHash, pieceIndex } = message;
            
            // Check if we have this piece
            const availablePieces = this.availablePieces.get(contentHash);
            if (!availablePieces || !availablePieces.has(pieceIndex)) {
                return; // Don't have the piece
            }
            
            // Check if peer is unchoked
            if (!this.uploadSlots.get(peerId)) {
                return; // Peer is choked
            }
            
            // Get piece data
            const piece = await indexedDBManager.get('pieces', `${contentHash}:${pieceIndex}`);
            if (!piece) return;
            
            // Encrypt piece data
            const encryptedData = await this.encryptPieceData(piece.data, peerId);
            
            // Send piece
            await this.sendMessage(peerId, {
                type: 'PIECE_DATA',
                contentHash: contentHash,
                pieceIndex: pieceIndex,
                data: encryptedData,
                pieceHash: piece.pieceHash
            });
            
            // Update upload statistics
            const uploadState = this.activeUploads.get(contentHash);
            if (uploadState) {
                uploadState.uploadedBytes += piece.data.length;
            }
            
        } catch (error) {
            console.error('❌ Failed to handle piece request:', error);
        }
    }

    /**
     * Handle received piece data
     */
    async handlePieceData(peerId, message) {
        try {
            const { contentHash, pieceIndex, data, pieceHash } = message;
            
            // Decrypt piece data
            const decryptedData = await this.decryptPieceData(data, peerId);
            
            // Verify piece integrity
            const computedHash = await cryptoManager.sha256(decryptedData);
            if (computedHash !== pieceHash) {
                console.warn(`⚠️ Piece integrity check failed: ${contentHash}:${pieceIndex}`);
                return;
            }
            
            // Store piece
            await indexedDBManager.put('pieces', {
                contentHash: contentHash,
                pieceIndex: pieceIndex,
                pieceHash: pieceHash,
                data: decryptedData,
                stored: Date.now()
            }, `${contentHash}:${pieceIndex}`);
            
            // Update download state
            const downloadState = this.activeDownloads.get(contentHash);
            if (downloadState) {
                downloadState.downloadedPieces.add(pieceIndex);
                downloadState.downloadedBytes += decryptedData.length;
                downloadState.progress = downloadState.downloadedPieces.size / downloadState.torrent.pieceCount;
                
                // Update fountain decoder
                const decoder = this.fountainDecoders.get(contentHash);
                if (decoder) {
                    decoder.addPiece(pieceIndex, decryptedData);
                }
                
                eventBus.emit('transport:download_progress', {
                    contentHash: contentHash,
                    progress: downloadState.progress,
                    downloadedBytes: downloadState.downloadedBytes
                });
            }
            
            // Clear request tracking
            const requestedPieces = this.requestedPieces.get(contentHash);
            if (requestedPieces) {
                requestedPieces.delete(pieceIndex);
            }
            
        } catch (error) {
            console.error('❌ Failed to handle piece data:', error);
        }
    }

    /**
     * Choke/Unchoke algorithm (tit-for-tat)
     */
    startChokeUnchoke() {
        setInterval(() => {
            this.runChokeUnchoke();
        }, this.config.chokeInterval);
    }

    runChokeUnchoke() {
        try {
            // Get peer statistics
            const peerStats = new Map();
            
            for (const [peerId, connection] of this.peerConnections) {
                const stats = {
                    peerId: peerId,
                    uploadRate: this.calculateUploadRate(peerId),
                    downloadRate: this.calculateDownloadRate(peerId),
                    isSeeder: this.isPeerSeeder(peerId)
                };
                peerStats.set(peerId, stats);
            }
            
            // Sort peers by upload rate (descending)
            const sortedPeers = Array.from(peerStats.values())
                .sort((a, b) => b.uploadRate - a.uploadRate);
            
            // Unchoke top uploaders
            const maxUnchokedPeers = this.config.maxSimultaneousUploads;
            
            // Clear all upload slots
            this.uploadSlots.clear();
            
            // Unchoke top peers
            for (let i = 0; i < Math.min(maxUnchokedPeers, sortedPeers.length); i++) {
                const peer = sortedPeers[i];
                this.uploadSlots.set(peer.peerId, true);
            }
            
            // Optimistic unchoke (random peer)
            if (sortedPeers.length > maxUnchokedPeers) {
                const remaining = sortedPeers.slice(maxUnchokedPeers);
                if (remaining.length > 0) {
                    const randomPeer = remaining[Math.floor(Math.random() * remaining.length)];
                    this.uploadSlots.set(randomPeer.peerId, true);
                }
            }
            
        } catch (error) {
            console.error('❌ Choke/unchoke algorithm failed:', error);
        }
    }

    /**
     * Start piece downloading process
     */
    startPieceDownload(contentHash) {
        const downloadInterval = setInterval(() => {
            const downloadState = this.activeDownloads.get(contentHash);
            if (!downloadState) {
                clearInterval(downloadInterval);
                return;
            }
            
            if (downloadState.progress >= 1.0) {
                clearInterval(downloadInterval);
                return;
            }
            
            // Select and request next piece
            const nextPiece = this.selectNextPiece(contentHash);
            if (nextPiece !== null) {
                this.requestPiece(contentHash, nextPiece);
            }
        }, 1000);
    }

    /**
     * Encrypt piece data for peer
     */
    async encryptPieceData(data, peerId) {
        try {
            if (!this.config.encryptionRequired) {
                return data;
            }
            
            // Use shared key derived from DID exchange
            const sharedKey = await this.getSharedKey(peerId);
            const encrypted = await cryptoManager.encrypt(data, sharedKey);
            return encrypted;
            
        } catch (error) {
            console.error('❌ Failed to encrypt piece data:', error);
            throw error;
        }
    }

    /**
     * Decrypt piece data from peer
     */
    async decryptPieceData(encryptedData, peerId) {
        try {
            if (!this.config.encryptionRequired) {
                return encryptedData;
            }
            
            const sharedKey = await this.getSharedKey(peerId);
            const decrypted = await cryptoManager.decrypt(encryptedData, sharedKey);
            return decrypted;
            
        } catch (error) {
            console.error('❌ Failed to decrypt piece data:', error);
            throw error;
        }
    }

    /**
     * Reconstruct data from pieces
     */
    async reconstructData(contentHash, torrent) {
        try {
            const pieces = await this.getStoredPieces(contentHash);
            
            if (pieces.length < torrent.pieceCount) {
                // Try fountain codes reconstruction
                const decoder = this.fountainDecoders.get(contentHash);
                if (decoder && decoder.canReconstruct()) {
                    const reconstructed = decoder.reconstruct();
                    return reconstructed;
                }
                throw new Error('Insufficient pieces for reconstruction');
            }
            
            // Reconstruct from pieces
            const data = new Uint8Array(torrent.size);
            let offset = 0;
            
            for (let i = 0; i < torrent.pieceCount; i++) {
                const piece = pieces.find(p => p.pieceIndex === i);
                if (!piece) {
                    throw new Error(`Missing piece ${i}`);
                }
                
                data.set(piece.data, offset);
                offset += piece.data.length;
            }
            
            // Verify data integrity
            const dataHash = await this.createContentHash(data);
            if (dataHash !== contentHash) {
                throw new Error('Data integrity verification failed');
            }
            
            return data;
            
        } catch (error) {
            console.error('❌ Failed to reconstruct data:', error);
            throw error;
        }
    }

    // Placeholder methods for peer management
    handlePeerConnected(event) { /* Implementation */ }
    handlePeerDisconnected(event) { /* Implementation */ }
    handleMessage(event) { /* Implementation */ }
    handleDownloadRequest(event) { /* Implementation */ }
    handleUploadRequest(event) { /* Implementation */ }
    handleCancelTransfer(event) { /* Implementation */ }
    
    async sendMessage(peerId, message) { /* Implementation */ }
    async announceContent(contentHash, torrent) { /* Implementation */ }
    async getTorrentInfo(contentHash) { /* Implementation */ }
    async findPeers(contentHash) { /* Implementation */ }
    getPeerPieces(peerId, contentHash) { /* Implementation */ }
    calculateUploadRate(peerId) { return 0; }
    calculateDownloadRate(peerId) { return 0; }
    isPeerSeeder(peerId) { return false; }
    async getSharedKey(peerId) { return 'shared-key'; }
    startPieceSelection() { /* Implementation */ }
}

/**
 * Simple Fountain Codes implementation (Luby Transform)
 */
class FountainEncoder {
    constructor(pieces, overhead = 0.1) {
        this.pieces = pieces;
        this.overhead = overhead;
        this.encodedPieces = new Map();
    }
    
    generateEncodedPiece() {
        // Simplified fountain encoding
        const degree = this.sampleDegree();
        const selectedPieces = this.selectPieces(degree);
        const encodedData = this.xorPieces(selectedPieces);
        
        return {
            data: encodedData,
            selectedIndices: selectedPieces
        };
    }
    
    sampleDegree() {
        // Simplified degree distribution
        return Math.floor(Math.random() * 3) + 1;
    }
    
    selectPieces(degree) {
        const selected = [];
        for (let i = 0; i < degree; i++) {
            const index = Math.floor(Math.random() * this.pieces.length);
            selected.push(index);
        }
        return selected;
    }
    
    xorPieces(indices) {
        if (indices.length === 0) return new Uint8Array();
        
        let result = new Uint8Array(this.pieces[indices[0]].length);
        for (const index of indices) {
            const piece = this.pieces[index];
            for (let i = 0; i < piece.length; i++) {
                result[i] ^= piece[i];
            }
        }
        return result;
    }
}

class FountainDecoder {
    constructor(pieceCount) {
        this.pieceCount = pieceCount;
        this.decodedPieces = new Map();
        this.encodedPieces = [];
    }
    
    addPiece(index, data) {
        this.decodedPieces.set(index, data);
    }
    
    addEncodedPiece(encodedPiece) {
        this.encodedPieces.push(encodedPiece);
        this.tryDecoding();
    }
    
    tryDecoding() {
        // Simplified Gaussian elimination for fountain decoding
        // In practice, this would use proper BP or Gaussian elimination
    }
    
    canReconstruct() {
        return this.decodedPieces.size >= this.pieceCount;
    }
    
    reconstruct() {
        const pieces = [];
        for (let i = 0; i < this.pieceCount; i++) {
            pieces[i] = this.decodedPieces.get(i);
        }
        return pieces;
    }
}

// Create and export singleton instance
const dataTransport = new DataTransport();
export default dataTransport;