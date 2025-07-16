/**
 * Consensus Manager
 * 
 * Provides distributed consensus mechanisms for the decentralized network:
 * - Byzantine Fault Tolerance (BFT) consensus
 * - Leader election and rotation
 * - Distributed voting and decision making
 * - Conflict resolution and consistency
 * - Network-wide state synchronization
 * - Proof of stake and reputation systems
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class ConsensusManager {
    constructor() {
        this.name = 'ConsensusManager';
        this.version = '1.0.0';
        this.isRunning = false;
        
        // Node identity and network state
        this.nodeId = null;
        this.nodeRoles = new Set(['participant']); // participant, validator, leader
        this.networkNodes = new Map();
        this.trustedNodes = new Set();
        this.blacklistedNodes = new Set();
        
        // Consensus state
        this.currentRound = 0;
        this.currentLeader = null;
        this.proposals = new Map();
        this.votes = new Map();
        this.commitments = new Map();
        this.decisions = new Map();
        
        // Configuration
        this.config = {
            consensusAlgorithm: 'pbft',        // pbft, raft, pow, pos
            faultTolerance: 1/3,               // Byzantine fault tolerance
            minParticipants: 3,
            maxParticipants: 100,
            roundTimeout: 30000,               // 30 seconds
            leaderElectionTimeout: 10000,      // 10 seconds
            votingThreshold: 0.67,             // 2/3 majority
            reputationEnabled: true,
            stakeBasedVoting: false,
            enableCrypto: true,
            messageSigning: true,
            networkSyncInterval: 5000,         // 5 seconds
            consensusHistory: 1000             // Keep last 1000 decisions
        };
        
        // Reputation system
        this.reputation = {
            scores: new Map(),
            history: new Map(),
            penalties: new Map(),
            rewards: new Map(),
            totalStake: 0,
            stakes: new Map()
        };
        
        // Message queues
        this.messageQueue = [];
        this.pendingMessages = new Map();
        this.broadcastQueue = [];
        
        // Timers
        this.roundTimer = null;
        this.leaderElectionTimer = null;
        this.syncTimer = null;
        
        // Metrics
        this.metrics = {
            roundsCompleted: 0,
            decisionsReached: 0,
            consensusFailures: 0,
            averageDecisionTime: 0,
            networkPartitions: 0,
            byzantineFaults: 0,
            leaderChanges: 0
        };
        
        this.init();
    }
    
    async init() {
        console.log(`🗳️  Initializing ${this.name} v${this.version}`);
        
        // Generate or load node identity
        await this.initializeNodeIdentity();
        
        // Load configuration
        await this.loadConfiguration();
        
        // Initialize cryptographic components
        await this.initializeCrypto();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start consensus services
        await this.startConsensus();
        
        this.isRunning = true;
        
        eventBus.emit('consensus-manager:initialized', {
            nodeId: this.nodeId,
            version: this.version,
            config: this.config,
            roles: Array.from(this.nodeRoles)
        });
    }
    
    async initializeNodeIdentity() {
        try {
            // Try to load existing identity
            this.nodeId = await stateManager.getState('consensus.nodeId');
            
            if (!this.nodeId) {
                // Generate new identity
                this.nodeId = await this.generateNodeId();
                await stateManager.setState('consensus.nodeId', this.nodeId);
            }
            
            // Load node roles
            const savedRoles = await stateManager.getState('consensus.nodeRoles');
            if (savedRoles) {
                this.nodeRoles = new Set(savedRoles);
            }
            
            console.log(`📋 Node identity initialized: ${this.nodeId}`);
            
        } catch (error) {
            console.error('Failed to initialize node identity:', error);
            throw error;
        }
    }
    
    async generateNodeId() {
        // Generate unique node identifier
        const randomBytes = new Uint8Array(32);
        crypto.getRandomValues(randomBytes);
        
        const hashBuffer = await crypto.subtle.digest('SHA-256', randomBytes);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }
    
    async loadConfiguration() {
        try {
            const savedConfig = await stateManager.getState('consensusManager.config');
            if (savedConfig) {
                this.config = { ...this.config, ...savedConfig };
            }
            
            // Load reputation data
            const savedReputation = await stateManager.getState('consensus.reputation');
            if (savedReputation) {
                this.reputation.scores = new Map(savedReputation.scores);
                this.reputation.history = new Map(savedReputation.history);
                this.reputation.totalStake = savedReputation.totalStake || 0;
                this.reputation.stakes = new Map(savedReputation.stakes);
            }
            
        } catch (error) {
            console.warn('Failed to load consensus configuration:', error);
        }
    }
    
    async initializeCrypto() {
        if (!this.config.enableCrypto) return;
        
        try {
            // Generate key pair for message signing
            this.keyPair = await crypto.subtle.generateKey(
                {
                    name: 'ECDSA',
                    namedCurve: 'P-256'
                },
                true,
                ['sign', 'verify']
            );
            
            // Export public key for sharing
            this.publicKey = await crypto.subtle.exportKey('raw', this.keyPair.publicKey);
            
            console.log('✅ Cryptographic components initialized');
            
        } catch (error) {
            console.error('Failed to initialize crypto:', error);
            this.config.enableCrypto = false;
        }
    }
    
    setupEventListeners() {
        // Network events
        eventBus.on('network:peer-connected', (data) => this.handlePeerConnected(data));
        eventBus.on('network:peer-disconnected', (data) => this.handlePeerDisconnected(data));
        eventBus.on('network:message-received', (data) => this.handleNetworkMessage(data));
        
        // Consensus events
        eventBus.on('consensus-manager:propose', (data) => this.propose(data));
        eventBus.on('consensus-manager:vote', (data) => this.vote(data));
        eventBus.on('consensus-manager:join-network', (data) => this.joinNetwork(data));
        eventBus.on('consensus-manager:leave-network', () => this.leaveNetwork());
        
        // Management events
        eventBus.on('consensus-manager:configure', (config) => this.configure(config));
        eventBus.on('consensus-manager:get-status', () => this.getStatus());
        eventBus.on('consensus-manager:force-leader-election', () => this.forceLeaderElection());
    }
    
    async startConsensus() {
        console.log('🗳️  Starting consensus services');
        
        // Start network synchronization
        this.syncTimer = setInterval(() => {
            this.syncNetworkState();
        }, this.config.networkSyncInterval);
        
        // Initialize reputation scores
        this.initializeReputationScores();
        
        // Start leader election if network is ready
        if (this.networkNodes.size >= this.config.minParticipants) {
            await this.startLeaderElection();
        }
        
        eventBus.emit('consensus-manager:started', {
            nodeId: this.nodeId,
            networkSize: this.networkNodes.size
        });
    }
    
    async propose(request) {
        const { id, type, data, priority = 'normal' } = request;
        
        try {
            // Validate proposal
            if (!this.canPropose()) {
                throw new Error('Node cannot propose at this time');
            }
            
            const proposal = {
                id: id || this.generateProposalId(),
                type,
                data,
                priority,
                proposer: this.nodeId,
                timestamp: Date.now(),
                round: this.currentRound,
                signature: null
            };
            
            // Sign proposal if crypto is enabled
            if (this.config.enableCrypto && this.config.messageSigning) {
                proposal.signature = await this.signMessage(proposal);
            }
            
            // Store proposal
            this.proposals.set(proposal.id, proposal);
            
            // Broadcast to network
            await this.broadcastMessage({
                type: 'consensus:proposal',
                payload: proposal
            });
            
            // Start voting timer
            this.startVotingRound(proposal.id);
            
            console.log(`📋 Proposal submitted: ${proposal.id} (${type})`);
            
            eventBus.emit('consensus-manager:proposal-submitted', {
                proposalId: proposal.id,
                type,
                proposer: this.nodeId
            });
            
            return proposal.id;
            
        } catch (error) {
            console.error('Failed to submit proposal:', error);
            eventBus.emit('consensus-manager:proposal-failed', {
                proposalId: id,
                error: error.message
            });
            throw error;
        }
    }
    
    async vote(request) {
        const { proposalId, vote, reason = null } = request;
        
        try {
            // Validate vote
            if (!this.canVote(proposalId)) {
                throw new Error('Node cannot vote on this proposal');
            }
            
            const proposal = this.proposals.get(proposalId);
            if (!proposal) {
                throw new Error(`Proposal not found: ${proposalId}`);
            }
            
            const voteRecord = {
                proposalId,
                voter: this.nodeId,
                vote,
                reason,
                timestamp: Date.now(),
                round: this.currentRound,
                weight: this.calculateVoteWeight(this.nodeId),
                signature: null
            };
            
            // Sign vote if crypto is enabled
            if (this.config.enableCrypto && this.config.messageSigning) {
                voteRecord.signature = await this.signMessage(voteRecord);
            }
            
            // Store vote
            if (!this.votes.has(proposalId)) {
                this.votes.set(proposalId, new Map());
            }
            this.votes.get(proposalId).set(this.nodeId, voteRecord);
            
            // Broadcast vote
            await this.broadcastMessage({
                type: 'consensus:vote',
                payload: voteRecord
            });
            
            // Check if consensus is reached
            await this.checkConsensus(proposalId);
            
            console.log(`🗳️  Vote cast: ${proposalId} (${vote})`);
            
            eventBus.emit('consensus-manager:vote-cast', {
                proposalId,
                voter: this.nodeId,
                vote
            });
            
            return voteRecord;
            
        } catch (error) {
            console.error('Failed to cast vote:', error);
            eventBus.emit('consensus-manager:vote-failed', {
                proposalId,
                error: error.message
            });
            throw error;
        }
    }
    
    async checkConsensus(proposalId) {
        const proposal = this.proposals.get(proposalId);
        const votes = this.votes.get(proposalId);
        
        if (!proposal || !votes) return;
        
        // Calculate vote tallies
        const tally = this.calculateVoteTally(votes);
        const totalWeight = this.calculateTotalVoteWeight();
        
        // Check for consensus
        const consensusThreshold = totalWeight * this.config.votingThreshold;
        const approved = tally.approve > consensusThreshold;
        const rejected = tally.reject > consensusThreshold;
        
        if (approved || rejected) {
            const decision = {
                proposalId,
                decision: approved ? 'approved' : 'rejected',
                votes: tally,
                totalWeight,
                threshold: consensusThreshold,
                timestamp: Date.now(),
                round: this.currentRound,
                participants: Array.from(votes.keys())
            };
            
            // Store decision
            this.decisions.set(proposalId, decision);
            
            // Execute decision if approved
            if (approved) {
                await this.executeDecision(proposal, decision);
            }
            
            // Update metrics
            this.metrics.decisionsReached++;
            this.metrics.roundsCompleted++;
            
            // Update reputation scores
            this.updateReputationScores(proposalId, decision);
            
            console.log(`✅ Consensus reached: ${proposalId} (${decision.decision})`);
            
            eventBus.emit('consensus-manager:consensus-reached', {
                proposalId,
                decision: decision.decision,
                votes: tally
            });
            
            // Clean up
            this.cleanupProposal(proposalId);
            
            return decision;
        }
        
        return null;
    }
    
    async executeDecision(proposal, decision) {
        try {
            console.log(`⚡ Executing decision: ${proposal.id} (${proposal.type})`);
            
            // Execute based on proposal type
            switch (proposal.type) {
                case 'network:config':
                    await this.executeNetworkConfig(proposal.data);
                    break;
                case 'node:admission':
                    await this.executeNodeAdmission(proposal.data);
                    break;
                case 'node:removal':
                    await this.executeNodeRemoval(proposal.data);
                    break;
                case 'data:update':
                    await this.executeDataUpdate(proposal.data);
                    break;
                case 'leader:election':
                    await this.executeLeaderElection(proposal.data);
                    break;
                default:
                    console.warn(`Unknown proposal type: ${proposal.type}`);
            }
            
            eventBus.emit('consensus-manager:decision-executed', {
                proposalId: proposal.id,
                type: proposal.type,
                data: proposal.data
            });
            
        } catch (error) {
            console.error('Failed to execute decision:', error);
            eventBus.emit('consensus-manager:execution-failed', {
                proposalId: proposal.id,
                error: error.message
            });
        }
    }
    
    async startLeaderElection() {
        if (this.leaderElectionTimer) {
            clearTimeout(this.leaderElectionTimer);
        }
        
        console.log('🗳️  Starting leader election');
        
        const candidates = this.getLeaderCandidates();
        
        if (candidates.length === 0) {
            console.warn('No valid leader candidates');
            return;
        }
        
        // Select leader based on algorithm
        let newLeader = null;
        
        switch (this.config.consensusAlgorithm) {
            case 'pbft':
                newLeader = this.selectLeaderByReputation(candidates);
                break;
            case 'raft':
                newLeader = this.selectLeaderByElection(candidates);
                break;
            case 'pos':
                newLeader = this.selectLeaderByStake(candidates);
                break;
            default:
                newLeader = this.selectLeaderByRandom(candidates);
        }
        
        if (newLeader && newLeader !== this.currentLeader) {
            await this.electLeader(newLeader);
        }
        
        // Schedule next election
        this.leaderElectionTimer = setTimeout(() => {
            this.startLeaderElection();
        }, this.config.leaderElectionTimeout * 10); // Elections every 10 intervals
    }
    
    async electLeader(leaderId) {
        const previousLeader = this.currentLeader;
        this.currentLeader = leaderId;
        
        // Update metrics
        if (previousLeader !== leaderId) {
            this.metrics.leaderChanges++;
        }
        
        console.log(`👑 New leader elected: ${leaderId}`);
        
        // Broadcast leader change
        await this.broadcastMessage({
            type: 'consensus:leader-elected',
            payload: {
                leaderId,
                previousLeader,
                timestamp: Date.now(),
                round: this.currentRound
            }
        });
        
        // Update own role
        if (leaderId === this.nodeId) {
            this.nodeRoles.add('leader');
            console.log('🎉 This node is now the leader');
        } else {
            this.nodeRoles.delete('leader');
        }
        
        eventBus.emit('consensus-manager:leader-elected', {
            leaderId,
            previousLeader,
            isLeader: leaderId === this.nodeId
        });
    }
    
    getLeaderCandidates() {
        const candidates = [];
        
        for (const [nodeId, node] of this.networkNodes) {
            if (node.roles.has('validator') || node.roles.has('leader')) {
                // Check if node is eligible
                if (this.isNodeEligible(nodeId)) {
                    candidates.push(nodeId);
                }
            }
        }
        
        return candidates;
    }
    
    isNodeEligible(nodeId) {
        // Check reputation
        if (this.config.reputationEnabled) {
            const reputation = this.reputation.scores.get(nodeId) || 0;
            if (reputation < 0.5) return false;
        }
        
        // Check if blacklisted
        if (this.blacklistedNodes.has(nodeId)) {
            return false;
        }
        
        // Check if online
        const node = this.networkNodes.get(nodeId);
        if (!node || !node.online) {
            return false;
        }
        
        return true;
    }
    
    selectLeaderByReputation(candidates) {
        if (candidates.length === 0) return null;
        
        // Select candidate with highest reputation
        let bestCandidate = candidates[0];
        let bestScore = this.reputation.scores.get(bestCandidate) || 0;
        
        for (const candidate of candidates) {
            const score = this.reputation.scores.get(candidate) || 0;
            if (score > bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        }
        
        return bestCandidate;
    }
    
    selectLeaderByStake(candidates) {
        if (candidates.length === 0) return null;
        
        // Select candidate with highest stake
        let bestCandidate = candidates[0];
        let bestStake = this.reputation.stakes.get(bestCandidate) || 0;
        
        for (const candidate of candidates) {
            const stake = this.reputation.stakes.get(candidate) || 0;
            if (stake > bestStake) {
                bestStake = stake;
                bestCandidate = candidate;
            }
        }
        
        return bestCandidate;
    }
    
    selectLeaderByRandom(candidates) {
        if (candidates.length === 0) return null;
        
        const randomIndex = Math.floor(Math.random() * candidates.length);
        return candidates[randomIndex];
    }
    
    calculateVoteWeight(nodeId) {
        let weight = 1.0;
        
        // Reputation-based weighting
        if (this.config.reputationEnabled) {
            const reputation = this.reputation.scores.get(nodeId) || 0.5;
            weight *= reputation;
        }
        
        // Stake-based weighting
        if (this.config.stakeBasedVoting) {
            const stake = this.reputation.stakes.get(nodeId) || 0;
            const totalStake = this.reputation.totalStake || 1;
            weight *= (stake / totalStake);
        }
        
        return weight;
    }
    
    calculateVoteTally(votes) {
        const tally = {
            approve: 0,
            reject: 0,
            abstain: 0
        };
        
        for (const [nodeId, voteRecord] of votes) {
            const weight = voteRecord.weight || 1;
            tally[voteRecord.vote] += weight;
        }
        
        return tally;
    }
    
    calculateTotalVoteWeight() {
        let totalWeight = 0;
        
        for (const [nodeId, node] of this.networkNodes) {
            if (node.online) {
                totalWeight += this.calculateVoteWeight(nodeId);
            }
        }
        
        return totalWeight;
    }
    
    updateReputationScores(proposalId, decision) {
        if (!this.config.reputationEnabled) return;
        
        const votes = this.votes.get(proposalId);
        if (!votes) return;
        
        const correctVote = decision.decision === 'approved' ? 'approve' : 'reject';
        
        for (const [nodeId, voteRecord] of votes) {
            let currentScore = this.reputation.scores.get(nodeId) || 0.5;
            
            if (voteRecord.vote === correctVote) {
                // Reward correct vote
                currentScore += 0.01;
                currentScore = Math.min(1.0, currentScore);
            } else {
                // Penalize incorrect vote
                currentScore -= 0.005;
                currentScore = Math.max(0.0, currentScore);
            }
            
            this.reputation.scores.set(nodeId, currentScore);
        }
        
        // Save reputation data
        this.saveReputationData();
    }
    
    async saveReputationData() {
        const reputationData = {
            scores: Array.from(this.reputation.scores.entries()),
            history: Array.from(this.reputation.history.entries()),
            totalStake: this.reputation.totalStake,
            stakes: Array.from(this.reputation.stakes.entries())
        };
        
        await stateManager.setState('consensus.reputation', reputationData);
    }
    
    initializeReputationScores() {
        // Initialize reputation scores for all known nodes
        for (const [nodeId, node] of this.networkNodes) {
            if (!this.reputation.scores.has(nodeId)) {
                this.reputation.scores.set(nodeId, 0.5); // Start with neutral reputation
            }
        }
    }
    
    // Network message handlers
    async handleNetworkMessage(data) {
        const { senderId, message } = data;
        
        if (!this.isValidMessage(message, senderId)) {
            console.warn('Invalid consensus message received');
            return;
        }
        
        switch (message.type) {
            case 'consensus:proposal':
                await this.handleProposalMessage(message.payload, senderId);
                break;
            case 'consensus:vote':
                await this.handleVoteMessage(message.payload, senderId);
                break;
            case 'consensus:leader-elected':
                await this.handleLeaderElectedMessage(message.payload, senderId);
                break;
            case 'consensus:sync-request':
                await this.handleSyncRequest(message.payload, senderId);
                break;
            case 'consensus:sync-response':
                await this.handleSyncResponse(message.payload, senderId);
                break;
            default:
                console.warn(`Unknown consensus message type: ${message.type}`);
        }
    }
    
    async handleProposalMessage(proposal, senderId) {
        // Validate proposal
        if (!this.isValidProposal(proposal, senderId)) {
            console.warn('Invalid proposal received');
            return;
        }
        
        // Store proposal
        this.proposals.set(proposal.id, proposal);
        
        // Auto-vote if configured
        if (this.shouldAutoVote(proposal)) {
            const vote = this.calculateAutoVote(proposal);
            await this.vote({ proposalId: proposal.id, vote, reason: 'auto-vote' });
        }
        
        eventBus.emit('consensus-manager:proposal-received', {
            proposalId: proposal.id,
            proposer: senderId,
            type: proposal.type
        });
    }
    
    async handleVoteMessage(voteRecord, senderId) {
        // Validate vote
        if (!this.isValidVote(voteRecord, senderId)) {
            console.warn('Invalid vote received');
            return;
        }
        
        // Store vote
        if (!this.votes.has(voteRecord.proposalId)) {
            this.votes.set(voteRecord.proposalId, new Map());
        }
        this.votes.get(voteRecord.proposalId).set(senderId, voteRecord);
        
        // Check consensus
        await this.checkConsensus(voteRecord.proposalId);
        
        eventBus.emit('consensus-manager:vote-received', {
            proposalId: voteRecord.proposalId,
            voter: senderId,
            vote: voteRecord.vote
        });
    }
    
    async handleLeaderElectedMessage(leaderData, senderId) {
        if (leaderData.leaderId && leaderData.leaderId !== this.currentLeader) {
            this.currentLeader = leaderData.leaderId;
            
            // Update role
            if (leaderData.leaderId === this.nodeId) {
                this.nodeRoles.add('leader');
            } else {
                this.nodeRoles.delete('leader');
            }
            
            eventBus.emit('consensus-manager:leader-changed', {
                leaderId: leaderData.leaderId,
                previousLeader: leaderData.previousLeader
            });
        }
    }
    
    // Message validation
    isValidMessage(message, senderId) {
        if (!message || !message.type) return false;
        
        // Check if sender is known
        if (!this.networkNodes.has(senderId)) return false;
        
        // Check if sender is blacklisted
        if (this.blacklistedNodes.has(senderId)) return false;
        
        // Verify signature if crypto is enabled
        if (this.config.enableCrypto && this.config.messageSigning) {
            return this.verifyMessageSignature(message, senderId);
        }
        
        return true;
    }
    
    isValidProposal(proposal, senderId) {
        if (!proposal || !proposal.id || !proposal.type) return false;
        
        // Check if proposal already exists
        if (this.proposals.has(proposal.id)) return false;
        
        // Check if sender can propose
        if (!this.canNodePropose(senderId)) return false;
        
        return true;
    }
    
    isValidVote(voteRecord, senderId) {
        if (!voteRecord || !voteRecord.proposalId || !voteRecord.vote) return false;
        
        // Check if proposal exists
        if (!this.proposals.has(voteRecord.proposalId)) return false;
        
        // Check if voter can vote
        if (!this.canNodeVote(senderId, voteRecord.proposalId)) return false;
        
        // Check if vote is valid
        if (!['approve', 'reject', 'abstain'].includes(voteRecord.vote)) return false;
        
        return true;
    }
    
    canPropose() {
        // Check if node can propose
        if (this.blacklistedNodes.has(this.nodeId)) return false;
        
        // Check reputation
        if (this.config.reputationEnabled) {
            const reputation = this.reputation.scores.get(this.nodeId) || 0.5;
            if (reputation < 0.3) return false;
        }
        
        // Check network size
        if (this.networkNodes.size < this.config.minParticipants) return false;
        
        return true;
    }
    
    canVote(proposalId) {
        // Check if node can vote
        if (this.blacklistedNodes.has(this.nodeId)) return false;
        
        // Check if already voted
        const votes = this.votes.get(proposalId);
        if (votes && votes.has(this.nodeId)) return false;
        
        return true;
    }
    
    canNodePropose(nodeId) {
        // Similar checks for other nodes
        if (this.blacklistedNodes.has(nodeId)) return false;
        
        const node = this.networkNodes.get(nodeId);
        if (!node || !node.online) return false;
        
        return true;
    }
    
    canNodeVote(nodeId, proposalId) {
        // Similar checks for other nodes
        if (this.blacklistedNodes.has(nodeId)) return false;
        
        const node = this.networkNodes.get(nodeId);
        if (!node || !node.online) return false;
        
        const votes = this.votes.get(proposalId);
        if (votes && votes.has(nodeId)) return false;
        
        return true;
    }
    
    // Utility methods
    generateProposalId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `${this.nodeId}-${timestamp}-${random}`;
    }
    
    async signMessage(message) {
        if (!this.config.enableCrypto || !this.keyPair) return null;
        
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(message));
        
        const signature = await crypto.subtle.sign(
            {
                name: 'ECDSA',
                hash: { name: 'SHA-256' }
            },
            this.keyPair.privateKey,
            data
        );
        
        return Array.from(new Uint8Array(signature));
    }
    
    async verifyMessageSignature(message, senderId) {
        if (!this.config.enableCrypto) return true;
        
        // Get sender's public key
        const node = this.networkNodes.get(senderId);
        if (!node || !node.publicKey) return false;
        
        try {
            const publicKey = await crypto.subtle.importKey(
                'raw',
                new Uint8Array(node.publicKey),
                {
                    name: 'ECDSA',
                    namedCurve: 'P-256'
                },
                false,
                ['verify']
            );
            
            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify(message));
            
            const isValid = await crypto.subtle.verify(
                {
                    name: 'ECDSA',
                    hash: { name: 'SHA-256' }
                },
                publicKey,
                new Uint8Array(message.signature),
                data
            );
            
            return isValid;
            
        } catch (error) {
            console.error('Signature verification failed:', error);
            return false;
        }
    }
    
    async broadcastMessage(message) {
        // Add to broadcast queue
        this.broadcastQueue.push(message);
        
        // Emit to network
        eventBus.emit('network:broadcast', {
            type: 'consensus',
            message,
            senderId: this.nodeId
        });
    }
    
    startVotingRound(proposalId) {
        // Set timeout for voting
        setTimeout(() => {
            this.finalizeVoting(proposalId);
        }, this.config.roundTimeout);
    }
    
    async finalizeVoting(proposalId) {
        const decision = await this.checkConsensus(proposalId);
        
        if (!decision) {
            // No consensus reached
            console.log(`⏰ Voting timeout for proposal: ${proposalId}`);
            
            this.metrics.consensusFailures++;
            
            eventBus.emit('consensus-manager:voting-timeout', {
                proposalId,
                votes: this.votes.get(proposalId)?.size || 0
            });
            
            // Clean up
            this.cleanupProposal(proposalId);
        }
    }
    
    cleanupProposal(proposalId) {
        // Remove old proposals and votes
        this.proposals.delete(proposalId);
        this.votes.delete(proposalId);
        
        // Keep decisions for history
        setTimeout(() => {
            this.decisions.delete(proposalId);
        }, this.config.consensusHistory * 1000);
    }
    
    async syncNetworkState() {
        // Sync network state with peers
        const syncMessage = {
            type: 'consensus:sync-request',
            payload: {
                nodeId: this.nodeId,
                currentRound: this.currentRound,
                currentLeader: this.currentLeader,
                timestamp: Date.now()
            }
        };
        
        await this.broadcastMessage(syncMessage);
    }
    
    // Event handlers
    handlePeerConnected(data) {
        const { peerId, peerInfo } = data;
        
        // Add to network nodes
        this.networkNodes.set(peerId, {
            id: peerId,
            info: peerInfo,
            online: true,
            roles: new Set(['participant']),
            publicKey: peerInfo.publicKey || null,
            joinedAt: Date.now()
        });
        
        // Initialize reputation
        if (!this.reputation.scores.has(peerId)) {
            this.reputation.scores.set(peerId, 0.5);
        }
        
        // Check if we need to start leader election
        if (this.networkNodes.size >= this.config.minParticipants && !this.currentLeader) {
            this.startLeaderElection();
        }
        
        eventBus.emit('consensus-manager:peer-joined', {
            peerId,
            networkSize: this.networkNodes.size
        });
    }
    
    handlePeerDisconnected(data) {
        const { peerId } = data;
        
        // Update node status
        const node = this.networkNodes.get(peerId);
        if (node) {
            node.online = false;
        }
        
        // If leader disconnected, start new election
        if (peerId === this.currentLeader) {
            this.currentLeader = null;
            this.startLeaderElection();
        }
        
        eventBus.emit('consensus-manager:peer-left', {
            peerId,
            networkSize: this.networkNodes.size
        });
    }
    
    // Configuration and management
    async configure(newConfig) {
        this.config = { ...this.config, ...newConfig };
        await stateManager.setState('consensusManager.config', this.config);
        
        eventBus.emit('consensus-manager:configured', { config: this.config });
    }
    
    async forceLeaderElection() {
        this.currentLeader = null;
        await this.startLeaderElection();
    }
    
    async joinNetwork(networkInfo) {
        // Join consensus network
        console.log('🔗 Joining consensus network');
        
        // Add validator role
        this.nodeRoles.add('validator');
        
        // Save roles
        await stateManager.setState('consensus.nodeRoles', Array.from(this.nodeRoles));
        
        eventBus.emit('consensus-manager:network-joined', {
            nodeId: this.nodeId,
            roles: Array.from(this.nodeRoles)
        });
    }
    
    async leaveNetwork() {
        // Leave consensus network
        console.log('🔗 Leaving consensus network');
        
        // Remove roles
        this.nodeRoles.clear();
        this.nodeRoles.add('participant');
        
        // Clear timers
        if (this.roundTimer) clearTimeout(this.roundTimer);
        if (this.leaderElectionTimer) clearTimeout(this.leaderElectionTimer);
        if (this.syncTimer) clearInterval(this.syncTimer);
        
        eventBus.emit('consensus-manager:network-left', {
            nodeId: this.nodeId
        });
    }
    
    getStatus() {
        return {
            name: this.name,
            version: this.version,
            isRunning: this.isRunning,
            nodeId: this.nodeId,
            roles: Array.from(this.nodeRoles),
            config: this.config,
            network: {
                size: this.networkNodes.size,
                leader: this.currentLeader,
                round: this.currentRound,
                isLeader: this.currentLeader === this.nodeId
            },
            consensus: {
                activeProposals: this.proposals.size,
                pendingVotes: this.votes.size,
                decisions: this.decisions.size
            },
            reputation: {
                myScore: this.reputation.scores.get(this.nodeId) || 0.5,
                totalStake: this.reputation.totalStake,
                myStake: this.reputation.stakes.get(this.nodeId) || 0
            },
            metrics: this.metrics
        };
    }
    
    async stop() {
        console.log('🛑 Stopping Consensus Manager');
        
        // Leave network
        await this.leaveNetwork();
        
        // Clear state
        this.proposals.clear();
        this.votes.clear();
        this.networkNodes.clear();
        
        this.isRunning = false;
        
        eventBus.emit('consensus-manager:stopped');
    }
}

export default ConsensusManager;