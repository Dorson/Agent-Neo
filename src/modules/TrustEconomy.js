/**
 * Trust Economy Module
 * 
 * Implements the Decentralized Proof-of-Performance (PoP) Economy as described
 * in the Agent Neo whitepaper. This module manages Trust tokens, reputation
 * scoring, task auctions, and economic incentives.
 * 
 * Key Features:
 * - Trust token management (non-transferable internal currency)
 * - Reputation scoring based on performance
 * - Task auction system with bidding and consensus
 * - Resource staking and slashing mechanisms
 * - Economic incentive loops for quality work
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';
import CryptoManager from '../core/CryptoManager.js';
import LocalLedger from '../core/LocalLedger.js';
import { config } from '../core/config.js';

class TrustEconomy {
    constructor() {
        this.initialized = false;
        this.trustBalance = 100; // Initial trust tokens
        this.reputationScore = 0;
        this.stakingPositions = new Map(); // taskId -> staked amount
        this.taskHistory = new Map(); // taskId -> performance data
        this.economicMetrics = {
            totalEarned: 0,
            totalSlashed: 0,
            successRate: 0,
            averageStake: 0,
            taskCompleted: 0
        };
        
        // Economic configuration
        this.config = {
            initialTrust: 100,
            maxTrust: 10000,
            minStakeAmount: 1,
            maxStakeAmount: 100,
            reputationDecayRate: 0.01, // 1% per period
            stakingRewardRate: 0.1, // 10% bonus for successful tasks
            slashingPenaltyRate: 0.5, // 50% penalty for failed tasks
            consensusThreshold: 0.67, // 67% agreement needed
            auctionTimeWindow: 30000, // 30 seconds for bid collection
        };
        
        this.activeBids = new Map(); // taskId -> bid data
        this.activeConsensus = new Map(); // taskId -> consensus data
        
        this.init();
    }

    async init() {
        try {
            console.log('💰 Trust Economy initializing...');
            
            // Load persisted economic state
            await this.loadEconomicState();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Start economic monitoring
            this.startEconomicMonitoring();
            
            this.initialized = true;
            
            eventBus.emit('economy:initialized', {
                trustBalance: this.trustBalance,
                reputationScore: this.reputationScore
            });
            
            console.log('✅ Trust Economy initialized');
            console.log(`💎 Trust Balance: ${this.trustBalance}`);
            console.log(`⭐ Reputation Score: ${this.reputationScore}`);
            
        } catch (error) {
            console.error('❌ Trust Economy initialization failed:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Task lifecycle events
        eventBus.on('task:created', this.handleTaskCreated.bind(this));
        eventBus.on('task:bid_submitted', this.handleBidSubmitted.bind(this));
        eventBus.on('task:completed', this.handleTaskCompleted.bind(this));
        eventBus.on('task:failed', this.handleTaskFailed.bind(this));
        
        // Consensus events
        eventBus.on('consensus:vote_cast', this.handleConsensusVote.bind(this));
        eventBus.on('consensus:result', this.handleConsensusResult.bind(this));
        
        // Guild events
        eventBus.on('guild:member_joined', this.handleGuildMemberJoined.bind(this));
        eventBus.on('guild:performance_report', this.handlePerformanceReport.bind(this));
        
        // Economic events
        eventBus.on('economy:stake_tokens', this.stakeTokens.bind(this));
        eventBus.on('economy:claim_rewards', this.claimRewards.bind(this));
    }

    /**
     * Submit a bid for a task auction
     * @param {string} taskId - Task identifier
     * @param {Object} bidData - Bid details
     * @returns {Promise<Object>} Bid result
     */
    async submitBid(taskId, bidData) {
        try {
            const {
                proposedSolution,
                confidenceScore,
                resourceOffer,
                stakeAmount,
                estimatedDuration
            } = bidData;

            // Validate bid requirements
            if (stakeAmount < this.config.minStakeAmount) {
                throw new Error(`Minimum stake is ${this.config.minStakeAmount} Trust tokens`);
            }

            if (stakeAmount > this.trustBalance) {
                throw new Error('Insufficient Trust balance for stake');
            }

            if (stakeAmount > this.config.maxStakeAmount) {
                throw new Error(`Maximum stake is ${this.config.maxStakeAmount} Trust tokens`);
            }

            // Calculate bid score based on multiple factors
            const bidScore = this.calculateBidScore({
                confidenceScore,
                reputationScore: this.reputationScore,
                stakeAmount,
                resourceOffer,
                estimatedDuration
            });

            // Create signed bid
            const bid = {
                taskId,
                bidder: await this.getAgentDID(),
                proposedSolution,
                confidenceScore: Math.min(Math.max(confidenceScore, 0), 1),
                resourceOffer,
                stakeAmount,
                estimatedDuration,
                bidScore,
                timestamp: Date.now(),
                signature: await this.signBid(taskId, bidData)
            };

            // Store bid locally
            this.activeBids.set(taskId, bid);

            // Stake the tokens (temporarily lock them)
            await this.stakeTokens(taskId, stakeAmount);

            // Broadcast bid to network
            eventBus.emit('p2p:broadcast', {
                type: 'TASK_BID',
                data: bid
            });

            // Record in local ledger
            await LocalLedger.addEntry({
                type: 'bid_submitted',
                taskId,
                stakeAmount,
                bidScore,
                timestamp: Date.now()
            });

            console.log(`📊 Bid submitted for task ${taskId}: score=${bidScore}, stake=${stakeAmount}`);

            return {
                success: true,
                bidId: `${taskId}_${Date.now()}`,
                bidScore,
                stakeAmount
            };

        } catch (error) {
            console.error('❌ Failed to submit bid:', error);
            throw error;
        }
    }

    /**
     * Calculate bid score based on multiple factors
     * @param {Object} factors - Bid factors
     * @returns {number} Calculated bid score
     */
    calculateBidScore(factors) {
        const {
            confidenceScore,
            reputationScore,
            stakeAmount,
            resourceOffer,
            estimatedDuration
        } = factors;

        // Normalize reputation score to 0-1 range
        const normalizedReputation = Math.min(reputationScore / 100, 1);
        
        // Normalize stake amount to 0-1 range
        const normalizedStake = Math.min(stakeAmount / this.config.maxStakeAmount, 1);
        
        // Normalize resource offer (assuming it's a percentage)
        const normalizedResource = Math.min(resourceOffer / 100, 1);
        
        // Penalty for longer estimated duration
        const durationPenalty = Math.max(0, 1 - (estimatedDuration / 300000)); // 5 minutes baseline
        
        // Weighted score calculation
        const bidScore = (
            confidenceScore * 0.3 +           // 30% confidence
            normalizedReputation * 0.25 +     // 25% reputation
            normalizedStake * 0.2 +           // 20% stake commitment
            normalizedResource * 0.15 +       // 15% resource offer
            durationPenalty * 0.1             // 10% duration efficiency
        ) * 100; // Scale to 0-100

        return Math.round(bidScore * 100) / 100; // Round to 2 decimal places
    }

    /**
     * Handle task completion and reward distribution
     * @param {Object} event - Task completion event
     */
    async handleTaskCompleted(event) {
        try {
            const { taskId, result, performanceMetrics } = event;
            
            if (!this.stakingPositions.has(taskId)) {
                return; // Not our task
            }

            const stakedAmount = this.stakingPositions.get(taskId);
            
            // Calculate performance-based reward
            const baseReward = stakedAmount * this.config.stakingRewardRate;
            const performanceMultiplier = this.calculatePerformanceMultiplier(performanceMetrics);
            const totalReward = Math.round(baseReward * performanceMultiplier);

            // Award trust tokens
            await this.awardTrust(totalReward, `Task completion reward for ${taskId}`);
            
            // Update reputation
            await this.updateReputation(1.0, performanceMetrics);
            
            // Release staked tokens
            this.stakingPositions.delete(taskId);
            
            // Record successful task
            this.taskHistory.set(taskId, {
                status: 'completed',
                stake: stakedAmount,
                reward: totalReward,
                performance: performanceMetrics,
                timestamp: Date.now()
            });

            // Update metrics
            this.economicMetrics.totalEarned += totalReward;
            this.economicMetrics.taskCompleted++;
            this.updateSuccessRate();

            // Record in ledger
            await LocalLedger.addEntry({
                type: 'task_completed',
                taskId,
                reward: totalReward,
                performanceMultiplier,
                newReputation: this.reputationScore,
                timestamp: Date.now()
            });

            eventBus.emit('economy:reward_earned', {
                taskId,
                reward: totalReward,
                newBalance: this.trustBalance,
                newReputation: this.reputationScore
            });

            console.log(`🎉 Task ${taskId} completed! Reward: ${totalReward} Trust`);

        } catch (error) {
            console.error('❌ Failed to handle task completion:', error);
        }
    }

    /**
     * Handle task failure and apply penalties
     * @param {Object} event - Task failure event
     */
    async handleTaskFailed(event) {
        try {
            const { taskId, reason, severity = 'medium' } = event;
            
            if (!this.stakingPositions.has(taskId)) {
                return; // Not our task
            }

            const stakedAmount = this.stakingPositions.get(taskId);
            
            // Calculate penalty based on severity
            const penaltyRates = {
                low: 0.2,
                medium: 0.5,
                high: 0.8,
                critical: 1.0
            };
            
            const penaltyRate = penaltyRates[severity] || this.config.slashingPenaltyRate;
            const penalty = Math.round(stakedAmount * penaltyRate);

            // Apply penalty (slash tokens)
            await this.slashTrust(penalty, `Task failure penalty for ${taskId}: ${reason}`);
            
            // Update reputation negatively
            await this.updateReputation(-0.5, { failure: true, severity });
            
            // Release remaining staked tokens
            this.stakingPositions.delete(taskId);
            
            // Record failed task
            this.taskHistory.set(taskId, {
                status: 'failed',
                stake: stakedAmount,
                penalty,
                reason,
                severity,
                timestamp: Date.now()
            });

            // Update metrics
            this.economicMetrics.totalSlashed += penalty;
            this.updateSuccessRate();

            // Record in ledger
            await LocalLedger.addEntry({
                type: 'task_failed',
                taskId,
                penalty,
                reason,
                severity,
                newReputation: this.reputationScore,
                timestamp: Date.now()
            });

            eventBus.emit('economy:penalty_applied', {
                taskId,
                penalty,
                reason,
                newBalance: this.trustBalance,
                newReputation: this.reputationScore
            });

            console.log(`💥 Task ${taskId} failed! Penalty: ${penalty} Trust. Reason: ${reason}`);

        } catch (error) {
            console.error('❌ Failed to handle task failure:', error);
        }
    }

    /**
     * Calculate performance multiplier for rewards
     * @param {Object} metrics - Performance metrics
     * @returns {number} Performance multiplier (0.5 - 2.0)
     */
    calculatePerformanceMultiplier(metrics) {
        const {
            efficiency = 1.0,
            quality = 1.0,
            timeliness = 1.0,
            resourceUsage = 1.0
        } = metrics;

        // Calculate weighted average
        const performanceScore = (
            efficiency * 0.3 +
            quality * 0.3 +
            timeliness * 0.25 +
            resourceUsage * 0.15
        );

        // Convert to multiplier (0.5x to 2.0x)
        return Math.min(Math.max(0.5, performanceScore * 1.5), 2.0);
    }

    /**
     * Award trust tokens
     * @param {number} amount - Amount to award
     * @param {string} reason - Reason for award
     */
    async awardTrust(amount, reason) {
        if (amount <= 0) return;

        const newBalance = Math.min(this.trustBalance + amount, this.config.maxTrust);
        const actualAward = newBalance - this.trustBalance;
        
        this.trustBalance = newBalance;
        
        await this.saveEconomicState();
        
        eventBus.emit('economy:trust_awarded', {
            amount: actualAward,
            reason,
            newBalance: this.trustBalance
        });

        console.log(`💎 Awarded ${actualAward} Trust: ${reason}`);
    }

    /**
     * Slash trust tokens as penalty
     * @param {number} amount - Amount to slash
     * @param {string} reason - Reason for slashing
     */
    async slashTrust(amount, reason) {
        if (amount <= 0) return;

        const newBalance = Math.max(this.trustBalance - amount, 0);
        const actualSlash = this.trustBalance - newBalance;
        
        this.trustBalance = newBalance;
        
        await this.saveEconomicState();
        
        eventBus.emit('economy:trust_slashed', {
            amount: actualSlash,
            reason,
            newBalance: this.trustBalance
        });

        console.log(`⚔️ Slashed ${actualSlash} Trust: ${reason}`);
    }

    /**
     * Stake tokens for a task
     * @param {string} taskId - Task identifier
     * @param {number} amount - Amount to stake
     */
    async stakeTokens(taskId, amount) {
        if (amount > this.trustBalance) {
            throw new Error('Insufficient trust balance for staking');
        }

        this.stakingPositions.set(taskId, amount);
        this.trustBalance -= amount;
        
        await this.saveEconomicState();
        
        eventBus.emit('economy:tokens_staked', {
            taskId,
            amount,
            newBalance: this.trustBalance
        });

        console.log(`🔒 Staked ${amount} Trust for task ${taskId}`);
    }

    /**
     * Update reputation score
     * @param {number} delta - Change in reputation
     * @param {Object} context - Context for the change
     */
    async updateReputation(delta, context = {}) {
        const oldReputation = this.reputationScore;
        this.reputationScore = Math.max(0, this.reputationScore + delta);
        
        await this.saveEconomicState();
        
        eventBus.emit('economy:reputation_updated', {
            oldReputation,
            newReputation: this.reputationScore,
            delta,
            context
        });

        console.log(`⭐ Reputation updated: ${oldReputation} → ${this.reputationScore} (${delta >= 0 ? '+' : ''}${delta})`);
    }

    /**
     * Update success rate metric
     */
    updateSuccessRate() {
        const completedTasks = Array.from(this.taskHistory.values())
            .filter(task => task.status === 'completed').length;
        
        const totalTasks = this.taskHistory.size;
        
        this.economicMetrics.successRate = totalTasks > 0 
            ? (completedTasks / totalTasks) * 100 
            : 0;
    }

    /**
     * Start economic monitoring and maintenance
     */
    startEconomicMonitoring() {
        // Reputation decay
        setInterval(() => {
            if (this.reputationScore > 0) {
                const decay = this.reputationScore * this.config.reputationDecayRate;
                this.updateReputation(-decay, { type: 'decay' });
            }
        }, 3600000); // Every hour

        // Economic metrics update
        setInterval(() => {
            this.calculateAverageStake();
            this.saveEconomicState();
        }, 60000); // Every minute
    }

    /**
     * Calculate average stake amount
     */
    calculateAverageStake() {
        const stakes = Array.from(this.taskHistory.values()).map(task => task.stake);
        this.economicMetrics.averageStake = stakes.length > 0
            ? stakes.reduce((a, b) => a + b, 0) / stakes.length
            : 0;
    }

    /**
     * Get current economic status
     * @returns {Object} Economic status
     */
    getEconomicStatus() {
        return {
            trustBalance: this.trustBalance,
            reputationScore: this.reputationScore,
            stakingPositions: Array.from(this.stakingPositions.entries()),
            metrics: { ...this.economicMetrics },
            activeAuctions: this.activeBids.size,
            isEconomicallyViable: this.trustBalance > this.config.minStakeAmount
        };
    }

    /**
     * Save economic state to local storage
     */
    async saveEconomicState() {
        const state = {
            trustBalance: this.trustBalance,
            reputationScore: this.reputationScore,
            metrics: this.economicMetrics,
            lastUpdated: Date.now()
        };

        stateManager.setState('economy', state);
    }

    /**
     * Load economic state from local storage
     */
    async loadEconomicState() {
        const state = stateManager.getState('economy');
        
        if (state) {
            this.trustBalance = state.trustBalance || this.config.initialTrust;
            this.reputationScore = state.reputationScore || 0;
            this.economicMetrics = { ...this.economicMetrics, ...state.metrics };
        } else {
            this.trustBalance = this.config.initialTrust;
        }
    }

    /**
     * Sign a bid for authentication
     * @param {string} taskId - Task ID
     * @param {Object} bidData - Bid data
     * @returns {Promise<string>} Signature
     */
    async signBid(taskId, bidData) {
        const bidString = JSON.stringify({ taskId, ...bidData, timestamp: Date.now() });
        return await CryptoManager.hash(bidString);
    }

    /**
     * Get agent DID
     * @returns {Promise<string>} Agent DID
     */
    async getAgentDID() {
        // This would integrate with IdentityManager
        return 'did:neo:placeholder';
    }
}

// Export singleton instance
const trustEconomy = new TrustEconomy();
export default trustEconomy;