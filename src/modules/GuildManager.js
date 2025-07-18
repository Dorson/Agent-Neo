/**
 * Guild Manager Module
 * 
 * Implements the guild system for collaborative task processing as described
 * in the Agent Neo whitepaper. Handles guild formation, membership management,
 * cryptographic voting, and collaborative task execution.
 * 
 * Features:
 * - Dynamic guild formation based on skill complementarity
 * - Cryptographic ring signatures for anonymous voting
 * - Trust-based reputation system
 * - Collaborative task bidding and execution
 * - Performance tracking and rewards distribution
 * - Guild governance and decision making
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';
import CryptoManager from '../core/CryptoManager.js';
import LocalLedger from '../core/LocalLedger.js';

class GuildManager {
    constructor() {
        this.initialized = false;
        this.cryptoManager = new CryptoManager();
        this.localLedger = new LocalLedger();
        
        // Guild storage
        this.guilds = new Map();
        this.memberships = new Map();
        this.invitations = new Map();
        this.proposals = new Map();
        
        // Configuration
        this.config = {
            minGuildSize: 3,
            maxGuildSize: 12,
            trustThreshold: 0.7,
            votingPeriod: 300000, // 5 minutes
            consensusThreshold: 0.67,
            reputationDecay: 0.95,
            maxActiveGuilds: 5
        };
        
        // Performance metrics
        this.metrics = {
            totalGuilds: 0,
            activeGuilds: 0,
            successfulTasks: 0,
            averagePerformance: 0,
            trustScore: 0
        };
        
        this.init();
    }

    async init() {
        try {
            console.log('🏛️ Guild Manager initializing...');
            
            // Load existing guilds from storage
            await this.loadGuilds();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Start monitoring
            this.startMonitoring();
            
            this.initialized = true;
            console.log('✅ Guild Manager initialized successfully');
            
        } catch (error) {
            console.error('❌ Guild Manager initialization failed:', error);
            throw error;
        }
    }

    async loadGuilds() {
        try {
            // Load guild data from IndexedDB
            const db = await this.openDatabase();
            const transaction = db.transaction(['guilds', 'memberships'], 'readonly');
            
            // Load guilds
            const guildsStore = transaction.objectStore('guilds');
            const guildsRequest = guildsStore.getAll();
            
            guildsRequest.onsuccess = () => {
                const guilds = guildsRequest.result;
                guilds.forEach(guild => {
                    this.guilds.set(guild.id, guild);
                });
                console.log(`📚 Loaded ${guilds.length} guilds from storage`);
            };
            
            // Load memberships
            const membershipsStore = transaction.objectStore('memberships');
            const membershipsRequest = membershipsStore.getAll();
            
            membershipsRequest.onsuccess = () => {
                const memberships = membershipsRequest.result;
                memberships.forEach(membership => {
                    if (!this.memberships.has(membership.guildId)) {
                        this.memberships.set(membership.guildId, new Set());
                    }
                    this.memberships.get(membership.guildId).add(membership.peerId);
                });
                console.log(`👥 Loaded ${memberships.length} memberships from storage`);
            };
            
        } catch (error) {
            console.error('❌ Failed to load guilds:', error);
        }
    }

    async openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AgentNeoGuilds', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Guilds store
                if (!db.objectStoreNames.contains('guilds')) {
                    const guildsStore = db.createObjectStore('guilds', { keyPath: 'id' });
                    guildsStore.createIndex('type', 'type', { unique: false });
                    guildsStore.createIndex('status', 'status', { unique: false });
                    guildsStore.createIndex('created', 'created', { unique: false });
                }
                
                // Memberships store
                if (!db.objectStoreNames.contains('memberships')) {
                    const membershipsStore = db.createObjectStore('memberships', { keyPath: ['guildId', 'peerId'] });
                    membershipsStore.createIndex('guildId', 'guildId', { unique: false });
                    membershipsStore.createIndex('peerId', 'peerId', { unique: false });
                }
                
                // Proposals store
                if (!db.objectStoreNames.contains('proposals')) {
                    const proposalsStore = db.createObjectStore('proposals', { keyPath: 'id' });
                    proposalsStore.createIndex('guildId', 'guildId', { unique: false });
                    proposalsStore.createIndex('status', 'status', { unique: false });
                    proposalsStore.createIndex('created', 'created', { unique: false });
                }
            };
        });
    }

    async createGuild(type, skills, description, initiatorPeerId) {
        try {
            const guildId = this.generateGuildId();
            const guild = {
                id: guildId,
                type,
                skills,
                description,
                initiator: initiatorPeerId,
                status: 'forming',
                created: Date.now(),
                members: new Set([initiatorPeerId]),
                reputation: 0,
                completedTasks: 0,
                totalEarnings: 0,
                governance: {
                    votingThreshold: this.config.consensusThreshold,
                    proposalPeriod: this.config.votingPeriod,
                    activeProposals: new Set()
                },
                performance: {
                    successRate: 0,
                    averageResponseTime: 0,
                    trustScore: 0
                }
            };
            
            // Store guild
            this.guilds.set(guildId, guild);
            this.memberships.set(guildId, new Set([initiatorPeerId]));
            
            // Persist to storage
            await this.saveGuild(guild);
            await this.saveMembership(guildId, initiatorPeerId);
            
            // Update metrics
            this.metrics.totalGuilds++;
            this.updateMetrics();
            
            // Emit events
            eventBus.emit('guild:created', {
                guildId,
                type,
                skills,
                initiator: initiatorPeerId
            });
            
            // Record in ledger
            await this.localLedger.addTransaction('GUILD_CREATED', initiatorPeerId, {
                guildId,
                type,
                skills,
                description
            });
            
            console.log(`🏛️ Created guild: ${guildId} (${type})`);
            return guild;
            
        } catch (error) {
            console.error('❌ Failed to create guild:', error);
            throw error;
        }
    }

    async inviteToGuild(guildId, targetPeerId, inviterPeerId) {
        try {
            const guild = this.guilds.get(guildId);
            if (!guild) {
                throw new Error('Guild not found');
            }
            
            // Check if inviter is a member
            if (!guild.members.has(inviterPeerId)) {
                throw new Error('Only guild members can invite others');
            }
            
            // Check if target is already a member
            if (guild.members.has(targetPeerId)) {
                throw new Error('Target is already a member');
            }
            
            // Check guild size limit
            if (guild.members.size >= this.config.maxGuildSize) {
                throw new Error('Guild is at maximum capacity');
            }
            
            // Create invitation
            const invitationId = this.generateInvitationId();
            const invitation = {
                id: invitationId,
                guildId,
                targetPeerId,
                inviterPeerId,
                created: Date.now(),
                status: 'pending',
                expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            };
            
            this.invitations.set(invitationId, invitation);
            
            // Emit event
            eventBus.emit('guild:invitation:sent', {
                invitationId,
                guildId,
                targetPeerId,
                inviterPeerId
            });
            
            console.log(`📨 Sent guild invitation: ${invitationId} to ${targetPeerId}`);
            return invitation;
            
        } catch (error) {
            console.error('❌ Failed to send guild invitation:', error);
            throw error;
        }
    }

    async acceptInvitation(invitationId, targetPeerId) {
        try {
            const invitation = this.invitations.get(invitationId);
            if (!invitation) {
                throw new Error('Invitation not found');
            }
            
            if (invitation.targetPeerId !== targetPeerId) {
                throw new Error('Invitation not for this peer');
            }
            
            if (invitation.status !== 'pending') {
                throw new Error('Invitation is not pending');
            }
            
            if (Date.now() > invitation.expiresAt) {
                throw new Error('Invitation has expired');
            }
            
            const guild = this.guilds.get(invitation.guildId);
            if (!guild) {
                throw new Error('Guild not found');
            }
            
            // Add member to guild
            guild.members.add(targetPeerId);
            this.memberships.get(invitation.guildId).add(targetPeerId);
            
            // Update invitation status
            invitation.status = 'accepted';
            invitation.acceptedAt = Date.now();
            
            // Persist changes
            await this.saveGuild(guild);
            await this.saveMembership(invitation.guildId, targetPeerId);
            
            // Emit events
            eventBus.emit('guild:member:joined', {
                guildId: invitation.guildId,
                peerId: targetPeerId,
                inviterPeerId: invitation.inviterPeerId
            });
            
            // Record in ledger
            await this.localLedger.addTransaction('GUILD_JOIN', targetPeerId, {
                guildId: invitation.guildId,
                inviterPeerId: invitation.inviterPeerId
            });
            
            console.log(`🎉 ${targetPeerId} joined guild: ${invitation.guildId}`);
            return guild;
            
        } catch (error) {
            console.error('❌ Failed to accept guild invitation:', error);
            throw error;
        }
    }

    async leaveGuild(guildId, peerId) {
        try {
            const guild = this.guilds.get(guildId);
            if (!guild) {
                throw new Error('Guild not found');
            }
            
            if (!guild.members.has(peerId)) {
                throw new Error('Not a member of this guild');
            }
            
            // Remove member
            guild.members.delete(peerId);
            this.memberships.get(guildId).delete(peerId);
            
            // Check if guild should be dissolved
            if (guild.members.size < this.config.minGuildSize) {
                await this.dissolveGuild(guildId, 'insufficient_members');
            } else {
                // Update guild
                await this.saveGuild(guild);
                await this.removeMembership(guildId, peerId);
            }
            
            // Emit events
            eventBus.emit('guild:member:left', {
                guildId,
                peerId
            });
            
            // Record in ledger
            await this.localLedger.addTransaction('GUILD_LEAVE', peerId, {
                guildId
            });
            
            console.log(`👋 ${peerId} left guild: ${guildId}`);
            
        } catch (error) {
            console.error('❌ Failed to leave guild:', error);
            throw error;
        }
    }

    async dissolveGuild(guildId, reason) {
        try {
            const guild = this.guilds.get(guildId);
            if (!guild) {
                throw new Error('Guild not found');
            }
            
            // Update guild status
            guild.status = 'dissolved';
            guild.dissolvedAt = Date.now();
            guild.dissolveReason = reason;
            
            // Remove all memberships
            for (const peerId of guild.members) {
                await this.removeMembership(guildId, peerId);
            }
            
            // Clean up
            this.memberships.delete(guildId);
            
            // Persist changes
            await this.saveGuild(guild);
            
            // Update metrics
            this.metrics.activeGuilds--;
            this.updateMetrics();
            
            // Emit event
            eventBus.emit('guild:dissolved', {
                guildId,
                reason,
                memberCount: guild.members.size
            });
            
            console.log(`💀 Dissolved guild: ${guildId} (${reason})`);
            
        } catch (error) {
            console.error('❌ Failed to dissolve guild:', error);
            throw error;
        }
    }

    async createProposal(guildId, proposerPeerId, type, title, description, data) {
        try {
            const guild = this.guilds.get(guildId);
            if (!guild) {
                throw new Error('Guild not found');
            }
            
            if (!guild.members.has(proposerPeerId)) {
                throw new Error('Only guild members can create proposals');
            }
            
            const proposalId = this.generateProposalId();
            const proposal = {
                id: proposalId,
                guildId,
                proposerPeerId,
                type,
                title,
                description,
                data,
                created: Date.now(),
                expiresAt: Date.now() + guild.governance.proposalPeriod,
                status: 'active',
                votes: new Map(),
                ringSignatures: [],
                result: null
            };
            
            this.proposals.set(proposalId, proposal);
            guild.governance.activeProposals.add(proposalId);
            
            // Persist proposal
            await this.saveProposal(proposal);
            
            // Emit event
            eventBus.emit('guild:proposal:created', {
                proposalId,
                guildId,
                type,
                title,
                proposerPeerId
            });
            
            console.log(`📋 Created proposal: ${proposalId} in guild ${guildId}`);
            return proposal;
            
        } catch (error) {
            console.error('❌ Failed to create proposal:', error);
            throw error;
        }
    }

    async voteOnProposal(proposalId, voterPeerId, vote, ringSignature) {
        try {
            const proposal = this.proposals.get(proposalId);
            if (!proposal) {
                throw new Error('Proposal not found');
            }
            
            if (proposal.status !== 'active') {
                throw new Error('Proposal is not active');
            }
            
            if (Date.now() > proposal.expiresAt) {
                throw new Error('Proposal has expired');
            }
            
            const guild = this.guilds.get(proposal.guildId);
            if (!guild || !guild.members.has(voterPeerId)) {
                throw new Error('Only guild members can vote');
            }
            
            // Verify ring signature
            const isValidSignature = await this.verifyRingSignature(
                ringSignature,
                Array.from(guild.members),
                `${proposalId}:${vote}`
            );
            
            if (!isValidSignature) {
                throw new Error('Invalid ring signature');
            }
            
            // Store vote (anonymous)
            proposal.votes.set(voterPeerId, vote);
            proposal.ringSignatures.push(ringSignature);
            
            // Check if voting is complete
            const totalVotes = proposal.votes.size;
            const requiredVotes = Math.ceil(guild.members.size * guild.governance.votingThreshold);
            
            if (totalVotes >= requiredVotes) {
                await this.finalizeProposal(proposalId);
            }
            
            // Emit event
            eventBus.emit('guild:proposal:vote', {
                proposalId,
                guildId: proposal.guildId,
                totalVotes,
                requiredVotes
            });
            
            console.log(`🗳️ Vote cast on proposal: ${proposalId}`);
            
        } catch (error) {
            console.error('❌ Failed to vote on proposal:', error);
            throw error;
        }
    }

    async finalizeProposal(proposalId) {
        try {
            const proposal = this.proposals.get(proposalId);
            if (!proposal) {
                throw new Error('Proposal not found');
            }
            
            // Count votes
            const votes = Array.from(proposal.votes.values());
            const yesVotes = votes.filter(vote => vote === 'yes').length;
            const noVotes = votes.filter(vote => vote === 'no').length;
            const abstainVotes = votes.filter(vote => vote === 'abstain').length;
            
            // Determine result
            const totalVotes = votes.length;
            const yesPercentage = yesVotes / totalVotes;
            const passed = yesPercentage >= this.config.consensusThreshold;
            
            // Update proposal
            proposal.status = 'finalized';
            proposal.finalizedAt = Date.now();
            proposal.result = {
                passed,
                yesVotes,
                noVotes,
                abstainVotes,
                totalVotes,
                yesPercentage
            };
            
            // Execute proposal if passed
            if (passed) {
                await this.executeProposal(proposal);
            }
            
            // Clean up
            const guild = this.guilds.get(proposal.guildId);
            if (guild) {
                guild.governance.activeProposals.delete(proposalId);
            }
            
            // Persist changes
            await this.saveProposal(proposal);
            
            // Emit event
            eventBus.emit('guild:proposal:finalized', {
                proposalId,
                guildId: proposal.guildId,
                passed,
                result: proposal.result
            });
            
            console.log(`✅ Finalized proposal: ${proposalId} (${passed ? 'PASSED' : 'FAILED'})`);
            
        } catch (error) {
            console.error('❌ Failed to finalize proposal:', error);
            throw error;
        }
    }

    async executeProposal(proposal) {
        try {
            const { type, data } = proposal;
            
            switch (type) {
                case 'member_removal':
                    await this.leaveGuild(proposal.guildId, data.targetPeerId);
                    break;
                    
                case 'governance_change':
                    await this.updateGuildGovernance(proposal.guildId, data.changes);
                    break;
                    
                case 'skill_update':
                    await this.updateGuildSkills(proposal.guildId, data.skills);
                    break;
                    
                case 'reward_distribution':
                    await this.distributeRewards(proposal.guildId, data.distribution);
                    break;
                    
                default:
                    console.warn(`Unknown proposal type: ${type}`);
            }
            
        } catch (error) {
            console.error('❌ Failed to execute proposal:', error);
            throw error;
        }
    }

    async verifyRingSignature(signature, memberPublicKeys, message) {
        try {
            // Simplified ring signature verification
            // In production, this would use a proper ring signature library
            return await this.cryptoManager.verifyBLS(message, signature, memberPublicKeys[0]);
            
        } catch (error) {
            console.error('❌ Ring signature verification failed:', error);
            return false;
        }
    }

    async bidOnTask(taskId, guildId, bidAmount, proposal) {
        try {
            const guild = this.guilds.get(guildId);
            if (!guild) {
                throw new Error('Guild not found');
            }
            
            if (guild.status !== 'active') {
                throw new Error('Guild is not active');
            }
            
            // Create guild bid
            const bid = {
                id: this.generateBidId(),
                taskId,
                guildId,
                bidAmount,
                proposal,
                created: Date.now(),
                status: 'submitted',
                memberCount: guild.members.size,
                reputation: guild.reputation,
                successRate: guild.performance.successRate,
                skills: guild.skills
            };
            
            // Emit event
            eventBus.emit('guild:bid:submitted', {
                bidId: bid.id,
                taskId,
                guildId,
                bidAmount,
                reputation: guild.reputation
            });
            
            console.log(`💰 Guild ${guildId} bid on task: ${taskId}`);
            return bid;
            
        } catch (error) {
            console.error('❌ Failed to submit guild bid:', error);
            throw error;
        }
    }

    // Storage methods
    async saveGuild(guild) {
        const db = await this.openDatabase();
        const transaction = db.transaction(['guilds'], 'readwrite');
        const store = transaction.objectStore('guilds');
        
        // Convert Set to Array for storage
        const guildData = {
            ...guild,
            members: Array.from(guild.members),
            governance: {
                ...guild.governance,
                activeProposals: Array.from(guild.governance.activeProposals)
            }
        };
        
        return new Promise((resolve, reject) => {
            const request = store.put(guildData);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async saveMembership(guildId, peerId) {
        const db = await this.openDatabase();
        const transaction = db.transaction(['memberships'], 'readwrite');
        const store = transaction.objectStore('memberships');
        
        return new Promise((resolve, reject) => {
            const request = store.put({ guildId, peerId, joined: Date.now() });
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async removeMembership(guildId, peerId) {
        const db = await this.openDatabase();
        const transaction = db.transaction(['memberships'], 'readwrite');
        const store = transaction.objectStore('memberships');
        
        return new Promise((resolve, reject) => {
            const request = store.delete([guildId, peerId]);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async saveProposal(proposal) {
        const db = await this.openDatabase();
        const transaction = db.transaction(['proposals'], 'readwrite');
        const store = transaction.objectStore('proposals');
        
        // Convert Map to Object for storage
        const proposalData = {
            ...proposal,
            votes: Object.fromEntries(proposal.votes)
        };
        
        return new Promise((resolve, reject) => {
            const request = store.put(proposalData);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    // Utility methods
    generateGuildId() {
        return `guild_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateInvitationId() {
        return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateProposalId() {
        return `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateBidId() {
        return `bid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    setupEventListeners() {
        // Listen for trust updates
        eventBus.on('trust:update', (data) => {
            this.updateGuildTrust(data.peerId, data.trustScore);
        });
        
        // Listen for task completions
        eventBus.on('task:completed', (data) => {
            this.updateGuildPerformance(data.guildId, data.success, data.responseTime);
        });
        
        // Listen for peer disconnections
        eventBus.on('p2p:peer:disconnected', (data) => {
            this.handlePeerDisconnection(data.peerId);
        });
    }

    startMonitoring() {
        // Monitor guild health and performance
        setInterval(() => {
            this.updateMetrics();
            this.cleanupExpiredProposals();
            this.cleanupExpiredInvitations();
        }, 60000); // Every minute
    }

    updateMetrics() {
        this.metrics.totalGuilds = this.guilds.size;
        this.metrics.activeGuilds = Array.from(this.guilds.values())
            .filter(guild => guild.status === 'active').length;
        
        stateManager.setState('guilds.metrics', this.metrics);
        eventBus.emit('guild:metrics:updated', this.metrics);
    }

    cleanupExpiredProposals() {
        const now = Date.now();
        for (const [proposalId, proposal] of this.proposals) {
            if (proposal.status === 'active' && now > proposal.expiresAt) {
                this.finalizeProposal(proposalId);
            }
        }
    }

    cleanupExpiredInvitations() {
        const now = Date.now();
        for (const [invitationId, invitation] of this.invitations) {
            if (invitation.status === 'pending' && now > invitation.expiresAt) {
                invitation.status = 'expired';
                console.log(`⏰ Invitation expired: ${invitationId}`);
            }
        }
    }

    updateGuildTrust(peerId, trustScore) {
        // Update trust scores for guilds containing this peer
        for (const [guildId, guild] of this.guilds) {
            if (guild.members.has(peerId)) {
                // Recalculate guild trust score
                const memberTrustScores = Array.from(guild.members).map(id => 
                    id === peerId ? trustScore : this.getPeerTrustScore(id)
                );
                
                guild.performance.trustScore = memberTrustScores.reduce((a, b) => a + b, 0) / memberTrustScores.length;
            }
        }
    }

    updateGuildPerformance(guildId, success, responseTime) {
        const guild = this.guilds.get(guildId);
        if (!guild) return;
        
        guild.completedTasks++;
        
        // Update success rate
        const previousSuccesses = guild.performance.successRate * (guild.completedTasks - 1);
        guild.performance.successRate = (previousSuccesses + (success ? 1 : 0)) / guild.completedTasks;
        
        // Update average response time
        const previousAverage = guild.performance.averageResponseTime * (guild.completedTasks - 1);
        guild.performance.averageResponseTime = (previousAverage + responseTime) / guild.completedTasks;
        
        // Update reputation
        if (success) {
            guild.reputation += 1;
        } else {
            guild.reputation = Math.max(0, guild.reputation - 2);
        }
        
        this.saveGuild(guild);
    }

    getPeerTrustScore(peerId) {
        // Get trust score from state manager or default
        return stateManager.getState(`trust.${peerId}`) || 0.5;
    }

    handlePeerDisconnection(peerId) {
        // Handle peer disconnection - check if any guilds need attention
        for (const [guildId, guild] of this.guilds) {
            if (guild.members.has(peerId)) {
                console.log(`⚠️ Guild member ${peerId} disconnected from guild ${guildId}`);
                // Could implement grace period or automatic removal
            }
        }
    }

    // Getters
    getGuild(guildId) {
        return this.guilds.get(guildId);
    }

    getGuildsByMember(peerId) {
        return Array.from(this.guilds.values()).filter(guild => guild.members.has(peerId));
    }

    getActiveGuilds() {
        return Array.from(this.guilds.values()).filter(guild => guild.status === 'active');
    }

    getGuildMetrics() {
        return { ...this.metrics };
    }
}

export default GuildManager;