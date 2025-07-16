/**
 * Task Auction System - Proof-of-Performance Economy
 * 
 * Implements the decentralized task auction system described in the whitepaper.
 * Features:
 * - Task bounty creation with resource offers
 * - Module bidding with stake commitments
 * - Distributed jury selection via sortition
 * - Network consensus and ratification
 * - Execution monitoring and reward/slashing
 * - Trust token management
 * - Guild collaboration support
 */

import eventBus from '../core/EventBus.js';
import stateManager from '../core/StateManager.js';

class TaskAuctionSystem {
    constructor() {
        this.name = 'TaskAuctionSystem';
        this.version = '1.0.0';
        this.initialized = false;
        this.active = false;
        
        // Task management
        this.activeTasks = new Map();
        this.taskHistory = new Map();
        this.pendingBids = new Map();
        this.activeAuctions = new Map();
        
        // Economic state
        this.trustBalance = 1000; // Initial trust tokens
        this.reputationScore = 100; // Initial reputation
        this.stakeEscrow = new Map(); // taskId -> stakedAmount
        
        // Jury system
        this.juryPool = new Set();
        this.activeJuries = new Map();
        this.juryHistory = new Map();
        
        // Module registry for bidding
        this.registeredModules = new Map();
        this.modulePerformance = new Map();
        
        // Guild system
        this.guilds = new Map();
        this.guildMemberships = new Set();
        
        // Configuration
        this.config = {
            minStakeAmount: 10,
            maxStakeAmount: 500,
            biddingTimeWindow: 30000, // 30 seconds
            jurySize: 5,
            consensusThreshold: 0.6, // 60% agreement needed
            reputationDecayRate: 0.995,
            trustRewardMultiplier: 1.2,
            slashingPenalty: 0.5
        };
        
        // Task categories for specialization
        this.taskCategories = new Set([
            'computation', 'analysis', 'communication', 'storage', 
            'networking', 'validation', 'synthesis', 'optimization'
        ]);
        
        this.init();
    }
    
    async init() {
        try {
            console.log('🏛️ Initializing Task Auction System...');
            
            this.setupEventListeners();
            this.loadPersistedState();
            this.startEconomicProcesses();
            
            this.initialized = true;
            console.log('✅ Task Auction System initialized');
            
            eventBus.emit('module:initialized', {
                name: this.name,
                version: this.version,
                capabilities: this.getCapabilities()
            });
            
        } catch (error) {
            console.error('❌ Task Auction System initialization failed:', error);
            throw error;
        }
    }
    
    setupEventListeners() {
        // Task lifecycle events
        eventBus.on('task:create', this.createTaskBounty.bind(this));
        eventBus.on('task:bid', this.submitBid.bind(this));
        eventBus.on('task:execute', this.executeTask.bind(this));
        eventBus.on('task:complete', this.handleTaskCompletion.bind(this));
        
        // Module management
        eventBus.on('module:register-for-bidding', this.registerModule.bind(this));
        eventBus.on('module:performance-update', this.updateModulePerformance.bind(this));
        
        // Economic events
        eventBus.on('economy:stake', this.stakeTokens.bind(this));
        eventBus.on('economy:reward', this.rewardModule.bind(this));
        eventBus.on('economy:slash', this.slashStake.bind(this));
        
        // Guild events
        eventBus.on('guild:create', this.createGuild.bind(this));
        eventBus.on('guild:join', this.joinGuild.bind(this));
        eventBus.on('guild:bid', this.submitGuildBid.bind(this));
        
        // Jury events
        eventBus.on('jury:select', this.selectJury.bind(this));
        eventBus.on('jury:vote', this.processJuryVote.bind(this));
        eventBus.on('jury:consensus', this.handleJuryConsensus.bind(this));
        
        // Network events
        eventBus.on('network:peer-reputation-update', this.updatePeerReputation.bind(this));
        eventBus.on('network:task-gossip', this.handleTaskGossip.bind(this));
    }
    
    /**
     * Create a new task bounty with resource offer
     */
    async createTaskBounty(taskData) {
        try {
            const taskId = this.generateTaskId();
            const bounty = {
                id: taskId,
                description: taskData.description,
                category: taskData.category || 'computation',
                resourceOffer: taskData.resourceOffer || {
                    cpu: 10,
                    memory: 50,
                    network: 5,
                    storage: 10,
                    trustReward: 50
                },
                requirements: taskData.requirements || {},
                verificationCriteria: taskData.verificationCriteria || {},
                createdBy: taskData.userId,
                createdAt: Date.now(),
                status: 'open',
                biddingDeadline: Date.now() + this.config.biddingTimeWindow,
                tier: this.calculateTaskTier(taskData.resourceOffer)
            };
            
            this.activeAuctions.set(taskId, bounty);
            this.pendingBids.set(taskId, new Map());
            
            // Broadcast to network
            eventBus.emit('network:broadcast', {
                type: 'task-bounty',
                data: bounty
            });
            
            // Update UI
            stateManager.setState(`tasks.${taskId}`, bounty);
            
            console.log(`📋 Task bounty created: ${taskId}`);
            
            // Set bidding timeout
            setTimeout(() => {
                this.closeBidding(taskId);
            }, this.config.biddingTimeWindow);
            
            return taskId;
            
        } catch (error) {
            console.error('Error creating task bounty:', error);
            throw error;
        }
    }
    
    /**
     * Submit a bid for a task
     */
    async submitBid(bidData) {
        try {
            const { taskId, moduleId, plan, confidence, stakeAmount, estimatedCost } = bidData;
            
            // Validate bid
            if (!this.validateBid(bidData)) {
                throw new Error('Invalid bid data');
            }
            
            // Check if module has sufficient trust to stake
            const moduleInfo = this.registeredModules.get(moduleId);
            if (!moduleInfo || moduleInfo.trustBalance < stakeAmount) {
                throw new Error('Insufficient trust balance for stake');
            }
            
            // Ethics check
            const ethicsResult = await this.ethicsCheck(plan);
            if (!ethicsResult.approved) {
                console.log(`❌ Bid rejected by ethics module: ${ethicsResult.reason}`);
                return false;
            }
            
            const bid = {
                id: this.generateBidId(),
                taskId,
                moduleId,
                plan,
                confidence,
                stakeAmount,
                estimatedCost,
                submittedAt: Date.now(),
                moduleReputation: moduleInfo.reputation,
                moduleDID: moduleInfo.did,
                ethicsApproved: true
            };
            
            // Add to pending bids
            const taskBids = this.pendingBids.get(taskId) || new Map();
            taskBids.set(bid.id, bid);
            this.pendingBids.set(taskId, taskBids);
            
            // Escrow the stake
            this.escrowStake(moduleId, stakeAmount, taskId);
            
            // Broadcast bid to network
            eventBus.emit('network:broadcast', {
                type: 'task-bid',
                data: bid
            });
            
            console.log(`💰 Bid submitted for task ${taskId} by module ${moduleId}`);
            return bid.id;
            
        } catch (error) {
            console.error('Error submitting bid:', error);
            throw error;
        }
    }
    
    /**
     * Close bidding and select jury
     */
    async closeBidding(taskId) {
        try {
            const bounty = this.activeAuctions.get(taskId);
            const bids = this.pendingBids.get(taskId);
            
            if (!bounty || !bids || bids.size === 0) {
                console.log(`No bids received for task ${taskId}`);
                this.cancelTask(taskId);
                return;
            }
            
            bounty.status = 'jury-selection';
            
            // Select jury via sortition
            const jury = await this.selectJuryViaSortition(taskId, bounty);
            
            if (jury.length < this.config.jurySize) {
                console.warn(`Insufficient jury members for task ${taskId}`);
                this.cancelTask(taskId);
                return;
            }
            
            // Send bids to jury for evaluation
            const juryData = {
                taskId,
                bounty,
                bids: Array.from(bids.values()),
                juryMembers: jury,
                deadline: Date.now() + 60000 // 1 minute to decide
            };
            
            this.activeJuries.set(taskId, juryData);
            
            // Notify jury members
            jury.forEach(jurorId => {
                eventBus.emit('jury:assignment', {
                    jurorId,
                    taskId,
                    bids: Array.from(bids.values())
                });
            });
            
            console.log(`⚖️ Jury selected for task ${taskId}`);
            
        } catch (error) {
            console.error('Error closing bidding:', error);
        }
    }
    
    /**
     * Select jury via deterministic sortition
     */
    async selectJuryViaSortition(taskId, bounty) {
        try {
            // Get eligible jurors (high reputation, not involved in task)
            const eligibleJurors = Array.from(this.juryPool).filter(peerId => {
                const peer = stateManager.getState(`network.peers.${peerId}`);
                return peer && 
                       peer.reputation >= 500 && // Minimum reputation
                       peerId !== bounty.createdBy && // Not task creator
                       !this.pendingBids.get(taskId)?.has(peerId); // Not a bidder
            });
            
            if (eligibleJurors.length < this.config.jurySize) {
                throw new Error('Insufficient eligible jurors');
            }
            
            // Deterministic selection using task hash as seed
            const taskHash = this.hashString(taskId + bounty.createdAt);
            const selectedJurors = this.deterministicShuffle(eligibleJurors, taskHash)
                .slice(0, this.config.jurySize);
            
            return selectedJurors;
            
        } catch (error) {
            console.error('Error selecting jury:', error);
            return [];
        }
    }
    
    /**
     * Process jury vote on winning bid
     */
    async processJuryVote(voteData) {
        try {
            const { taskId, jurorId, selectedBidId, reasoning } = voteData;
            const juryData = this.activeJuries.get(taskId);
            
            if (!juryData) {
                throw new Error('No active jury for task');
            }
            
            // Record vote
            juryData.votes = juryData.votes || new Map();
            juryData.votes.set(jurorId, {
                bidId: selectedBidId,
                reasoning,
                timestamp: Date.now()
            });
            
            // Check if we have consensus
            if (juryData.votes.size >= this.config.jurySize) {
                await this.processJuryConsensus(taskId);
            }
            
        } catch (error) {
            console.error('Error processing jury vote:', error);
        }
    }
    
    /**
     * Process jury consensus and award task
     */
    async processJuryConsensus(taskId) {
        try {
            const juryData = this.activeJuries.get(taskId);
            const votes = Array.from(juryData.votes.values());
            
            // Count votes for each bid
            const voteCount = new Map();
            votes.forEach(vote => {
                const count = voteCount.get(vote.bidId) || 0;
                voteCount.set(vote.bidId, count + 1);
            });
            
            // Find winning bid (most votes)
            let winningBidId = null;
            let maxVotes = 0;
            
            voteCount.forEach((count, bidId) => {
                if (count > maxVotes) {
                    maxVotes = count;
                    winningBidId = bidId;
                }
            });
            
            // Check if consensus threshold met
            const consensusRatio = maxVotes / this.config.jurySize;
            if (consensusRatio < this.config.consensusThreshold) {
                console.log(`No consensus reached for task ${taskId}`);
                this.cancelTask(taskId);
                return;
            }
            
            // Award task to winning bid
            const winningBid = this.pendingBids.get(taskId).get(winningBidId);
            await this.awardTask(taskId, winningBid);
            
        } catch (error) {
            console.error('Error processing jury consensus:', error);
        }
    }
    
    /**
     * Award task to winning module
     */
    async awardTask(taskId, winningBid) {
        try {
            const bounty = this.activeAuctions.get(taskId);
            
            // Create task execution record
            const task = {
                id: taskId,
                bounty,
                winningBid,
                status: 'awarded',
                awardedAt: Date.now(),
                executorModule: winningBid.moduleId,
                expectedCompletion: Date.now() + 300000 // 5 minutes
            };
            
            this.activeTasks.set(taskId, task);
            
            // Present to user for final approval
            eventBus.emit('task:user-approval-required', {
                taskId,
                task,
                winningBid
            });
            
            // Update UI
            stateManager.setState(`tasks.${taskId}`, task);
            
            console.log(`🏆 Task ${taskId} awarded to module ${winningBid.moduleId}`);
            
        } catch (error) {
            console.error('Error awarding task:', error);
        }
    }
    
    /**
     * Execute approved task
     */
    async executeTask(taskData) {
        try {
            const { taskId, userApproved } = taskData;
            
            if (!userApproved) {
                console.log(`User rejected task ${taskId}`);
                this.cancelTask(taskId);
                return;
            }
            
            const task = this.activeTasks.get(taskId);
            task.status = 'executing';
            task.startedAt = Date.now();
            
            // Execute in sandboxed environment
            eventBus.emit('task:execute-plan', {
                taskId,
                plan: task.winningBid.plan,
                resourceLimits: task.bounty.resourceOffer
            });
            
            // Start monitoring
            this.monitorTaskExecution(taskId);
            
            console.log(`🚀 Executing task ${taskId}`);
            
        } catch (error) {
            console.error('Error executing task:', error);
            this.handleTaskFailure(taskId, error);
        }
    }
    
    /**
     * Handle task completion
     */
    async handleTaskCompletion(completionData) {
        try {
            const { taskId, success, result, metrics } = completionData;
            const task = this.activeTasks.get(taskId);
            
            if (!task) {
                throw new Error('Task not found');
            }
            
            task.status = success ? 'completed' : 'failed';
            task.completedAt = Date.now();
            task.result = result;
            task.metrics = metrics;
            
            if (success) {
                await this.rewardSuccessfulCompletion(taskId, task);
            } else {
                await this.handleTaskFailure(taskId, result);
            }
            
            // Move to history
            this.taskHistory.set(taskId, task);
            this.activeTasks.delete(taskId);
            
            // Update statistics
            this.updateEconomicStats(task, success);
            
        } catch (error) {
            console.error('Error handling task completion:', error);
        }
    }
    
    /**
     * Reward successful task completion
     */
    async rewardSuccessfulCompletion(taskId, task) {
        try {
            const moduleId = task.winningBid.moduleId;
            const stakeAmount = task.winningBid.stakeAmount;
            const trustReward = task.bounty.resourceOffer.trustReward;
            
            // Return staked amount
            this.returnStake(moduleId, stakeAmount, taskId);
            
            // Award trust tokens
            const totalReward = Math.floor(trustReward * this.config.trustRewardMultiplier);
            this.awardTrustTokens(moduleId, totalReward);
            
            // Increase reputation
            this.increaseReputation(moduleId, 10);
            
            // Distribute symbiotic tithe
            const tithe = Math.floor(totalReward * 0.05); // 5% tithe
            this.distributeSymbioticTithe(tithe);
            
            console.log(`💰 Module ${moduleId} rewarded ${totalReward} trust tokens`);
            
            // Emit success event
            eventBus.emit('economy:reward-distributed', {
                moduleId,
                taskId,
                trustReward: totalReward,
                reputationIncrease: 10
            });
            
        } catch (error) {
            console.error('Error rewarding completion:', error);
        }
    }
    
    /**
     * Handle task failure and slash stake
     */
    async handleTaskFailure(taskId, error) {
        try {
            const task = this.activeTasks.get(taskId);
            if (!task) return;
            
            const moduleId = task.winningBid.moduleId;
            const stakeAmount = task.winningBid.stakeAmount;
            
            // Slash stake
            const slashAmount = Math.floor(stakeAmount * this.config.slashingPenalty);
            this.slashStake(moduleId, slashAmount, taskId);
            
            // Decrease reputation
            this.decreaseReputation(moduleId, 20);
            
            console.log(`⚡ Module ${moduleId} stake slashed: ${slashAmount} tokens`);
            
            // Emit failure event
            eventBus.emit('economy:stake-slashed', {
                moduleId,
                taskId,
                slashAmount,
                reputationDecrease: 20,
                reason: error.message || 'Task execution failed'
            });
            
        } catch (error) {
            console.error('Error handling task failure:', error);
        }
    }
    
    /**
     * Economic helper methods
     */
    escrowStake(moduleId, amount, taskId) {
        const moduleInfo = this.registeredModules.get(moduleId);
        if (moduleInfo.trustBalance < amount) {
            throw new Error('Insufficient trust balance');
        }
        
        moduleInfo.trustBalance -= amount;
        this.stakeEscrow.set(`${moduleId}:${taskId}`, amount);
    }
    
    returnStake(moduleId, amount, taskId) {
        const moduleInfo = this.registeredModules.get(moduleId);
        moduleInfo.trustBalance += amount;
        this.stakeEscrow.delete(`${moduleId}:${taskId}`);
    }
    
    slashStake(moduleId, amount, taskId) {
        // Slashed tokens go to common good fund
        this.distributeSymbioticTithe(amount);
        this.stakeEscrow.delete(`${moduleId}:${taskId}`);
    }
    
    awardTrustTokens(moduleId, amount) {
        const moduleInfo = this.registeredModules.get(moduleId);
        moduleInfo.trustBalance += amount;
    }
    
    increaseReputation(moduleId, amount) {
        const moduleInfo = this.registeredModules.get(moduleId);
        moduleInfo.reputation += amount;
    }
    
    decreaseReputation(moduleId, amount) {
        const moduleInfo = this.registeredModules.get(moduleId);
        moduleInfo.reputation = Math.max(0, moduleInfo.reputation - amount);
    }
    
    distributeSymbioticTithe(amount) {
        // Distribute to common good fund for network health
        const commonGoodFund = stateManager.getState('economy.commonGoodFund', 0);
        stateManager.setState('economy.commonGoodFund', commonGoodFund + amount);
        
        eventBus.emit('economy:tithe-distributed', { amount });
    }
    
    /**
     * Utility methods
     */
    generateTaskId() {
        return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    generateBidId() {
        return 'bid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    calculateTaskTier(resourceOffer) {
        const totalResources = resourceOffer.cpu + resourceOffer.memory + 
                              resourceOffer.network + resourceOffer.storage;
        
        if (totalResources < 50) return 'micro';
        if (totalResources < 200) return 'standard';
        return 'high_value';
    }
    
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
    
    deterministicShuffle(array, seed) {
        const shuffled = [...array];
        let m = shuffled.length;
        
        while (m) {
            const i = Math.floor((seed / (m + 1)) * (m + 1)) % m--;
            [shuffled[m], shuffled[i]] = [shuffled[i], shuffled[m]];
            seed = (seed * 9301 + 49297) % 233280;
        }
        
        return shuffled;
    }
    
    validateBid(bidData) {
        return bidData.taskId && bidData.moduleId && bidData.plan && 
               bidData.stakeAmount >= this.config.minStakeAmount &&
               bidData.stakeAmount <= this.config.maxStakeAmount;
    }
    
    async ethicsCheck(plan) {
        return new Promise(resolve => {
            eventBus.emit('ethics:evaluate-plan', { plan }, (result) => {
                resolve(result);
            });
        });
    }
    
    getCapabilities() {
        return [
            'task-auction',
            'proof-of-performance',
            'distributed-consensus',
            'economic-incentives',
            'jury-selection',
            'stake-management'
        ];
    }
    
    async start() {
        this.active = true;
        console.log('🏛️ Task Auction System started');
    }
    
    async stop() {
        this.active = false;
        console.log('🏛️ Task Auction System stopped');
    }
    
    getStatus() {
        return {
            name: this.name,
            active: this.active,
            activeTasks: this.activeTasks.size,
            activeAuctions: this.activeAuctions.size,
            trustBalance: this.trustBalance,
            reputationScore: this.reputationScore,
            registeredModules: this.registeredModules.size
        };
    }
}

export default TaskAuctionSystem;