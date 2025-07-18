/**
 * Guild Membership Module
 * 
 * Manages guild membership, trust lists, and temporary banned lists
 * as specified in the Agent Neo implementation plan. Implements the
 * trust-based guild system with HIGH_TRUST and LOW_TRUST tiers.
 * 
 * Features:
 * - Dynamic trust list management
 * - Guild membership tracking
 * - Reputation scoring
 * - Temporary banning system
 * - Service request delays for trust levels
 */

import eventBus from '../../core/EventBus.js';
import { config } from '../../core/config.js';
import logger from '../../core/logger.js';

class GuildMembership {
    constructor() {
        this.name = 'GuildMembership';
        this.version = '1.0.0';
        this.initialized = false;
        
        // Trust lists
        this.highTrustMembers = new Map(); // DID -> { trustScore, joinedAt, lastActivity }
        this.lowTrustMembers = new Map();  // DID -> { trustScore, joinedAt, probationUntil }
        this.bannedMembers = new Map();    // DID -> { bannedAt, bannedUntil, reason }
        
        // Guild configuration from config
        this.guildConfig = config.guild;
        
        // Trust thresholds
        this.HIGH_TRUST_THRESHOLD = this.guildConfig.trustScoreThreshold; // 20
        this.MAX_HIGH_TRUST = 300;
        this.MAX_LOW_TRUST = this.guildConfig.lowTrustLimit; // 30
        this.MAX_BANNED = this.guildConfig.bannedListLimit; // 100
        
        // Service request delays
        this.serviceDelays = this.guildConfig.serviceRequestDelays;
        
        // Current guild ID
        this.currentGuildId = null;
        
        this.init();
    }

    async init() {
        try {
            console.log('🏰 Guild Membership initializing...');
            
            await this.loadMembershipData();
            this.setupEventListeners();
            this.startMaintenanceTasks();
            
            this.initialized = true;
            logger.info('Guild Membership initialized successfully');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version,
                capabilities: ['trust_management', 'membership_tracking', 'reputation_scoring']
            });
            
        } catch (error) {
            logger.error('Guild Membership initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        eventBus.on('guild:member_joined', this.onMemberJoined.bind(this));
        eventBus.on('guild:member_left', this.onMemberLeft.bind(this));
        eventBus.on('guild:trust_updated', this.onTrustUpdated.bind(this));
        eventBus.on('guild:ban_member', this.banMember.bind(this));
        eventBus.on('guild:unban_member', this.unbanMember.bind(this));
        eventBus.on('guild:get_trust_level', this.getTrustLevel.bind(this));
        eventBus.on('guild:get_service_delay', this.getServiceDelay.bind(this));
        eventBus.on('guild:promote_member', this.promoteMember.bind(this));
        eventBus.on('guild:demote_member', this.demoteMember.bind(this));
        eventBus.on('app:shutdown', this.saveMembershipData.bind(this));
    }

    async loadMembershipData() {
        try {
            // Load from IndexedDB if available
            const savedData = await this.loadFromStorage();
            
            if (savedData) {
                this.highTrustMembers = new Map(savedData.highTrust || []);
                this.lowTrustMembers = new Map(savedData.lowTrust || []);
                this.bannedMembers = new Map(savedData.banned || []);
                this.currentGuildId = savedData.currentGuildId;
                
                logger.info(`Loaded guild membership data: ${this.highTrustMembers.size} high trust, ${this.lowTrustMembers.size} low trust, ${this.bannedMembers.size} banned`);
            } else {
                logger.info('No existing guild membership data found');
            }
            
        } catch (error) {
            logger.warn('Failed to load guild membership data:', error);
        }
    }

    async saveMembershipData() {
        try {
            const data = {
                highTrust: Array.from(this.highTrustMembers.entries()),
                lowTrust: Array.from(this.lowTrustMembers.entries()),
                banned: Array.from(this.bannedMembers.entries()),
                currentGuildId: this.currentGuildId,
                lastSaved: Date.now()
            };
            
            await this.saveToStorage(data);
            logger.info('Guild membership data saved successfully');
            
        } catch (error) {
            logger.error('Failed to save guild membership data:', error);
        }
    }

    startMaintenanceTasks() {
        // Clean up expired bans every hour
        setInterval(() => {
            this.cleanupExpiredBans();
        }, 60 * 60 * 1000);
        
        // Save membership data every 5 minutes
        setInterval(() => {
            this.saveMembershipData();
        }, 5 * 60 * 1000);
        
        logger.info('Guild membership maintenance tasks started');
    }

    onMemberJoined(event) {
        const { did, guildId } = event.detail;
        
        // Set current guild if not set
        if (!this.currentGuildId) {
            this.currentGuildId = guildId;
        }
        
        // Add to low trust by default
        this.lowTrustMembers.set(did, {
            trustScore: 0,
            joinedAt: Date.now(),
            probationUntil: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days probation
        });
        
        logger.info(`Member ${did} joined guild ${guildId} as low trust`);
        eventBus.emit('guild:membership_updated', this.getMembershipStats());
    }

    onMemberLeft(event) {
        const { did } = event.detail;
        
        // Remove from all trust levels
        this.highTrustMembers.delete(did);
        this.lowTrustMembers.delete(did);
        
        logger.info(`Member ${did} left guild`);
        eventBus.emit('guild:membership_updated', this.getMembershipStats());
    }

    onTrustUpdated(event) {
        const { did, trustScore, reason } = event.detail;
        
        if (this.bannedMembers.has(did)) {
            logger.warn(`Cannot update trust for banned member: ${did}`);
            return;
        }
        
        const currentTrust = this.getTrustScore(did);
        const newTrustScore = Math.max(0, currentTrust + trustScore);
        
        // Determine appropriate trust level
        if (newTrustScore >= this.HIGH_TRUST_THRESHOLD) {
            this.promoteMemberToHighTrust(did, newTrustScore);
        } else {
            this.updateLowTrustMember(did, newTrustScore);
        }
        
        logger.info(`Trust updated for ${did}: ${currentTrust} -> ${newTrustScore} (${reason})`);
        eventBus.emit('guild:trust_score_changed', { did, oldScore: currentTrust, newScore: newTrustScore, reason });
    }

    promoteMemberToHighTrust(did, trustScore) {
        // Check if high trust is full
        if (this.highTrustMembers.size >= this.MAX_HIGH_TRUST) {
            // Find lowest trust score in high trust to potentially demote
            const lowestHighTrust = this.findLowestTrustMember(this.highTrustMembers);
            
            if (lowestHighTrust && lowestHighTrust.trustScore < trustScore) {
                // Demote lowest and promote new member
                this.demoteMemberToLowTrust(lowestHighTrust.did);
                logger.info(`Demoted ${lowestHighTrust.did} to make room for ${did}`);
            } else {
                logger.warn(`Cannot promote ${did} to high trust: no space and insufficient score`);
                return;
            }
        }
        
        // Remove from low trust if present
        this.lowTrustMembers.delete(did);
        
        // Add to high trust
        this.highTrustMembers.set(did, {
            trustScore,
            joinedAt: Date.now(),
            lastActivity: Date.now()
        });
        
        logger.info(`Member ${did} promoted to HIGH TRUST with score ${trustScore}`);
        eventBus.emit('guild:member_promoted', { did, trustScore });
    }

    demoteMemberToLowTrust(did) {
        const member = this.highTrustMembers.get(did);
        if (!member) return;
        
        // Remove from high trust
        this.highTrustMembers.delete(did);
        
        // Check if low trust is full
        if (this.lowTrustMembers.size >= this.MAX_LOW_TRUST) {
            // Remove oldest low trust member
            const oldestLowTrust = this.findOldestMember(this.lowTrustMembers);
            if (oldestLowTrust) {
                this.lowTrustMembers.delete(oldestLowTrust.did);
                logger.info(`Removed oldest low trust member ${oldestLowTrust.did} to make space`);
            }
        }
        
        // Add to low trust
        this.lowTrustMembers.set(did, {
            trustScore: Math.max(0, member.trustScore - 5), // Penalty for demotion
            joinedAt: member.joinedAt,
            probationUntil: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days probation
        });
        
        logger.info(`Member ${did} demoted to LOW TRUST`);
        eventBus.emit('guild:member_demoted', { did });
    }

    updateLowTrustMember(did, trustScore) {
        const member = this.lowTrustMembers.get(did);
        
        if (member) {
            member.trustScore = trustScore;
            member.lastActivity = Date.now();
        } else {
            // New low trust member
            this.lowTrustMembers.set(did, {
                trustScore,
                joinedAt: Date.now(),
                probationUntil: Date.now() + (7 * 24 * 60 * 60 * 1000)
            });
        }
    }

    banMember(event) {
        const { did, reason, duration } = event.detail;
        
        // Remove from trust lists
        this.highTrustMembers.delete(did);
        this.lowTrustMembers.delete(did);
        
        // Check if banned list is full
        if (this.bannedMembers.size >= this.MAX_BANNED) {
            // Remove oldest ban
            const oldestBan = this.findOldestBan();
            if (oldestBan) {
                this.bannedMembers.delete(oldestBan.did);
                logger.info(`Removed oldest ban ${oldestBan.did} to make space`);
            }
        }
        
        // Add to banned list
        const banDuration = duration || this.guildConfig.banDuration;
        this.bannedMembers.set(did, {
            bannedAt: Date.now(),
            bannedUntil: Date.now() + banDuration,
            reason: reason || 'Unspecified violation'
        });
        
        logger.warn(`Member ${did} banned for ${reason}, duration: ${banDuration}ms`);
        eventBus.emit('guild:member_banned', { did, reason, duration: banDuration });
    }

    unbanMember(event) {
        const { did } = event.detail;
        
        if (this.bannedMembers.has(did)) {
            this.bannedMembers.delete(did);
            logger.info(`Member ${did} unbanned`);
            eventBus.emit('guild:member_unbanned', { did });
        }
    }

    getTrustLevel(event) {
        const { did } = event.detail;
        const trustLevel = this.getMemberTrustLevel(did);
        
        eventBus.emit('guild:trust_level_response', { did, trustLevel });
        return trustLevel;
    }

    getMemberTrustLevel(did) {
        if (this.bannedMembers.has(did)) {
            const ban = this.bannedMembers.get(did);
            if (ban.bannedUntil > Date.now()) {
                return 'BANNED';
            } else {
                // Auto-unban expired bans
                this.bannedMembers.delete(did);
            }
        }
        
        if (this.highTrustMembers.has(did)) {
            return 'HIGH_TRUST';
        }
        
        if (this.lowTrustMembers.has(did)) {
            return 'LOW_TRUST';
        }
        
        return 'UNKNOWN';
    }

    getTrustScore(did) {
        if (this.highTrustMembers.has(did)) {
            return this.highTrustMembers.get(did).trustScore;
        }
        
        if (this.lowTrustMembers.has(did)) {
            return this.lowTrustMembers.get(did).trustScore;
        }
        
        return 0;
    }

    getServiceDelay(event) {
        const { did, serviceType } = event.detail;
        const trustLevel = this.getMemberTrustLevel(did);
        
        let delay = 0;
        
        switch (trustLevel) {
            case 'HIGH_TRUST':
                delay = 0; // No delay for high trust
                break;
                
            case 'LOW_TRUST':
                delay = this.serviceDelays.lowTrust[serviceType] || 20000;
                break;
                
            case 'UNKNOWN':
            case 'BANNED':
                delay = this.serviceDelays.nonGuild[serviceType] || 60000;
                break;
        }
        
        eventBus.emit('guild:service_delay_response', { did, serviceType, delay, trustLevel });
        return delay;
    }

    cleanupExpiredBans() {
        const now = Date.now();
        let removedCount = 0;
        
        for (const [did, ban] of this.bannedMembers.entries()) {
            if (ban.bannedUntil <= now) {
                this.bannedMembers.delete(did);
                removedCount++;
                logger.info(`Expired ban removed for ${did}`);
            }
        }
        
        if (removedCount > 0) {
            logger.info(`Cleaned up ${removedCount} expired bans`);
            eventBus.emit('guild:bans_cleaned', { removedCount });
        }
    }

    findLowestTrustMember(memberMap) {
        let lowest = null;
        
        for (const [did, member] of memberMap.entries()) {
            if (!lowest || member.trustScore < lowest.trustScore) {
                lowest = { did, ...member };
            }
        }
        
        return lowest;
    }

    findOldestMember(memberMap) {
        let oldest = null;
        
        for (const [did, member] of memberMap.entries()) {
            if (!oldest || member.joinedAt < oldest.joinedAt) {
                oldest = { did, ...member };
            }
        }
        
        return oldest;
    }

    findOldestBan() {
        let oldest = null;
        
        for (const [did, ban] of this.bannedMembers.entries()) {
            if (!oldest || ban.bannedAt < oldest.bannedAt) {
                oldest = { did, ...ban };
            }
        }
        
        return oldest;
    }

    getMembershipStats() {
        return {
            highTrustCount: this.highTrustMembers.size,
            lowTrustCount: this.lowTrustMembers.size,
            bannedCount: this.bannedMembers.size,
            totalMembers: this.highTrustMembers.size + this.lowTrustMembers.size,
            guildId: this.currentGuildId,
            capacity: {
                highTrust: this.MAX_HIGH_TRUST,
                lowTrust: this.MAX_LOW_TRUST,
                banned: this.MAX_BANNED
            }
        };
    }

    // Storage methods
    async loadFromStorage() {
        try {
            const indexedDBManager = await import('../../storage/IndexedDBManager.js');
            const db = new indexedDBManager.default();
            return await db.get('guild_membership', 'membership_data');
        } catch (error) {
            logger.warn('IndexedDB not available for guild membership storage');
            return null;
        }
    }

    async saveToStorage(data) {
        try {
            const indexedDBManager = await import('../../storage/IndexedDBManager.js');
            const db = new indexedDBManager.default();
            await db.put('guild_membership', { id: 'membership_data', ...data });
        } catch (error) {
            logger.warn('Failed to save guild membership to IndexedDB:', error);
        }
    }

    // Public API methods
    isMember(did) {
        return this.highTrustMembers.has(did) || this.lowTrustMembers.has(did);
    }

    isHighTrust(did) {
        return this.highTrustMembers.has(did);
    }

    isLowTrust(did) {
        return this.lowTrustMembers.has(did);
    }

    isBanned(did) {
        if (!this.bannedMembers.has(did)) return false;
        
        const ban = this.bannedMembers.get(did);
        if (ban.bannedUntil <= Date.now()) {
            // Auto-cleanup expired ban
            this.bannedMembers.delete(did);
            return false;
        }
        
        return true;
    }

    getAllMembers() {
        const allMembers = new Map();
        
        // Add high trust members
        for (const [did, member] of this.highTrustMembers.entries()) {
            allMembers.set(did, { ...member, trustLevel: 'HIGH_TRUST' });
        }
        
        // Add low trust members
        for (const [did, member] of this.lowTrustMembers.entries()) {
            allMembers.set(did, { ...member, trustLevel: 'LOW_TRUST' });
        }
        
        return allMembers;
    }
}

export default GuildMembership;